#!/usr/bin/env bash
# Exercise the actual release image on each architecture with no cloud credentials.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
image="${1:?Pass the universal DMG}"
arch="${2:?Pass x64 or arm64}"
cpu="${arch/x64/x86_64}"
[[ "$(uname -m)" == "$cpu" ]]
hdiutil verify "$image"
mount="$(mktemp -d)"
trap 'hdiutil detach "$mount" >/dev/null; rmdir "$mount"' EXIT
hdiutil attach -readonly -nobrowse -mountpoint "$mount" "$image"
app="$mount/Spur Desktop.app"
resources="$app/Contents/Resources"
executable="$app/Contents/MacOS/Spur Desktop"
framework="$app/Contents/Frameworks/Electron Framework.framework/Electron Framework"
for binary in "$executable" "$framework"; do lipo "$binary" -verify_arch arm64 x86_64; done
codesign --verify --deep --strict "$app"
for slice in arm64 x64; do
  helper="$resources/ring-service/$slice/SpurRingService.app"
  codex="$resources/codex/$slice/bin/codex"
  claude="$resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-darwin-$slice/claude"
  for binary in "$helper/Contents/MacOS/SpurRingService" "$codex" "$claude"; do
    test -x "$binary"
    lipo "$binary" -verify_arch "${slice/x64/x86_64}"
  done
  codesign --verify --deep --strict "$helper"
  if [[ "$slice" == "$arch" ]]; then
    "$helper/Contents/MacOS/SpurRingService" --help >/dev/null
    "$codex" --version
    "$claude" --version
  fi
done
mkdir -p test-output
report="$PWD/test-output/universal-$arch.json"
: > "$report"
"$executable" --self-test --report "$report"
python3 - "$report" "$arch" <<'PY'
import json, sys
from pathlib import Path
result = json.loads(Path(sys.argv[1]).read_text())
version = json.loads(Path('package.json').read_text())['version']
checks = ['ui', 'service', 'settingsUI', 'noRendererNode', 'macNativeBindings', 'coreBluetoothBindings', 'floatingCaptions']
assert all(result.get(k) is True for k in checks), result
assert result['version'] == version and result['arch'] == sys.argv[2], result
assert result['pcmWorklet']['verified'] and result['pcmWorklet']['syntheticAudioOnly'] and 'error' not in result, result
print('Verified the mounted universal DMG on', sys.argv[2])
PY
