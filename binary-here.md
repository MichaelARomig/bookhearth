# Bookhearth iOS build

Latest unsigned sideload `.ipa` (universal: iPhone + iPad, iOS 16.4+):

```
apps/readest-app/src-tauri/gen/apple/build/Bookhearth-unsigned.ipa
```

| | |
|---|---|
| Built | 2026-10-03 22:56 CDT |
| App version | 0.12.10 |
| Source commit | `a8f45d681` |
| Size | ~31 MB |
| Free-team install expires | ~2026-10-10 (7 days after install) |

Install with Sideloadly (bundle ID `com.michaelromig.bookhearth`, your free
Apple ID, strip unsupported entitlements; tick "Remove app extensions" if it
hits the 3-app-ID limit). Rebuild with `pnpm build-ios-sideload` from
`apps/readest-app` — this file is rewritten automatically by every successful
build. Full instructions in
[`apps/readest-app/docs/ios-sideload-build.md`](apps/readest-app/docs/ios-sideload-build.md).
