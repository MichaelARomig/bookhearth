# Building Bookhearth for iPhone/iPad with a free Apple account (sideloading)

This is the **weekly rebuild** guide. Bookhearth's iOS project is set up to sign
under Bilingify's (upstream Readest's) Apple team, which you can't use. With a
**free Apple ID** you can still run it on your own devices, but such installs
**expire after 7 days**, so you rebuild + reinstall about weekly.

The approach: build an **unsigned** `.ipa` here, then let **Sideloadly** (or
AltStore) sign it with *your* Apple ID at install time. Sideloadly also sets a
bundle id you own and strips the entitlements a free account can't use — so we
change nothing in the repo's identity.

## TL;DR (the weekly loop)

```bash
cd apps/readest-app
pnpm build-ios-sideload          # ~15–40 min on a cold build; produces the .ipa
```

Output: `apps/readest-app/src-tauri/gen/apple/build/Bookhearth-unsigned.ipa`

Then in **Sideloadly**: drag in that `.ipa`, set the options in
[Sideloadly settings](#sideloadly-settings), and install to your connected
device. Trust the developer profile on-device the first time
(**Settings → General → VPN & Device Management → your Apple ID → Trust**).

---

## One-time prerequisites

Do these once. The build script assumes they're in place.

1. **Full Xcode selected** (not just Command Line Tools):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version        # should print Xcode, not an error
   ```
2. **rustup + iOS Rust targets** (device + simulator):
   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   ```
3. **CocoaPods + libimobiledevice** (Tauri's iOS tooling uses them):
   ```bash
   brew install cocoapods            # libimobiledevice is pulled in by tauri ios init
   ```
4. **An Apple ID in Xcode** (free is fine): Xcode → Settings → Accounts → **+** →
   Apple ID. This is used by *Sideloadly*, not by this build.
5. **Sideloadly** installed (<https://sideloadly.io>) and your device trusting
   this Mac.

If `src-tauri/gen/apple` was never initialized on this machine, run once:
`PATH="$HOME/.cargo/bin:$PATH" pnpm exec tauri ios init --ci`.

## Sideloadly settings

- **IPA:** `.../gen/apple/build/Bookhearth-unsigned.ipa`
- **Apple account:** your Apple ID (free "personal team")
- **Bundle ID:** `com.michaelromig.bookhearth` (any unique reverse-DNS you own;
  you can't reuse Bilingify's `com.bilingify.readest`)
- Let Sideloadly **strip unsupported entitlements** — free teams can't use
  **App Groups**, **Associated Domains**, or **Sign in with Apple** (this
  project requests all three).
- Tick **"Remove app extensions"** if Sideloadly complains about the free-tier
  **3-app-ID limit** (the app + Widget + Share Extension = 3 ids). Removing them
  drops the home-screen widget and the share-sheet target; the reader itself is
  unaffected.
- **7-day expiry:** free-team installs stop launching after a week. Just rerun
  the build + reinstall. (A paid Apple Developer Program removes the expiry and
  re-enables the stripped capabilities.)

---

## Why it's built this way (things that DON'T work, and why)

The script encodes several hard-won workarounds. If you ever debug it, here's
the reasoning:

- **You can't sign the repo's bundle id.** The iOS project targets team
  `J5W48D69VR` (Bilingify) and bundle id `com.bilingify.readest`, both owned by
  upstream. Apple bundle ids are globally unique per account, so your Apple ID
  can't sign them. → We build **unsigned** and let Sideloadly re-sign + re-id.

- **Raw `xcodebuild` can't build it.** Tauri's "Build Rust Code" Xcode phase
  runs `pnpm tauri ios xcode-script`, which connects back over a WebSocket to a
  server that **only `tauri ios build` starts**. Run under bare `xcodebuild` it
  panics with `failed to build WebSocket client … Connection refused`. → We must
  go through `tauri ios build`.

- **`tauri ios build` aborts at the signing check** (before compiling) with
  `No Account for Team "J5W48D69VR"` / `No profiles for 'com.bilingify.readest'`.
  → The script injects a project-level `CODE_SIGNING_ALLOWED = NO` into
  `project.yml` and regenerates the Xcode project so it compiles unsigned.

- **The `.ipa` EXPORT step still fails** (`exportArchive No Account for Team …`)
  even with signing disabled — Tauri's export always tries to sign. That's
  expected. The **`.xcarchive` it produced already contains the compiled app**
  (`gen/apple/build/Readest_iOS.xcarchive/Products/Applications/Bookhearth.app`,
  arm64, with the web frontend embedded in the Rust binary), so the script
  ignores the export failure and packages that app itself.

- **Homebrew's `rust` shadows rustup.** `/opt/homebrew/bin/cargo` (Homebrew
  rust) has no iOS std and precedes `~/.cargo/bin` on PATH, so the Rust phase
  dies with `can't find crate for std (aarch64-apple-ios)`. Per project policy
  we don't touch the global env; the script prepends `~/.cargo/bin` to PATH for
  the build only. (If you'd rather fix it globally: `brew unlink rust`.)

- **Packaging with `ditto` injects `._AppleDouble` junk** into the zip. The
  script strips extended attributes and uses `zip` so the `.ipa` is clean
  (`Payload/Bookhearth.app` at the root, nothing else).

## What the app shows vs. keeps internally

The build keeps the repo's *internal* identity (`Readest_iOS` target,
`com.bilingify.readest`) — those are only used pre-Sideloadly. User-facing
strings are **Bookhearth**: the app name (`productName`), the main-app Face-ID
prompt and display name, and the Share Extension / Widget display names.

## Notes / known follow-ups

- The main iOS `Info.plist` (`gen/apple/Readest_iOS/Info.plist`) is committed
  (force-added past the `gen/` gitignore) because Tauri only generates it from
  `productName`, which no longer matches the `Readest_iOS` project name. See its
  keys (bundle id, `readest://` + Google-OAuth URL schemes, doc types, locales).
- App-extension version strings (`1.0`) don't match the app (`0.11.18`) — a
  harmless warning here; only matters for a real App Store submission.
