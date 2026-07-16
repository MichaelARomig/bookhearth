# App icon sources

## `readest-book.png` — the icon source master

`readest-book.png` is the **1024×1024 source master** that native icons are
regenerated from. **The filename is kept from upstream on purpose** — it is an
internal build input (never shown to users) and is referenced by CI
(`.github/workflows/*.yml`), the release pipeline, `ops/flake.nix`, and
`apps/readest-app/scripts/worktree-new.ts`. Renaming it would break those; the
*image* is what was rebranded, not the name.

As of 2026-07-16 this file holds the **Bookhearth** logo (previously the Readest
logo). The master is the `ios/AppIcon~ios-marketing.png` from a
[IconKitchen](https://icon.kitchen) export of the Bookhearth logo. The full
IconKitchen export folder is **intentionally not committed** — only the derived
assets the app actually needs live in the repo.

## How the app icons are (re)generated

1. **Native icons** (desktop `.ico`/`.icns`/`.png`, Android mipmaps, iOS AppIcon
   set) — from this master:

   ```bash
   cd apps/readest-app
   pnpm tauri icon ../../data/icons/readest-book.png
   ```

   Then restore the tracked Android customization that `tauri icon` overwrites —
   the adaptive-icon XML (`gen/android/.../mipmap-anydpi-v26/ic_launcher.xml`,
   which carries the `<monochrome>` themed-icon layer + 22% inset foreground) and
   the `ic_launcher_monochrome.png` mipmaps. CI does this with `git checkout .`
   after regenerating. Guarded by `src/__tests__/android/themed-icon.test.ts`.

2. **Web / PWA icons** — `tauri icon` does **not** cover these. They come from
   the IconKitchen `web/` export and are copied directly into
   `apps/readest-app/public/`: `favicon.ico`, `apple-touch-icon.png`,
   `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`,
   `icon-512-maskable.png`, and `icon.png` (the in-app logo). The PWA
   `manifest.json` references the `icon-*` set.

## Known follow-up

The Android 13+ **themed (monochrome)** launcher mipmaps
(`ic_launcher_monochrome.png`) are still the old silhouette — IconKitchen shipped
no monochrome source and `tauri icon` does not regenerate them. A Bookhearth
monochrome/silhouette asset is needed to finish that surface (see `TODOS.md`).
