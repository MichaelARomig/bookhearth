# App icon sources

## `readest-book.png` — the icon source master

`readest-book.png` is the **1024×1024 source master** that native icons are
regenerated from. **The filename is kept from upstream on purpose** — it is an
internal build input (never shown to users) and is referenced by CI
(`.github/workflows/{release,nightly,android-e2e}.yml`), `flake.nix`, and `apps/readest-app/scripts/worktree-new.ts`. Renaming it
would break those; the *image* is what was rebranded, not the name.

As of 2026-10-03 this file holds the **BookHearth stone-arch** logo (teal
`#09252D` background, glowing open book under a stone arch). It is the 1024px
master from the BookHearth icon pack (`BookHearth.png`). The pack itself is
**intentionally not committed** — only the derived assets the app actually
needs live in the repo. (History: Readest logo → green IconKitchen book,
2026-07-16 → stone arch, 2026-10-03.)

> **CI depends on this file.** Android release/nightly/e2e builds run
> `rm -rf src-tauri/gen/android && tauri android init && tauri icon
> ../../data/icons/readest-book.png && git checkout .` — so the *untracked*
> launcher mipmaps (`ic_launcher`, `ic_launcher_round`,
> `ic_launcher_foreground`) in shipped APKs are generated from this master, not
> from anything committed under `gen/`. If this file is stale, Android ships the
> old icon no matter what else is committed.

## How the app icons are (re)generated

1. **Native icons** (desktop `.ico`/`.icns`/`.png`, Windows `Square*Logo`, iOS
   `src-tauri/icons/ios/` set, Android `gen/` launcher mipmaps) — from this
   master:

   ```bash
   cd apps/readest-app
   pnpm tauri icon ../../data/icons/readest-book.png
   git checkout -- src-tauri/gen   # restore tracked Android customizations
   ```

   `tauri icon` (CLI 2.11) overwrites the tracked adaptive-icon XML
   (`gen/android/.../mipmap-anydpi-v26/ic_launcher.xml`, which carries the
   `<monochrome>` themed-icon layer + 22% inset foreground) and writes
   `values/ic_launcher_background.xml` as **`#fff`**. Both are tracked
   customizations, so `git checkout` restores them — CI does the same with
   `git checkout .`. Guarded by `src/__tests__/android/themed-icon.test.ts`.

   `tauri icon` does **not** write `src-tauri/icons/android/` (a source copy
   only — nothing in the build reads it) and does **not** regenerate the
   `ic_launcher_monochrome.png` mipmaps.

2. **Tracked Android customizations under `gen/`** (force-added past the
   `src-tauri/gen` .gitignore):
   - `mipmap-anydpi-v26/ic_launcher.xml` — adaptive icon, 22% inset + monochrome.
   - `mipmap-*/ic_launcher_monochrome.png` — themed-icon silhouette (white on
     alpha), BookHearth arch as of 2026-10-03.
   - `values/ic_launcher_background.xml` — adaptive background
     **`#FF09252D`** (the master's teal). Tracked as of 2026-10-03 so the 22%
     inset blends into the icon instead of showing a white ring (`tauri icon`'s
     `#fff` default).
   - `drawable/splash_icon.png` + `drawable/splash_background.xml` — 120dp
     splash; background is `#FF09252D` so the opaque teal icon blends in.

3. **Web / PWA icons** — `tauri icon` does **not** cover these. They are copied
   directly into `apps/readest-app/public/`: `favicon.ico`,
   `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
   `icon-192-maskable.png`, `icon-512-maskable.png`, `icon.png` (in-app logo)
   and `icon-tiny.png` (224×182). The PWA `manifest.json` references the
   `icon-*` set.

4. **Other surfaces** (copied directly): browser extension
   `extensions/send-to-readest/icons/icon-{16,32,48,128,256}.png`, Calibre
   plugin `apps/readest-calibre-plugin/images/icon.png`, TTS notification
   `src-tauri/plugins/tauri-plugin-native-tts/.../drawable/notification_icon.png`,
   and the store icon `fastlane/metadata/android/en-US/images/icon.png`
   (`fastlane/metadata-play/...` is a symlink to it).

5. **iOS asset catalog**: `src-tauri/gen/apple/Assets.xcassets` (referenced by
   `gen/apple/project.yml`) is **tracked** (force-added past the `gen/`
   .gitignore) as of 2026-10-03. `tauri icon` neither creates nor refreshes
   it, so when icons change, copy `src-tauri/icons/ios/AppIcon-*.png` into
   `AppIcon.appiconset/`. The filenames match one to one.
