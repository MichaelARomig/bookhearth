# Readest Integration Discovery

Status: local working notes
Date: 2026-07-09 (updated)
Working tree: `readest`

## Baseline

- Target codebase: `readest` at local checkout state matching upstream `readest/readest`
- Pinned baseline revision: `02e972f65629a8e92703d12254a7de8c23b477a2`
- Reference fork: `OpenReadest` at `95545690fe45fe66f8d0f7e7b5bdb19f7523cd78`
- Local KOReader-compatible sync service repo: `korest` at `a7aaa86eaa743b91989238ba8996ff5d17298cfc`

The user explicitly requested local-only work in this tree. No upstream repo management is part of this effort.

## Initial local changes already applied

- `src/services/constants.ts`
  - `DEFAULT_KOSYNC_SETTINGS.serverUrl` changed from a public default to `''`
  - `DEFAULT_SYSTEM_SETTINGS.telemetryEnabled` changed from `true` to `false`
  - `DEFAULT_SYSTEM_SETTINGS.autoUpload` changed from `true` to `false`
- React runtime telemetry has been neutralized:
  - `src/context/PHContext.tsx` is now a pass-through provider
  - `src/utils/telemetry.ts` no longer emits PostHog events
  - `src/components/Providers.tsx` now forces local telemetry opt-out and no longer renders the consent dialog
  - `src/context/AuthContext.tsx`, `src/app/error.tsx`, and `src/libs/payment/stripe/client.ts` no longer send PostHog events
- Local account/subscription surfaces have started to be replaced:
  - `src/app/user/page.tsx` is now a local `Services & Sync` page instead of an account/billing hub
  - `src/app/library/components/SettingsMenu.tsx` no longer exposes Sign In, Account, or Premium upgrade entries
  - `src/components/settings/IntegrationsPanel.tsx` no longer exposes the `Readest Cloud` row and no longer labels third-party sync as premium
- Hosted auth and billing entry points are now inert:
  - `src/app/auth/` routes now render local-disabled notices instead of Supabase auth UI
  - `src/app/user/subscription/success/page.tsx` now renders a disabled billing notice
  - `src/app/api/stripe/`, `src/app/api/apple/`, and `src/app/api/google/` payment / IAP routes now return explicit disabled responses
  - `src/utils/nav.ts` now routes legacy login / password navigation helpers to `/user`
- Third-party file sync is now explicitly ungated in `src/utils/access.ts`

## Immediate conclusions

1. `readest` already contains a newer provider-agnostic file-sync architecture.
   Relevant files:
   - `src/services/sync/file/engine.ts`
   - `src/services/sync/file/merge.ts`
   - `src/services/sync/file/wire.ts`
   - `src/services/sync/providers/webdav/WebDAVProvider.ts`
   - `src/services/sync/providers/gdrive/`
   - `src/services/sync/providers/s3/`

2. `OpenReadest` WebDAV should be treated as a feature reference, not an architectural base.
   Relevant files:
   - `OpenReadest/apps/openreadest-app/src/services/webdav/`
   - `OpenReadest/apps/openreadest-app/src/store/webdavStore.ts`
   - `OpenReadest/apps/openreadest-app/src/__tests__/webdav/`

3. The current `readest` sync engine already has several behaviors the spec requires:
   - provider abstraction
   - local-first state
   - merge logic for notes and config state
   - library index with tombstone-aware semantics
   - WebDAV backend tests for deletion, timeouts, and directory listing

4. The current `KOSync` implementation and the local `korest` repo are not a full match for the spec’s `OReader` requirement.
   - `src/services/sync/KOSyncClient.ts` currently syncs reading progress only.
   - `korest/index.js` implements `/users/create`, `/users/auth`, `/syncs/progress`, and stores progress only.
   - If the final target must sync bookmarks, annotations, and deletions through an OReader-compatible service, that will require a separate protocol/service target beyond current `korest`.

## Current architecture relevant to the spec

### Reading formats and local state

The current app still appears to support the required local reading formats and book state model.

- Supported formats are listed in `src/services/constants.ts`:
  - `epub`
  - `mobi`
  - `azw`
  - `azw3`
  - `fb2`
  - `zip`
  - `cbz`
  - `pdf`
  - plus extra local formats (`txt`, `md`)
- Reading state types live under `src/types/book.ts`
- Local app settings and sync provider settings live in `src/types/settings.ts`

### Existing sync surfaces

Current sync-related code is split across two systems:

1. File-sync backends for books, config, notes, covers, and related replicated state.
   - `src/services/sync/file/`
   - `src/services/sync/providers/webdav/`
   - `src/services/sync/providers/gdrive/`
   - `src/services/sync/providers/s3/`

2. KOReader sync for reading progress only.
   - `src/services/sync/KOSyncClient.ts`
   - `src/components/settings/integrations/KOSyncForm.tsx`
   - `src/app/reader/hooks/useKOSync.ts`

Important current defaults:

- `DEFAULT_KOSYNC_SETTINGS.serverUrl` is now blank
- `DEFAULT_SYSTEM_SETTINGS.autoUpload` is now `false`
- `cloudSyncProvider.ts` still models native `Readest Cloud` as the derived fallback provider internally, but the main settings surfaces no longer present it as the preferred user path
- third-party file sync is now ungated in `src/utils/access.ts`

### Existing AI/TTS/translation surfaces

There are two distinct AI-related areas:

1. Notebook/embedding/chat configuration already supports a generic OpenAI-compatible endpoint shape.
   Relevant files:
   - `src/services/ai/types.ts`
   - `src/services/ai/constants.ts`
   - `src/components/settings/AIPanel.tsx`
   - `src/services/ai/providers/OpenRouterProvider.ts`

2. Reader translation and TTS are separate systems.
   Relevant files:
   - TTS:
     - `src/services/tts/TTSController.ts`
     - `src/services/tts/EdgeTTSClient.ts`
     - `src/services/tts/NativeTTSClient.ts`
     - `src/services/tts/WebSpeechClient.ts`
     - `src/app/api/tts/edge/route.ts`
   - Translation:
     - `src/services/translators/providers/deepl.ts`
     - `src/pages/api/deepl/translate.ts`
     - `src/services/translators/providers/google.ts`
     - `src/services/translators/providers/azure.ts`
     - `src/services/translators/providers/yandex.ts`

Important current defaults and constraints:

- Translation defaults to `deepl` in `src/services/constants.ts`
- `DeepL` currently goes through `src/pages/api/deepl/translate.ts`
- TTS currently includes:
  - local/native voices
  - Web Speech
  - Edge TTS
- `app/api/tts/edge/route.ts` no longer requires authenticated user context
- `src/pages/api/deepl/translate.ts` and `src/services/translators/providers/deepl.ts` no longer require an authenticated user for translation requests, but they still depend on direct DeepL-style vendor routes and are not yet LiteLLM-backed

## Confirmed commercial / non-goal surfaces to remove or replace

### Official account and cloud

These are direct candidates for removal or replacement:

- Supabase auth client and session handling:
  - `src/utils/supabase.ts`
  - `src/context/AuthContext.tsx`
  - `src/app/auth/`
- Current local hardening state:
  - the visible auth routes have been replaced with disabled notices
  - deeper auth client code still exists and needs a later cleanup pass
- Native cloud selection and plan gating:
  - `src/services/sync/cloudSyncProvider.ts`
  - `src/services/cloudService.ts`
- Embedded official defaults:
  - `.env`
  - `.env.local.example`
  - `src/services/environment.ts`
  - `src/services/constants.ts`

Additional likely scope:

- `apps/readest-calibre-plugin/` currently targets official Readest cloud and Supabase auth; it does not match the local-first target and should not define the Calibre integration direction for this workspace
- `apps/readest.koplugin/` contains official Readest sync/auth artifacts alongside KOReader integration history

### Subscriptions, premium checks, payments

Confirmed payment and entitlement code exists in:

- `src/libs/payment/stripe/`
- `src/app/api/stripe/`
- `src/app/api/apple/`
- `src/app/api/google/`
- `src/types/payment.ts`
- `src/types/quota.ts`
- `src/utils/access`
- `src/components/settings/integrations/cloudSyncStatus.ts`
- `src/services/transferManager.ts`

Current local hardening state:

- the public Next.js payment / IAP routes now return disabled responses
- client libraries and server helper modules under `src/libs/payment/` still remain and need follow-up removal

There are also app-store/native bridge purchase surfaces in:

- `src-tauri/plugins/tauri-plugin-native-bridge/`

### Telemetry and remote error reporting

Confirmed telemetry/error reporting surfaces:

- PostHog:
  - `src/context/PHContext.tsx`
  - `src/utils/telemetry.ts`
  - `src/components/Providers.tsx`
  - `src/components/TelemetryConsentDialog.tsx`
- Sentry:
  - `src-tauri/src/sentry_config.rs`
  - `src-tauri/src/lib.rs`
  - `src-tauri/Cargo.toml`
  - `src-tauri/build.rs`
- Network allowlists for telemetry and reporting:
  - `src-tauri/tauri.conf.json`
  - `src-tauri/capabilities/default.json`

Telemetry default (updated 2026-07-09):

- `DEFAULT_SYSTEM_SETTINGS.telemetryEnabled` is now `false` in
  `src/services/constants.ts`
- `Providers.tsx` forces opt-out even if a settings blob has it enabled
- `PHContext` is a no-op pass-through

### Discord Rich Presence

**Removed from this tree** (2026-07-09 verification):

- `src/utils/discord.ts` — gone
- `src/hooks/useDiscordPresence.ts` — gone
- `src-tauri/src/discord_rpc.rs` — gone

Residual only:

- `processDiscordCover` helper still in `src/utils/image.ts` (+ tests) — dead
  cover-processing utility; safe to delete in a cleanup pass
- Community Discord invite link in `SupportLinks.tsx` (not Rich Presence)

## Network boundary findings

The current app still contains multiple official and third-party outbound defaults that conflict with the target spec.

Confirmed official Readest-hosted or vendor-hosted endpoints:

- `web.readest.com`
- `node.readest.com`
- `download.readest.com`
- `storage.readest.com`
- embedded Supabase defaults in `.env`
- embedded PostHog defaults in `.env`
- DeepL API endpoints in `src/pages/api/deepl/translate.ts`
- Sentry/PostHog/Stripe allowlists in `src-tauri/tauri.conf.json`

This means a later hardening pass must cover both:

1. runtime code paths
2. static config and CSP/capability allowlists

## OpenReadest WebDAV findings

`OpenReadest` has a standalone WebDAV subsystem with:

- profile management
- conflict strategy settings
- sync state files
- insecure HTTP / insecure TLS options
- dedicated WebDAV tests

Key files:

- `OpenReadest/apps/openreadest-app/src/services/webdav/models.ts`
- `OpenReadest/apps/openreadest-app/src/services/webdav/client/WebDavClient.ts`
- `OpenReadest/apps/openreadest-app/src/services/webdav/sync/engine.ts`
- `OpenReadest/apps/openreadest-app/src/store/webdavStore.ts`

Porting strategy should be selective. The current `readest` engine already supersedes the old architecture in several areas, so likely imports are feature-level:

- connection-policy details
- remote browser behavior
- profile UX ideas
- any robustness missing from the new provider client

## Known spec gaps from current code

1. Local-only mode is not yet guaranteed.
   - Official service defaults and CSP allowlists are still present.

2. The app is not yet account-free.
   - Auth pages, Supabase client, and account-dependent routes remain.

3. Third-party sync is still tied to premium logic.
   - This conflicts with the spec requirement that sync not require subscriptions or premium checks.

4. Translation is still DeepL-based by default.
   - The spec requires LiteLLM-backed translation instead.

5. TTS is not LiteLLM-based.
   - Current remote TTS path is Edge-based and authenticated.

6. OReader-compatible sync breadth is not present in current local service reference.
   - `korest` covers progress only.

## Proposed implementation order

### Slice 1

Remove clearly non-goal integrations first:

- telemetry UI and runtime hooks
- Sentry integration
- Discord Rich Presence

This is the safest first code slice because it is explicit in the spec and mostly orthogonal to reading and sync behavior.

### Slice 2

Remove account, payment, premium, and official cloud dependencies:

- auth flows
- subscription and purchase routes
- native cloud provider selection
- plan gating around third-party sync

### Slice 3

Replace translation and TTS provider wiring with LiteLLM:

- shared endpoint config
- translation adapter
- speech adapter
- credential handling and connection tests

### Slice 4

Finalize sync behavior:

- retain and harden provider-based WebDAV in current architecture
- replace hard-coded KOSync/OReader defaults with user-controlled service config
- decide whether the actual target server is:
  - a broader OReader-compatible service, or
  - an extended local service beyond current `korest`

## Next decision points

Before the OReader work starts, confirm which service is the real sync target for non-progress entities:

- current `korest`
- another local OReader-compatible server
- a custom service to be added locally

Without that, progress sync can be adapted, but annotations/bookmarks/deletions cannot be completed to spec.

## Session progress (2026-07-09)

### Calibre / OPDS (done for client-path QA)

- Direction: standard Calibre Content Server / Calibre-Web OPDS only; custom
  push plugin is legacy (`apps/readest-calibre-plugin/` kept until UI sign-off).
- Dedicated doc: `docs/calibre-opds.md`
- Local fixture: `calibre-library/` + `calibre-server` with Basic Auth
  (`qa` / `qapass`, `http://127.0.0.1:8080/opds`)
- Live client-path suite:
  `src/__tests__/app/opds/calibre-live.integration.test.ts`
- **Bug fixed:** Atom path-style search templates
  (`/opds/search/{searchTerms}`) must expand **before** `resolveURL`; otherwise
  braces become `%7B…%7D` and calibre returns 404.
  - `expandOPDSSearchTemplate` recovers encoded braces
  - `page.tsx` handleSearch Atom branch navigates on typed terms like OPDS2

### Groups / Collections discoverability (done)

- Empty state + Import menu already had **Import into Collection**
- User-facing "Group" → "Collection" in `GroupHeader` and folder-import copy
- Tests: empty-state, import-menu, create-collection-dialog, group-header

### Slice 1 status refresh (updated later 2026-07-09)

| Item | Status |
|------|--------|
| Telemetry default off + no-op PostHog | done |
| Discord Rich Presence | fully removed (`processDiscordCover` deleted) |
| Sentry | already absent from `src-tauri` (no crate/module) |
| `.env` PostHog/Supabase/Stripe defaults | cleared for local-first |
| Tauri API base → `web.readest.com` fallback | **removed** (empty unless configured) |
| Updater endpoints (`download.readest.com`) | **cleared** |
| CSP / capability commercial host lists | trimmed (LAN wildcards kept for OPDS) |
| Stripe client without keys | safe no-op |
| Payment / IAP libs | still in tree; routes disabled |
| DeepL default translation | still default; LiteLLM not yet |

### Recommended next code slices

1. Payment/auth deep dead-code cleanup (Slice 2)
2. LiteLLM translation + TTS adapters (Slice 3)
3. WebDAV hardening vs OpenReadest feature gaps (Slice 4)
4. KOSync / OReader protocol decision
