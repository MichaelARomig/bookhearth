<div align="center">
  <img src="./apps/readest-app/src-tauri/icons/icon.png" alt="Bookhearth Logo" width="20%" />
  <h1>Bookhearth</h1>
  <br>

**Bookhearth** is a local-first, privacy-respecting ebook reader — a personal fork of
[Readest](https://github.com/readest/readest) with the hosted-service and commercial
layers stripped out and replaced by user-controlled integrations. It keeps Readest's
excellent reading engine (built on [Foliate](https://github.com/johnfactotum/foliate),
[Next.js](https://github.com/vercel/next.js), and [Tauri v2](https://github.com/tauri-apps/tauri))
and runs on macOS, Windows, Linux, Android, iOS, and the Web.

[![AGPL Licence][badge-license]](LICENSE)
[![Based on Readest][badge-upstream]](https://github.com/readest/readest)

</div>

<p align="center">
  <a href="#what-is-bookhearth">What is Bookhearth</a> •
  <a href="#how-bookhearth-differs-from-readest">Differences from Readest</a> •
  <a href="#a-note-on-naming-two-names-in-one-codebase">Naming</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#license--attribution">License & Attribution</a>
</p>

---

## What is Bookhearth

Bookhearth is a **downstream fork of [Readest](https://github.com/readest/readest)**,
re-shaped around a single principle: **everything the app does should stay on your own
devices or on services you control.** Where upstream Readest offers a hosted account,
subscription cloud, and first-party telemetry, Bookhearth removes those pieces and wires
the same features up to integrations you configure yourself — your own WebDAV server, S3
bucket, Google Drive, KOReader sync server, OPDS/Calibre catalog, translation API keys,
and OpenAI-compatible AI endpoints.

This is a personal project. It is **not** affiliated with or endorsed by the Readest team
or Bilingify LLC, and it is not distributed through Readest's app-store listings, website,
or donation channels. It exists so its author can read the way they want to, on their own
infrastructure. It is shared under the same AGPL-3.0 license as upstream.

## How Bookhearth differs from Readest

Bookhearth tracks upstream Readest closely (see [naming](#a-note-on-naming-two-names-in-one-codebase)
for why), but the following changes have been made on top of it:

**Removed — hosted & commercial surfaces**

- First-party **telemetry disabled**; Discord Rich Presence removed; Sentry not present.
- Empty/cleared PostHog, Supabase, and Stripe defaults; **no fallback to the hosted
  `web.readest.com`** backend; empty auto-updater endpoints.
- **Payment, subscription, and in-app-purchase code deleted** (checkout, plans,
  purchase call-to-actions, plan utilities). Disabled Stripe/IAP API routes remain only
  as inert `410 Gone` stubs.
- Hosted **account sign-in and official cloud setup removed** — the app is local-only by
  default and points you at your own integrations instead.

**Added / restored — user-controlled integrations**

- **LiteLLM / OpenAI-compatible AI services** for translation and text-to-speech: a
  shared client with your own endpoint, key, models, and headers. Nothing is enabled
  until you configure it, and request bodies/headers are never logged.
- **DeepL restored** as a user-keyed translation provider (your own key; free or Pro
  endpoint auto-selected), alongside per-provider enablement toggles for Google, Azure,
  Yandex, DeepL, and LiteLLM.
- **WebDAV: multiple named server profiles** (add / rename / remove / switch) with
  migration from the legacy single-server config.
- **WebDAV: TLS/HTTP security settings** — allow or reject self-signed/insecure
  certificates, and optionally warn on plain-`http://` endpoints.

**Retained & regression-tested**

- WebDAV file sync, KOReader progress sync (KOSync), S3-compatible storage, and Google
  Drive sync — all pointed at your own servers.
- OPDS / Calibre Content Server / Calibre-Web catalog browsing, authenticated access, and
  downloads.
- Groups / Collections creation surfaced for local-only, unauthenticated use.

See [`apps/readest-app/TODOS.md`](apps/readest-app/TODOS.md) for the running log of what
has shipped and what remains.

## A note on naming: two names in one codebase

You will see **both `Bookhearth` and `readest` throughout this repository.** This is
deliberate:

- **`Bookhearth`** is used for everything a **user sees** — the app name and window
  title (`productName`), on-screen text, store/packaging metadata, and this README.
- **`readest`** is kept for everything **internal** — folder names (`apps/readest-app`,
  `apps/readest.koplugin`), npm package/scope names (`@readest/*`), the Rust crate
  (`Readest` / `readestlib`), the OS bundle identifier (`com.bilingify.readest`), the
  `readest://` deep-link scheme, and the on-disk data directory (`Readest/`).

**Why keep the internal names?** Bookhearth is a living fork of an actively-maintained
project. Keeping internal identifiers, directory structure, and the vendored submodules
aligned with upstream means upstream bug-fixes and features can be pulled in with minimal
merge friction. Renaming those identifiers would also break existing installs, registered
OAuth redirect URIs, and synced data for no user-visible benefit. Changing the bundle
identifier, URL scheme, and data directory is possible later, but only as a deliberate,
migration-aware pass — not as part of a cosmetic rename.

The vendored projects under `packages/*` (the Tauri fork, `foliate-js`, `tauri-plugins`,
turso, simplecc, js-mdict, …) are **git submodules pointing at upstream repositories** and
are intentionally left untouched so their patches remain a `git submodule update` away.

## Features

<div align="left">✅ Implemented</div>

| **Feature**                                | **Description**                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Multi-Format Support**                   | EPUB, MOBI, KF8 (AZW3), FB2, CBZ, TXT, PDF.                                                                            |
| **Scroll/Page View Modes**                 | Switch between scrolling or paginated reading modes.                                                                   |
| **Full-Text Search**                       | Search across the entire book to find relevant sections.                                                               |
| **Annotations and Highlighting**           | Add highlights, bookmarks, and notes, with an instant mode for quicker interactions.                                   |
| **Dictionary/Wikipedia Lookup**            | Instantly look up words and terms while reading.                                                                       |
| **Parallel Read**                          | Read two books or documents simultaneously in a split-screen view.                                                     |
| **Customize Font and Layout**              | Adjust font, layout, theme mode, and theme colors.                                                                     |
| **Code Syntax Highlighting**               | Rich coloring of code examples in technical books.                                                                     |
| **File Association and Open With**         | Open supported files directly from your file browser.                                                                  |
| **Library Management**                     | Organize, sort, and manage your entire ebook library, including Collections.                                           |
| **OPDS/Calibre Integration**               | Connect OPDS / Calibre / Calibre-Web catalogs, with authenticated browsing and downloads.                              |
| **Translation**                            | Translate a sentence or a whole book via Google, Azure, Yandex, DeepL (your key), or a LiteLLM endpoint.               |
| **Text-to-Speech (TTS)**                   | Smooth, multilingual narration, including via your own OpenAI-compatible / LiteLLM endpoint.                           |
| **Self-Hosted Sync**                       | Sync book files, progress, notes, and bookmarks via WebDAV, S3, Google Drive, or KOReader — all on your own servers.   |
| **Accessibility**                          | Full keyboard navigation and screen-reader support (VoiceOver, TalkBack, NVDA, Orca).                                  |
| **Visual & Focus Aids**                    | Reading ruler, paragraph-by-paragraph mode, and speed-reading features.                                                |

## Getting Started

Bookhearth is built as a **Next.js + Tauri v2** app inside a pnpm monorepo. To build from
source, see [Getting Started in CONTRIBUTING.md](./CONTRIBUTING.md#getting-started).

```bash
# Web-only dev server (no Rust compilation)
pnpm dev-web

# Desktop dev with the Tauri backend (compiles Rust)
pnpm tauri dev
```

> **Note:** this repository uses git submodules for its vendored dependencies. Clone with
> `--recurse-submodules`, or run `git submodule update --init --recursive` after cloning,
> before building.

App-specific commands, the source layout, and project conventions live in
[`apps/readest-app/CLAUDE.md`](apps/readest-app/CLAUDE.md).

## License & Attribution

Bookhearth is free software distributed under the terms of the
[GNU Affero General Public License, version 3](https://www.gnu.org/licenses/agpl-3.0.html)
or (at your option) any later version. See the [LICENSE](LICENSE) file for details.

Bookhearth is a fork of **[Readest](https://github.com/readest/readest)** © Bilingify LLC,
also licensed under AGPL-3.0. All of Readest's original copyright and attribution notices
are retained. Readest itself is a modern rewrite of
[Foliate](https://github.com/johnfactotum/foliate).

The following libraries and frameworks are used in this software:

- [foliate-js](https://github.com/johnfactotum/foliate-js) — MIT
- [zip.js](https://github.com/gildas-lormeau/zip.js) — BSD-3-Clause
- [fflate](https://github.com/101arrowz/fflate) — MIT
- [PDF.js](https://github.com/mozilla/pdf.js) — Apache-2.0
- [daisyUI](https://github.com/saadeghi/daisyui) — MIT
- [marked](https://github.com/markedjs/marked) — MIT
- [next.js](https://github.com/vercel/next.js) — MIT
- [react-icons](https://github.com/react-icons/react-icons) — various open-source licenses
- [react](https://github.com/facebook/react) — MIT
- [tauri](https://github.com/tauri-apps/tauri) — MIT

The following fonts are bundled within the application or provided through web fonts:

[Bitter](https://fonts.google.com/specimen/Bitter), [Fira Code](https://fonts.google.com/specimen/Fira+Code), [Inter](https://fonts.google.com/specimen/Inter), [Literata](https://fonts.google.com/specimen/Literata), [Merriweather](https://fonts.google.com/specimen/Merriweather), [Noto Sans](https://fonts.google.com/specimen/Noto+Sans), [Roboto](https://fonts.google.com/specimen/Roboto), [LXGW WenKai](https://github.com/lxgw/LxgwWenKai), [MiSans](https://hyperos.mi.com/font/en/), [Source Han](https://github.com/adobe-fonts/source-han-sans/), [WenQuanYi Micro Hei](http://wenq.org/wqy2/)

Thanks also to the [Web Chinese Fonts Plan](https://chinese-font.netlify.app) for
open-source tools enabling the use of Chinese fonts on the web.

---

<div align="center" style="color: gray;">Happy reading with Bookhearth — built on the shoulders of Readest and Foliate.</div>

[badge-license]: https://img.shields.io/badge/license-AGPL--3.0-teal
[badge-upstream]: https://img.shields.io/badge/based%20on-Readest-orange
