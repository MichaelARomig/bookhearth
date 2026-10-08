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

# A global ~/.cargo/config.toml [build] rustflags (e.g. `-C embed-bitcode=yes`,
# `-C target-cpu=native`) leaks into the iOS cross-compile: cc-rs turns
# embed-bitcode into `-fembed-bitcode=all`, which Xcode 27's clang rejects
# alongside `-ffunction-sections` (zstd-sys fails), and target-cpu=native
# tunes for this Mac rather than the phone. Target-specific rustflags replace
# [build] rustflags outright, so this pins the iOS target to known-good flags
# for this build only.
export CARGO_TARGET_AARCH64_APPLE_IOS_RUSTFLAGS="-Cembed-bitcode=no"

# --- 1a. prerequisites (fail fast with the fix, not 10 minutes in) ----------
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
missing=()
xcodebuild -version >/dev/null 2>&1 \
  || missing+=("full Xcode:     sudo xcode-select -s /Applications/Xcode.app/Contents/Developer")
command -v xcodegen >/dev/null || missing+=("XcodeGen:       brew install xcodegen")
command -v pod >/dev/null || missing+=("CocoaPods:      brew install cocoapods")
if ! command -v rustup >/dev/null \
  || ! rustup target list --installed | grep -qx aarch64-apple-ios; then
  missing+=("rustup + iOS:   rustup target add aarch64-apple-ios aarch64-apple-ios-sim")
fi
[ -f "$REPO_ROOT/packages/foliate-js/package.json" ] \
  || missing+=("submodules:     git submodule update --init --recursive")
[ -d "$APP_DIR/node_modules" ] || missing+=("JS deps:        pnpm install   (repo root)")
if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: missing prerequisites (see docs/ios-sideload-build.md):" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi
# public/vendor is gitignored; a fresh clone needs it generated once.
if [ ! -d "$APP_DIR/public/vendor/pdfjs" ]; then
  echo "==> vendor assets missing; running pnpm setup-vendors (one-time)"
  ( cd "$APP_DIR" && pnpm setup-vendors )
fi

# --- 1b. one-time iOS scaffolding (fresh clone / worktree) -------------------
# Only gen/apple's customized files are tracked; the rest (Sources/, Externals/,
# assets/, LaunchScreen.storyboard, Podfile) comes from `tauri ios init`.
# Without it xcodegen fails with "missing source directory .../Sources". init
# also rewrites tracked files, so restore them (incl. the BookHearth AppIcon
# catalog in Assets.xcassets) right after.
if [ ! -d "$GEN/Sources" ]; then
  echo "==> gen/apple not initialized; running tauri ios init (one-time)"
  ( cd "$APP_DIR" && pnpm exec tauri ios init --ci )
  ( cd "$APP_DIR" && git checkout -- src-tauri/gen/apple )
fi

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

# regenerate the Xcode project so the pbxproj carries CODE_SIGNING_ALLOWED=NO.
# Unset FORCE_COLOR first: pnpm sets it to 0 when stdout is not a terminal,
# and XcodeGen substitutes ${FORCE_COLOR} from the environment into the
# "Build Rust Code" script. The tauri xcode-script command then treats that
# 0 as a CPU architecture and aborts ("isn't a known arch").
env -u FORCE_COLOR xcodegen generate --spec "$PROJ_YML" >/dev/null
echo "  regenerated Xcode project"

# XcodeGen leaves a literal ${FORCE_COLOR} in the script when the variable is
# unset. xcodebuild still inherits FORCE_COLOR from pnpm, so the shell would
# expand it to 0 at build time. Drop the token. Color is unused by xcode-script.
PBXPROJ="$GEN/Readest.xcodeproj/project.pbxproj"
python3 - "$PBXPROJ" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
needle = "${FORCE_COLOR} "
if needle not in s:
    sys.exit("ERROR: Build Rust Code script has no ${FORCE_COLOR} token to strip")
open(p, "w").write(s.replace(needle, ""))
print("  stripped FORCE_COLOR from the Rust build script")
PY

# --- 3. build the device app -------------------------------------------------
# The .ipa EXPORT step will fail ("No Account for Team ..." / "No profiles") —
# that's expected and fine: the archive with the compiled, unsigned app is what
# we package. So we don't let that failure stop the script. But a REAL compile
# failure also exits non-zero here, and without this cleanup an old archive
# from a previous successful run would still satisfy the "did it produce an
# app" check below, silently repackaging a stale build as if it were fresh
# (this actually happened: an Xcode update broke the Rust/Swift link, and the
# script still reported success from a two-month-old archive). Deleting the
# archive first means a failed build leaves nothing for that check to find.
rm -rf "$GEN/build/Readest_iOS.xcarchive"
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

# --- 6. record this build in <repo>/binary-here.md ---------------------------
# Rewritten on every successful build so the repo always says where the latest
# .ipa is, what it was built from, and when the free-team install expires.
BUILT="$(date '+%Y-%m-%d %H:%M %Z')"
EXPIRES="$(date -v+7d '+%Y-%m-%d')"
SIZE_MB="$(( $(stat -f %z "$OUT") / 1048576 ))"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ARCHIVE_APP/Info.plist")"
COMMIT="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
# Ignore gen/apple: the build's own temporary edits (DIRTY, restored on exit)
# are still in place at this point and would always read as "uncommitted".
( cd "$REPO_ROOT" && git diff --quiet HEAD -- apps ':(exclude)apps/readest-app/src-tauri/gen/apple' ) \
  || COMMIT="$COMMIT + uncommitted changes"
cat > "$REPO_ROOT/binary-here.md" <<EOF
# Bookhearth iOS build

Latest unsigned sideload \`.ipa\` (universal: iPhone + iPad, iOS 16.4+):

\`\`\`
apps/readest-app/src-tauri/gen/apple/build/Bookhearth-unsigned.ipa
\`\`\`

| | |
|---|---|
| Built | $BUILT |
| App version | $VERSION |
| Source commit | \`$COMMIT\` |
| Size | ~$SIZE_MB MB |
| Free-team install expires | ~$EXPIRES (7 days after install) |

Install with Sideloadly (bundle ID \`com.michaelromig.bookhearth\`, your free
Apple ID, strip unsupported entitlements; tick "Remove app extensions" if it
hits the 3-app-ID limit). Rebuild with \`pnpm build-ios-sideload\` from
\`apps/readest-app\` — this file is rewritten automatically by every successful
build. Full instructions in
[\`apps/readest-app/docs/ios-sideload-build.md\`](apps/readest-app/docs/ios-sideload-build.md).
EOF
echo "  updated binary-here.md"

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
