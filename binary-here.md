# Bookhearth iOS build

Unsigned sideload `.ipa` (built 2026-09-28, ~30 MB):

```
apps/readest-app/src-tauri/gen/apple/build/Bookhearth-unsigned.ipa
```

Install with Sideloadly (bundle ID `com.michaelromig.bookhearth`, your free
Apple ID, strip unsupported entitlements). Expires after 7 days — rebuild
with `pnpm build-ios-sideload` from `apps/readest-app`. Full instructions in
[`apps/readest-app/docs/ios-sideload-build.md`](apps/readest-app/docs/ios-sideload-build.md).
