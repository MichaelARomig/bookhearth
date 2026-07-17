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

## Backlog — "Send to Bookhearth" (web clipping) needs work

- [ ] The **Send-to** feature (browser extension + inbound email → library) is
      **hidden in the app for now**: its Integrations settings entry was removed
      (`IntegrationsPanel` — the `'send'` sub-page, its `IntegrationRow`, and the
      `requestedSubPage === 'send'` path). The whole flow is coupled to the hosted
      backend that the local-first build strips: the extension's auth-bridge reads
      the session from `web.readest.com` and uploads go to the Supabase/R2-backed
      send-inbox API (`src/pages/api/send/*`, `workers/send-email`). It is
      non-functional without that backend.
      - Left in place but unsurfaced (not deleted): `SendToReadestForm`, the
        `/send` route (`src/app/send/page.tsx`), `useInboxDrainer`, and the
        `apps/readest-app/extensions/send-to-readest` browser extension. The
        extension is still branded "Send to Readest" — rebranding it is **out of
        scope** for the current work.
      - To revive: either stand up a self-hosted inbox backend and repoint the
        extension/auth-bridge, or replace it with a purely local capture path
        (e.g. share-sheet → direct import) needing no server. Then re-add the
        Integrations entry and rebrand the extension → Bookhearth.

## Backlog — app icons + branding

- [x] **Done (2026-07-16):** regenerated native icons via
      `pnpm tauri icon IconKitchen-Output/ios/AppIcon~ios-marketing.png` (1024px
      master) → rewrote `src-tauri/icons/*` (desktop `.ico`/`.icns`/`.png`,
      Android mipmaps, iOS AppIcon set). Copied `IconKitchen-Output/web/*` into
      `public/` (favicon.ico, apple-touch-icon.png, icon-192/512[-maskable].png)
      and repointed `public/icon.png` + the PWA `manifest.json` icon set. README
      logo now renders the regenerated `src-tauri/icons/icon.png`. `gen/`
      Xcode/Android icon copies refresh on the next `tauri ios/android build`.
      Restored the tracked customized Android adaptive-icon XML
      (`gen/android/.../mipmap-anydpi-v26/ic_launcher.xml`) after `tauri icon`
      clobbered it — it carries the `<monochrome>` themed-icon layer + 22% inset
      foreground (guarded by `themed-icon.test.ts`). Also replaced the tracked
      icon source master `data/icons/readest-book.png` (filename kept for
      CI/release/worktree parity — it's an internal build input) with the
      Bookhearth 1024 master so those regen paths stay on-brand. Provenance +
      regen steps documented in `data/icons/README.md`.
- [ ] **Follow-up:** the Android 13+ **themed (monochrome) launcher icon** still
      uses the old silhouette — `ic_launcher_monochrome.png` (all densities) is a
      tracked customization that `tauri icon` does NOT regenerate, and
      IconKitchen-Output shipped no monochrome source. Generate a Bookhearth
      monochrome/silhouette asset and replace those mipmaps to finish the Android
      themed-icon rebrand.
- [ ] Replace the app icons with the new set in `IconKitchen-Output/` (top level
      of the `ebook`/repo dir).
      - Regenerate native icons: `pnpm tauri icon <source>` using the 1024px
        master `IconKitchen-Output/ios/AppIcon~ios-marketing.png` (falls back to
        `android/play_store_512.png` at 512). This rewrites
        `apps/readest-app/src-tauri/icons/*` (desktop `.ico`/`.icns`/`.png`,
        Android mipmaps, iOS AppIcon set) — commit the regenerated files.
      - Web/PWA icons are NOT covered by `tauri icon`: copy
        `IconKitchen-Output/web/*` (favicon.ico, apple-touch-icon.png,
        icon-192/512[-maskable].png) into the app's `public/` + update the PWA
        manifest icon references if needed.
      - Update the README logo: `apps/readest-app/README.md` / root `README.md`
        `<img src=...icon.png>` currently points at
        `github.com/readest/readest/.../src-tauri/icons/icon.png` with alt
        "Readest Logo" — repoint to the Bookhearth repo icon and update alt text.
      - Best done alongside / after the `readest`→`bookhearth` rename so paths
        and repo URLs land in one pass.

## Backlog — iOS/iPad UI verification (Xcode)

- [x] **iOS simulator build is GREEN (2026-07-16):**
      `pnpm exec tauri ios build --target aarch64-sim` builds
      `gen/apple/build/arm64-sim/Bookhearth.app` on Xcode 26.6 / iOS 26.5 SDK.
      Required fixes/prereqs discovered:
      - **Committed the missing main-app `Info.plist`** (`gen/apple/Readest_iOS/
        Info.plist`, force-added past the `src-tauri/gen` gitignore). It was a
        hand-tuned, gitignored, never-committed file, so a clean clone could not
        build iOS at all — pre-existing gap, not a rename side-effect. Built from
        `src-tauri/Info.plist` + standard iOS keys + `readest://`/Google-OAuth URL
        schemes + 34 locales; CFBundleDisplayName = Bookhearth.
      - Rebranded the Share Extension + Widget `CFBundleDisplayName` → Bookhearth
        (user-facing in the share sheet / widget gallery), in `project.yml` + the
        tracked generated plists.
      - Toolchain prereqs (installed on this machine, not committable): full Xcode
        selected (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`),
        iOS Rust targets (`rustup target add aarch64-apple-ios{,-sim} x86_64-apple-ios`),
        `libimobiledevice`, and CocoaPods (`brew install cocoapods`).
      - **PATH gotcha:** Homebrew's `rust` puts `/opt/homebrew/bin/cargo` ahead of
        rustup's `~/.cargo/bin/cargo`; Homebrew rust has no iOS std → build fails
        with "can't find crate for std (aarch64-apple-ios-sim)". Fix: `brew unlink
        rust` or put `~/.cargo/bin` first on PATH (worked around per-build with a
        PATH prefix).
      - Follow-up (App Store only): extension `CFBundleShortVersionString` is `1.0`
        vs the app's `0.11.18` — Xcode warns they must match; align before store
        submission.
- [x] **Sideload build for a free Apple account (2026-07-16):** `pnpm build-ios-sideload`
      (`scripts/build-ios-sideload.sh`) produces an unsigned device
      `.ipa` at `gen/apple/build/Bookhearth-unsigned.ipa` to install via
      Sideloadly (re-signs with your Apple ID, sets bundle id, strips free-tier
      entitlements). Full walkthrough + the "why" in
      [`docs/ios-sideload-build.md`](docs/ios-sideload-build.md). Rebuild weekly
      (free-team installs expire after 7 days).
- [ ] Visually verify on device/simulator (this still needs a human): confirm
      the app renders on iPhone 15 Pro Max / iPad Pro, then check the new/changed
      settings surfaces on device: Integrations → AI
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
