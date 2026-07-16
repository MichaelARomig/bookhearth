# Calibre OPDS Integration

This workspace treats Calibre integration as standard OPDS catalog access
against Calibre Content Server or Calibre-Web. The custom
`apps/readest-calibre-plugin/` push flow is not the primary integration path
for the local-first build.

## Scope

Readest should work against the OPDS surface exposed by a running Calibre
server, typically:

- `http://host:8080/opds` — official **calibre-server** / Calibre Content Server root
- `http://host:8080/opds/index.xml` — common on **Calibre-Web**; official
  `calibre-server` returns **404** here (live-checked on calibre 9.11)

The client is expected to follow normal OPDS discovery from the root feed:

- navigation feeds
- acquisition feeds
- OpenSearch / search links (calibre-server advertises
  `/opds/search/{searchTerms}?library_id=...`)
- pagination links such as `rel="next"`
- relative URLs

## Authentication

Calibre Content Server supports password auth when enabled. Important detail
from live calibre 9.11:

- `--enable-auth` without SSL defaults to **Digest** (`auth-mode=auto`)
- For HTTP Basic Auth (what Readest's username/password OPDS fields use),
  start the server with `--auth-mode=basic`

Readest should continue to support authenticated OPDS catalogs through the
existing username/password fields in the Add Catalog flow.

## Expected Behavior

For a Calibre-compatible OPDS catalog, the app should:

- validate the root OPDS URL
- browse hierarchical feeds such as Authors, Series, Tags, and Newest
- follow OpenSearch discovery and search result feeds
- resolve relative navigation and acquisition URLs correctly
- paginate through multi-page feeds using `rel="next"`
- expose download links for supported book formats such as EPUB and PDF
- tolerate catalogs that expose metadata and covers even when an acquisition
  link is unavailable

## QA Baseline

Manual verification against a live `calibre-server` instance should cover:

- root feed at `/opds`
- root feed at `/opds/index.xml` (expect 404 on official calibre-server; pass on Calibre-Web)
- anonymous access
- HTTP Basic Auth enabled access (`--enable-auth --auth-mode=basic`)
- navigation from root to an author/series shelf
- search flow through the advertised search link
- pagination via `rel="next"`
- download of at least one EPUB and one PDF when available
- Calibre-Web compatibility where the current Readest baseline already works

### Local workspace fixture (2026-07-09)

| Item | Value |
|------|--------|
| Sample files | `library/` (Gutenberg dumps; not a Calibre DB) |
| Calibre library | `calibre-library/` (created via `calibredb add`) |
| User DB | `calibre-users.sqlite` (user `qa` / `qapass`) |
| OPDS QA script | `scripts/qa_calibre_opds.py` |
| Server binary | Homebrew cask calibre 9.11 → `calibre-server` |

Anonymous server (example):

```bash
calibre-server --port 8080 --listen-on 127.0.0.1 --disable-use-bonjour \
  /Users/michael/gitrepos/ebook/calibre-library
```

Basic Auth server (example; currently the intended live QA target):

```bash
calibre-server --port 8080 --listen-on 127.0.0.1 --disable-use-bonjour \
  --enable-auth --auth-mode=basic \
  --userdb /Users/michael/gitrepos/ebook/calibre-users.sqlite \
  /Users/michael/gitrepos/ebook/calibre-library
```

Catalog URL for Readest: `http://127.0.0.1:8080/opds`

### Live server OPDS results (calibre-server 9.11)

Against the local library (10 books, EPUB + AZW3 where available):

| Check | Anon | Basic Auth |
|-------|------|------------|
| `GET /opds` atom feed | pass | pass (401 without creds) |
| `GET /opds/index.xml` | **404** (expected) | **404** (expected) |
| Nav entries (Newest/Title/Authors/…) | pass | pass |
| Browse shelf | pass | pass |
| Search (`/opds/search/{searchTerms}`) | pass | pass |
| `rel="next"` pagination | pass | pass |
| Acquisition EPUB `/get/epub/...` | pass | pass |
| Acquisition AZW3 `/get/azw3/...` | pass | pass |
| Acquisition PDF | n/a (no PDFs in fixture) | n/a |

### Client-path regression (Readest OPDS code)

Live Vitest suite:
`src/__tests__/app/opds/calibre-live.integration.test.ts`
(skips cleanly when the server is down).

| Check | Result |
|-------|--------|
| `validateOPDSURL` + Basic Auth | pass |
| Bad credentials rejected | pass |
| Root nav + search link via `getFeed` | pass |
| Browse By Newest + EPUB download (ZIP magic) | pass |
| Search "Alice" via expand-before-resolve | pass |

**Bugs fixed during client + UI QA:**

1. Calibre advertises `/opds/search/{searchTerms}?library_id=…` as
   `application/atom+xml`. Calling `resolveURL` before template expansion
   percent-encodes braces to `%7BsearchTerms%7D` and the server returns 404.
   The app expands Atom path-style templates **before** `resolveURL`, and
   `expandOPDSSearchTemplate` recovers already-encoded braces.

2. Authenticated Calibre covers/acquisitions on the **web** build used a HEAD
   `probeAuth` round-trip that left `/api/opds/proxy` fetching without
   credentials (401 noise, missing covers). Downloads and cover cache now send
   **preemptive Basic** auth (Digest still falls back via `probeAuth`).

### UI e2e (Playwright, web)

`e2e/tests/calibre-opds.spec.ts` drives a real browser against
`pnpm dev-web` + live calibre-server:

- empty library → Online Library / OPDS catalogs
- add catalog with Basic Auth + proxy consent
- browse By Newest → search Alice → download EPUB
- book appears in `/library`

Run: `pnpm test:e2e:web -- e2e/tests/calibre-opds.spec.ts`

`apps/readest-calibre-plugin/` remains legacy; OPDS path is the validated
integration.
