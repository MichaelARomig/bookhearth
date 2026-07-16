# TODOS

## Post-detach feature work — Bookhearth (2026-07-16)

- [x] Translation providers: restored **DeepL** as a user-keyed provider (own
      key; `:fx` → free endpoint, else Pro; direct, no Readest proxy). Added
      per-provider enablement (`settings.translation`) with a "Translation
      Providers" settings section: Google/Azure/Yandex on by default, DeepL off
      until keyed, LiteLLM via its own endpoint gate. Default selected provider
      is now `google`. Tests + committed/pushed (488683d6).
- [x] WebDAV **multiple named server profiles**: `WebDAVProfile[]` +
      `activeProfileId`; active profile mirrored onto the top-level connection
      so the sync engine/client are unchanged. Pure helper
      (`providers/webdav/profiles.ts`) + tests; WebDAVForm gets a Saved Servers
      selector (add/rename/remove/switch), with legacy-singleton migration.
- [x] WebDAV **TLS/HTTP security settings**: `allowInsecureTls` (self-signed/
      insecure certs **allowed by default**; toggle off for strict TLS — wired
      into the client's `danger` fetch option) and `warnOnPlainHttp` (warning
      **off by default**; when on, warns on `http://`). Tests for TLS injection.

## Backlog — iOS/iPad UI verification (Xcode)

- [ ] Run `pnpm tauri ios build` (and/or launch the iOS simulator) to confirm
      the app compiles + renders on iPhone 15 Pro Max / iPad Pro, then visually
      check the new/changed settings surfaces on device: Integrations → AI
      (LiteLLM), Language → Translation Providers (+ DeepL key), WebDAV Saved
      Servers + Security toggles. Adjust element layout/formatting for the
      narrower iPhone width where needed. (User has Xcode running; do this after
      the folder rename to `bookhearth`.)

## Build + verification (2026-07-10)

- [x] Frontend production build: `pnpm build` (Next.js → Tauri export) compiles,
      type-checks, and static-exports all routes successfully.
- [x] Rust backend: `cargo check --lib` clean (exit 0, warnings only) after
      `git submodule update --init --recursive` (the env was missing the tauri
      fork + webview-upgrade/qcms/OpenCC submodules — a setup gap, not code).
- [x] Full JS suite green: 515 files / 7082 tests. `tsgo --noEmit` clean.
      `biome lint .` clean (1619 files).
- [x] SPEC acceptance criteria 1–17 satisfied (see slice notes below); Phase 7
      packet capture with default settings remains the one manual step.

## Local-first commercial cleanup (2026-07-09)

- [x] Slice 1: telemetry off, Discord RPC gone, Sentry already absent, clear
      PostHog/Supabase/Stripe `.env` defaults, no tauri fallback to
      `web.readest.com`, empty updater endpoints, CSP/capability commercial host
      trim, delete `processDiscordCover`.
- [x] Slice 2 (partial): unlimited app translation quota, safe Stripe/supabase
      when unconfigured, auth routes already disabled.
- [x] Slice 2 (remaining): deleted `src/libs/payment/*` and its dedicated tests,
      plus the orphaned subscription UI (`Checkout`, `Plan*`,
      `PurchaseCallToActions`, `UserInfo`, `useAvailablePlans`, `user/utils/plan`,
      `utils/iap`, `types/payment`). Disabled Stripe/IAP API routes kept as 410
      stubs; their tests trimmed of now-vestigial `libs/payment` mocks. Full
      suite green (7048 tests), tsgo + biome clean.
- [x] Slice 3: LiteLLM TTS + translation.
      — Shared config: `LiteLLMSettings` (`settings.litellm`) — enabled, baseUrl,
        apiKey, customHeaders, ttsModel, ttsVoice, translationModel, timeoutMs;
        `DEFAULT_LITELLM_SETTINGS` disabled/blank (opt-in).
      — Shared client `src/services/litellm/`: config gate, header assembly,
        timeout-bounded `litellmFetch` (composes external abort signal, routes
        through platform fetch), `testLiteLLMConnection` (GET /models). Bodies
        and headers never logged.
      — Translation: `providers/litellm.ts` via `/chat/completions` (per-line
        parallel, temperature 0, auto-detect source). Registered + made the
        default `translationProvider`. `disabled` getter reflects config so the
        UI greys it out and `useTranslator` falls back to Google when unset.
      — DeepL removed entirely: deleted `providers/deepl.ts`,
        `src/pages/api/deepl/*`, `src/utils/deepl.ts` + tests, and
        `ErrorCodes.DEEPL_API_ERROR`.
      — TTS: `LiteLLMTTSClient` via OpenAI-compatible `/audio/speech`, reusing
        WebAudioPlayer (decode→trim→WSOLA→gapless), sentence granularity (no
        word boundaries), pause/resume/stop/cancel, bounded in-memory MP3 cache
        (clearable). Wired into `TTSController` (field/init/getVoices/setVoice/
        setPrimaryLang); only selected by an explicit LiteLLM voice so enabling
        the endpoint never hijacks the Edge/Web default.
      — UI: `IntegrationsPanel` → "AI Services" → `LiteLLMForm` sub-page
        (endpoint, key, models, voice, timeout, custom-headers JSON, Test
        Connection).
      — Tests: `services/litellm/litellm-client`, `translators/litellm-provider`,
        `tts/litellm-tts-client`. Full suite green (7075 tests), tsgo + biome
        clean.
- [x] Slice 4: WebDAV / OReader — verified + documented (no re-architecture).
      — WebDAV: Readest's built-in file-sync WebDAV provider
        (`src/services/sync/providers/webdav/`) is a superset of OpenReadest's
        (shared file-sync engine, per-category toggles, replica LWW conflict
        resolution, tombstone deletes, encrypted credential sync, structured
        errors). SPEC §5.1 satisfied by retaining it; the OpenReadest port is a
        no-op. Only "SHOULD"-level gaps remain (client-side temp+rename staging,
        `If-Match` on PUT) — deferred as low-value against a mature impl.
      — OReader = KOSync (`src/services/sync/KOSyncClient.ts`): user-configured
        server, no official fallback (empty default), binary-MD5 fingerprint
        (not filename), `vnd.koreader.v1+json`, X-Auth-User/Key (+Basic
        fallback). Protocol/auth/identifiers/conflict/interop-limits documented.
      — KOReader protocol is progress-only (no bookmark/annotation endpoints);
        those sync via the file providers. Documented as an interop limitation.
      — Sync ownership (§5.3) + conflict policy (§5.4): documented; reconciled by
        the existing replica LWW + tombstone + strategy engine (no dual-write
        re-architecture needed).
- [x] Network-boundary test (SPEC §8): `services/network-boundary.test.ts` —
      empty native API base, all providers disabled by default, no prefilled
      official/public URLs, LiteLLM gate closed. (Phase 7 packet capture remains
      a manual step.)
- [x] Docs: `docs/local-first-services.md` — WebDAV / OReader(KOSync) / LiteLLM
      setup, protocol, ownership, and KOReader limitations (SPEC §5.2, §14,
      Phase 7).

## Readest integration backlog additions (2026-07-09)

- [x] Retain and regression-test OPDS catalog setup, authenticated catalog access,
      browsing, and downloads in the local-first build, including the
      Calibre-compatible / Calibre Web behaviors already covered by current
      Readest support. (M)
      — Client path: `src/__tests__/app/opds/calibre-live.integration.test.ts`.
      — UI e2e: `e2e/tests/calibre-opds.spec.ts` (Playwright + live calibre-server).
- [x] Standardize Calibre integration on Calibre Content Server / Calibre-Web
      OPDS catalogs (`/opds` / `/opds/index.xml`) and regression-test root
      discovery, search links, pagination, Basic Auth, relative URLs, and
      acquisition downloads. Treat `apps/readest-calibre-plugin/` as non-goal
      legacy code unless a later requirement reopens it. (M)
      — Docs in `docs/calibre-opds.md`. Fixed search templates + preemptive Basic
      for covers/downloads on web proxy. Plugin remains legacy.
- [x] Make Groups / Collections creation obvious from the main library UI in
      unauthenticated and local-only flows. (M)
      — Empty state + Import (+) menu expose **Import into Collection**; select-mode
      bar still offers Collection for re-shelving. User-facing labels unified to
      "Collection" (GroupHeader default, folder-import copy). Internal IDs remain
      `group*`.
- [x] Add UI / regression coverage that a fresh local-only install can discover
      and use Groups / Collections creation without visiting auth, account, or
      premium-related surfaces. (S)
      — `library-empty-state.test.tsx`, `import-menu.test.tsx`,
      `create-collection-dialog.test.tsx`, `group-header.test.tsx`.

## Cloud Sync provider selection follow-ups (deferred by /autoplan, 2026-07-06)

Deferred from the Cloud Sync provider-selection plan (#4959/#4380). See the
Decision Audit Trail in the plan for reasoning.

- [ ] Pre-switch "download all Readest Cloud books" affordance so a fresh device
      gets full library completeness when a third-party provider is selected. (S)
- [ ] Library-page sync-status indicator for the active third-party provider
      (fileSyncStore already exposes aggregate progress). (S)
- [ ] Account page active-provider chip. (XS)
- [ ] File-engine parity: reading stats + per-book viewSettings sync via the
      file layout (readingStatus/tags parity shipped as its own PR). (M)
- [ ] Server-side quota error code (`code: 'quota_exceeded'`, mirroring the share
      import route) so the client stops string-matching 'Insufficient storage
      quota'; message drift silently restores retry behavior. (S)
- [ ] Pre-existing: Manage Sync "Books" category gates metadata rows but NOT
      binary uploads to Readest Cloud (`queueUpload` never consults
      `isSyncCategoryEnabled('book')` despite the category docs claiming it) —
      align behavior or docs. (S)
- [ ] Sentry `cloudSyncProvider` tag: Sentry tagging is Rust-mediated
      (`set_webview_info` pattern in `sentry_config.rs`); add a
      `set_cloud_sync_provider` command + before_send tag so sync-related
      reports carry the active provider. Console log lines ship in the
      meantime. (S, needs src-tauri)

Deferred items from the Edge TTS Web Audio plan review (/autoplan, 2026-07-04).
Each was explicitly deferred, not forgotten — see the Decision Audit Trail in
`.agents/plans/2026-07-03-edge-tts-webaudio.md`.

## TTS listening engine follow-ups

- [ ] Cross-section gapless playback: preload and schedule the next section's first
      sentence so chapter boundaries are as seamless as sentence boundaries. (M)
- [ ] Lock-screen ±10s seek offsets in addition to prev/next sentence. (S)
- [ ] Persist measured sentence durations per book so a reopened chapter starts
      with an exact timeline instead of estimates. (S)
- [ ] Worker offload for decode + WSOLA if device profiling shows main-thread jank
      on low-end Android. (S)
- [ ] Provider-agnostic voice source hedge: local neural TTS (e.g. Piper/Kokoro
      WASM) plugging into WebAudioPlayer/SectionTimeline — the engine is designed
      for this; see "Strategic framing" in the plan. (L)
- [ ] Background chapter prefetch (convert timeline estimates to exact durations
      ahead of playback). (M)
