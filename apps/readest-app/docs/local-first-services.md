# Local-First Services: WebDAV, OReader (KOSync), and LiteLLM

This build replaces Readest's commercial account/cloud/AI integrations with
user-controlled services. Everything below is optional and disabled by default;
with nothing configured the app is fully usable offline and makes no
application-originated network calls to official Readest, analytics, AI, or
translation endpoints (see `src/__tests__/services/network-boundary.test.ts`
and SPEC §8).

All service credentials live in the local settings store alongside the other
integration blocks (KOSync/WebDAV/S3) and are excluded from ordinary settings
exports and never written to logs.

---

## 1. LiteLLM (AI text-to-speech + translation) — SPEC §6

A single OpenAI-compatible endpoint backs both TTS and translation. Configure it
in **Settings → Integrations → AI Services → AI (LiteLLM)**.

| Field | Notes |
| --- | --- |
| Enable AI Services | Master gate. Off → TTS/translation never call out. |
| Base URL | e.g. `https://litellm.your-lan/v1`. Trailing slashes are trimmed. |
| API Key | Bearer token. Optional for keyless LAN deployments. |
| Translation Model | Chat model for `/chat/completions`, e.g. `gpt-4o-mini`. |
| TTS Model | Speech model for `/audio/speech`, e.g. `tts-1`. |
| TTS Voice | One of `alloy, echo, fable, onyx, nova, shimmer`. |
| Request Timeout (ms) | Per-request timeout; composed with playback cancellation. |
| Custom Headers (JSON) | Optional extra headers (e.g. a virtual-key header). |

**Translation** (`src/services/translators/providers/litellm.ts`) posts each
selected line to `/chat/completions` (temperature 0, source auto-detect when the
source is `AUTO`) and returns only the translated text. It is the default
translation provider; while the endpoint is unconfigured it reports itself
`disabled` and `useTranslator` transparently falls back to Google Translate.

**TTS** (`src/services/tts/LiteLLMTTSClient.ts`) streams sentence-sized requests
to `/audio/speech` (mp3, speed 1.0), decoding/trimming/time-stretching through
the shared WebAudio pipeline for gapless playback with pause/resume/stop and
in-flight cancellation. Fetched audio is held in a bounded in-memory cache
(64 entries, cleared on stop/shutdown). The OpenAI speech route returns no
word-boundary timings, so highlighting is sentence-granular. LiteLLM TTS is only
engaged when the user explicitly selects a "LiteLLM" voice in the TTS voice
picker — enabling the endpoint never overrides the Edge/Web default engine.

There are **no application-level quotas, credits, or premium checks** on TTS or
translation. Any limits come from the configured LiteLLM deployment or its
upstream providers, which are outside this app's control.

Use **Test Connection** to verify reachability + credentials (`GET /models`).

---

## 2. WebDAV — SPEC §5.1

Readest already ships a mature, built-in WebDAV file-sync provider
(`src/services/sync/providers/webdav/`) that is a superset of the OpenReadest
implementation the SPEC referenced: it runs on the shared file-sync engine
alongside S3 and Google Drive, with per-category toggles, replica-based
conflict resolution, soft-delete tombstones, and encrypted credential sync.
The SPEC's "port the enhanced OpenReadest WebDAV" item is therefore satisfied by
retaining and reusing this existing implementation rather than importing older
fork code.

Configure it in **Settings → Integrations → Library Sync → WebDAV**:

- User-configured server URL + remote root path, HTTP Basic auth.
- Upload/download with remote directory initialization (`MKCOL` walk).
- Change detection via ETag/`PROPFIND` last-modified.
- Per-field last-write-wins merge; `409` surfaced as a conflict.
- Deletion propagation via replica `deleted_at_ts` tombstones.
- Manual and automatic sync (`strategy: prompt | silent | send | receive`).
- Structured errors (`AUTH_FAILED`, `NOT_FOUND`, `NETWORK`, `CONFLICT`, …).

HTTPS is the expected default. HTTP is permitted only for explicitly configured
private-LAN hosts; the UI warns that credentials and content may be transmitted
without encryption.

---

## 3. OReader / KOReader Sync (KOSync) — SPEC §5.2, §14

The "OReader" integration is the KOReader progress-sync client
(`src/services/sync/KOSyncClient.ts`). Configure it in **Settings →
Integrations → Reading Sync → KOReader**. Point it at your own
`koreader-sync-server` (or compatible) instance on the KOReader LAN host. There
is **no default and no fallback to any official Readest endpoint** — the server
URL defaults to empty and must be set by the user.

### Protocol

- **Version header:** `Accept: application/vnd.koreader.v1+json`.
- **Endpoints:**
  - `POST /users/create` — register (first connect if the account is absent).
  - `GET  /users/auth` — verify credentials.
  - `GET  /syncs/progress/{documentHash}` — fetch progress for a book.
  - `PUT  /syncs/progress` — push `{ document, progress, percentage, device, device_id }`.
- **Authentication:** `X-Auth-User` + `X-Auth-Key`, where `X-Auth-Key = md5(password)`;
  HTTP Basic is used as a fallback when the server answers `401/400`.
- **Transport:** LAN servers are called directly; on the web build a non-LAN
  server is routed through the `/api/kosync` proxy, which allowlists only the
  three endpoints above and SSRF-guards the target host.

### Identifiers and timestamps

- **Book matching** uses a stable **binary MD5 content fingerprint**
  (`getDocumentDigest` → `book.hash`), matching KOReader's binary checksum mode.
  Filename-only matching is **not** used (the legacy `filename` option is
  ignored with a warning and falls back to the binary hash).
- Progress is a KOReader position string plus a `percentage` in `[0,1]`.

### Conflict behavior

- Governed by the shared conflict `strategy` (same vocabulary as WebDAV):
  `prompt` (ask on conflict), `silent` (take the most recently updated valid
  position), `send` (push only), `receive` (pull only). This implements the
  SPEC §5.4 progress rule: the most recently updated valid position wins.

### KOReader interoperability limitations

- The KOReader sync protocol covers **reading progress only**. It has **no
  endpoints for bookmarks or annotations/highlights**, so those are not
  interoperable over KOSync. Bookmarks, highlights, and annotations sync through
  the file-sync providers (WebDAV/S3/Google Drive) instead.
- Progress interop depends on both clients computing the **same binary MD5**
  over the same file. A book imported in a different format/edition (or
  re-encoded) will not match across clients.

---

## 4. Synchronization ownership and conflicts — SPEC §5.3 / §5.4

To avoid uncontrolled dual writes when more than one provider is active, the
default ownership is:

- **WebDAV / S3 / Google Drive** (one active library-sync provider at a time,
  chosen in **Library Sync**): book files, library metadata, application
  backup, and — because they run the full replica engine — bookmarks,
  annotations, and progress.
- **OReader (KOSync):** interoperable **reading progress** with KOReader.

Where categories overlap (progress can be written by both an active file-sync
provider and KOSync), writes are reconciled rather than blindly duplicated:
progress converges on the most-recently-updated valid position, independent
annotations/bookmarks merge by stable id with tombstoned deletions, and
concurrent edits of the same item preserve both versions or surface a conflict
per the selected `strategy`. Synchronization never silently discards local or
remote annotations, and sync failures are surfaced without blocking local
reading.

Recommendation: pick a single library-sync provider, and enable KOSync only if
you specifically want KOReader progress interop.
