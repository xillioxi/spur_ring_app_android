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
python3 - "$app" "$arch" "$cpu" <<'PY'
import json, platform, plistlib, re, subprocess, sys
from pathlib import Path

app, arch, cpu = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
resources = app / 'Contents/Resources'
helper = resources / 'ring-service' / arch / 'SpurRingService.app'

def version(value):
    return tuple((list(map(int, value.split('.'))) + [0, 0])[:3])

def plist_floor(bundle):
    with (bundle / 'Contents/Info.plist').open('rb') as stream:
        info = plistlib.load(stream)
    floors = [info['LSMinimumSystemVersion']]
    arch_floor = info.get('LSMinimumSystemVersionByArchitecture', {}).get(cpu)
    if arch_floor:
        floors.append(arch_floor)
    return max(floors, key=version)

def macho_floor(binary):
    output = subprocess.check_output(['otool', '-arch', cpu, '-l', str(binary)], text=True)
    floors = []
    for command in re.split(r'(?m)^Load command \d+\s*$', output):
        if re.search(r'(?m)^\s*cmd LC_BUILD_VERSION$', command):
            if re.search(r'(?im)^\s*platform (?:1|macos|macosx)$', command):
                floors.append(re.search(r'(?m)^\s*minos ([\d.]+)$', command)[1])
        elif re.search(r'(?m)^\s*cmd LC_VERSION_MIN_MACOSX$', command):
            floors.append(re.search(r'(?m)^\s*version ([\d.]+)$', command)[1])
    if not floors:
        raise ValueError(f'No macOS deployment target in {binary.name} for {cpu}')
    return max(floors, key=version)

core = {
    'appInfoPlist': plist_floor(app),
    'appExecutable': macho_floor(app / 'Contents/MacOS/Spur Desktop'),
    'electronFramework': macho_floor(app / 'Contents/Frameworks/Electron Framework.framework/Electron Framework'),
    'ringHelperInfoPlist': plist_floor(helper),
    'ringHelperExecutable': macho_floor(helper / 'Contents/MacOS/SpurRingService'),
}
engines = {
    'codex': macho_floor(resources / 'codex' / arch / 'bin/codex'),
    'claude': macho_floor(resources / 'app.asar.unpacked/node_modules/@anthropic-ai' / f'claude-agent-sdk-darwin-{arch}' / 'claude'),
}
expected = json.loads(Path('electron-builder.json').read_text())['mac']['minimumSystemVersion']
core_floor = max(core.values(), key=version)
receipt = {'arch': arch, 'testedMacOS': platform.mac_ver()[0], 'configuredMinimum': expected,
           'coreTargets': core, 'coreMinimum': core_floor, 'assistantTargets': engines}
Path(f'test-output/universal-deployment-{arch}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
if version(core_floor) > version(expected) or version(core['appInfoPlist']) != version(expected):
    raise SystemExit(f'Core minimum {core_floor} or app Info.plist differs from the configured macOS {expected} floor')
for engine, minimum in engines.items():
    if version(minimum) > version(core_floor):
        print(f'{engine} on {arch} requires macOS {minimum}. Core Spur requires macOS {core_floor}.')
PY
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
