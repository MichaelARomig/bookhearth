#!/usr/bin/env bash
#
# build-ios-sideload.sh — build an UNSIGNED iOS device .ipa of Bookhearth for
# sideloading with a free Apple account (Sideloadly, AltStore, etc.).
#
# Why unsigned: signing a device build needs an Apple identity + provisioning
# profile for a bundle id you own. We don't sign here — the sideload tool
# re-signs with your Apple ID at install time, sets the bundle id, and strips
# the free-tier-incompatible entitlements. See docs/ios-sideload-build.md for
# the full story (prerequisites, the "why", and Sideloadly settings).
#
# Usage:   pnpm build-ios-sideload         (from apps/readest-app)
#     or:  bash scripts/build-ios-sideload.sh
#
# Output:  src-tauri/gen/apple/build/Bookhearth-unsigned.ipa
#
set -euo pipefail

# --- resolve paths (script lives in apps/readest-app/scripts) ---------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../apps/readest-app
GEN="$APP_DIR/src-tauri/gen/apple"
PROJ_YML="$GEN/project.yml"
ARCHIVE_APP="$GEN/build/Readest_iOS.xcarchive/Products/Applications/Bookhearth.app"
OUT="$GEN/build/Bookhearth-unsigned.ipa"

# Files the build temporarily rewrites; restored on exit so `git status` stays
# clean whether the build succeeds or fails.
DIRTY=(
  "src-tauri/gen/apple/project.yml"
  "src-tauri/gen/apple/Readest.xcodeproj/project.pbxproj"
  "src-tauri/gen/apple/ShareExtension/Info.plist"
  "src-tauri/gen/apple/ReadestWidget/Info.plist"
  # tauri's deep-link plugin rewrites the main app's CFBundleURLTypes on build
  "src-tauri/gen/apple/Readest_iOS/Info.plist"
)
restore() { ( cd "$APP_DIR" && git checkout -- "${DIRTY[@]}" 2>/dev/null || true ); }
trap restore EXIT

# --- 1. rustup's cargo must win over Homebrew's `rust` -----------------------
# Homebrew's rust (/opt/homebrew/bin/cargo) has NO iOS std and can't hold iOS
# targets; only rustup can. If it's first on PATH the build dies with
# "can't find crate for std (aarch64-apple-ios)". This scopes the fix to the
# build (no global env change). Requires: rustup + the iOS targets installed
# (see docs).
export PATH="$HOME/.cargo/bin:$PATH"

# --- 2. temporarily disable code signing ------------------------------------
# tauri ios build validates signing up front and aborts before compiling if it
# can't resolve the team/profile. Inject a project-level no-signing block so it
# builds unsigned. (Restored by the EXIT trap.)
python3 - "$PROJ_YML" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if "CODE_SIGNING_ALLOWED" not in s:
    anchor = "configs:\n  debug: debug\n  release: release\n"
    block = anchor + (
        "settings:\n"
        "  base:\n"
        '    CODE_SIGNING_ALLOWED: "NO"\n'
        '    CODE_SIGNING_REQUIRED: "NO"\n'
        '    CODE_SIGN_IDENTITY: ""\n'
    )
    assert anchor in s, "project.yml layout changed; update this anchor"
    open(p, "w").write(s.replace(anchor, block, 1))
    print("  injected no-signing block into project.yml")
else:
    print("  no-signing block already present")
PY

# regenerate the Xcode project so the pbxproj carries CODE_SIGNING_ALLOWED=NO
xcodegen generate --spec "$PROJ_YML" >/dev/null
echo "  regenerated Xcode project"

# --- 3. build the device app -------------------------------------------------
# The .ipa EXPORT step will fail ("No Account for Team ..." / "No profiles") —
# that's expected and fine: the archive with the compiled, unsigned app is what
# we package. So we don't let that failure stop the script.
echo "==> building (first run compiles the whole Rust-for-device tree; ~15-40 min)"
( cd "$APP_DIR" && pnpm exec tauri ios build --target aarch64 --ci ) || true

# --- 4. confirm the archive produced the app --------------------------------
if [ ! -d "$ARCHIVE_APP" ]; then
  echo "ERROR: build did not produce $ARCHIVE_APP" >&2
  echo "       check the tauri/xcodebuild output above." >&2
  exit 1
fi

# --- 5. package a clean unsigned .ipa (Payload/ at zip root, no AppleDouble) -
WORK="$(mktemp -d)"
mkdir -p "$WORK/Payload"
cp -R "$ARCHIVE_APP" "$WORK/Payload/"
xattr -cr "$WORK/Payload"            # strip xattrs so no ._AppleDouble files
find "$WORK" -name '._*' -delete
rm -f "$OUT"
( cd "$WORK" && zip -qrX "$OUT" Payload )   # zip (not ditto): no ._ junk
rm -rf "$WORK"

echo ""
echo "✅ Unsigned .ipa ready:"
echo "   $OUT"
echo ""
echo "Install it with Sideloadly:"
echo "  • Bundle ID: com.michaelromig.bookhearth"
echo "  • Sign with your Apple ID (free personal team)"
echo "  • Let it strip App Groups / Associated Domains / Sign-in-with-Apple"
echo "  • Tick 'remove app extensions' if it hits the 3-app-ID free-tier limit"
echo "  • Re-run this weekly — free-team installs expire after 7 days."
