#!/usr/bin/env bash
# Build a native app, or stage this Mac's sidecars for the universal DMG.
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
service_dir="$(cd -- "$project_dir/../spur-ring-windows" && pwd)"
arch=""
python_command="${SPUR_BUILD_PYTHON:-python3.11}"
node_command="${SPUR_BUILD_NODE:-node}"
signed=0
notarize=0
smoke_test=0
native_payload=0

usage() {
  cat <<'HELP'
Usage: bash build-macos.sh [--arch arm64|x64] [--python PATH] [--node PATH]
                            [--signed] [--notarize] [--smoke-test] [--native-payload]

Run on a native Apple Silicon Mac for arm64 or a native Intel Mac for x64.
Requires Python 3.11, Node 22.12+, and Xcode command line tools.
Default: local unsigned DMG. --signed requires a Developer ID Application
certificate. --notarize additionally requires Apple notarization credentials.
Nothing is uploaded to a release server. Notarization contacts Apple only when
--notarize is explicitly supplied. --smoke-test opens the packaged app hidden
and checks its UI/backend startup without scanning or connecting Bluetooth.
--native-payload creates a tarball of native ring, Claude and Codex runtimes
for scripts/package-universal-mac.mjs. Run once on each architecture.
HELP
}
fail() { printf '%s\n' "Error: $*" >&2; exit 1; }
while (($#)); do
  case "$1" in
    --arch|-arch|-a) (($# >= 2)) || fail 'Missing architecture.'; arch="$2"; shift 2 ;;
    --python) (($# >= 2)) || fail 'Missing Python path.'; python_command="$2"; shift 2 ;;
    --node) (($# >= 2)) || fail 'Missing Node path.'; node_command="$2"; shift 2 ;;
    --signed) signed=1; shift ;;
    --notarize) notarize=1; signed=1; shift ;;
    --smoke-test) smoke_test=1; shift ;;
    --native-payload) native_payload=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ "$(uname -s)" == Darwin ]] || fail 'macOS DMGs must be built on macOS; PyInstaller cannot cross-compile this helper from Windows.'
case "$(uname -m)" in arm64) native_arch=arm64 ;; x86_64) native_arch=x64 ;; *) fail 'Unsupported Mac architecture.' ;; esac
[[ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" != 1 ]] || fail 'Use a native terminal and native Python/Node, not Rosetta.'
arch="${arch:-$native_arch}"
[[ "$arch" == arm64 || "$arch" == x64 ]] || fail 'Choose arm64 or x64 for this native build.'
[[ "$arch" == "$native_arch" ]] || fail "Build $arch on a native $arch Mac. This machine is $native_arch."
command -v xcrun >/dev/null || fail 'Install Xcode command line tools: xcode-select --install.'
xcrun --find clang >/dev/null || fail 'Xcode command line tools are unavailable.'
python_command="$(command -v "$python_command")" || fail 'Python 3.11 was not found.'
node_command="$(command -v "$node_command")" || fail 'Node was not found.'
export PATH="$(dirname "$node_command"):$PATH"
command -v npm >/dev/null || fail 'npm was not found alongside Node.'

"$python_command" - "$arch" <<'PY'
import platform, sys
arch = {'arm64': 'arm64', 'x86_64': 'x64'}.get(platform.machine())
if sys.version_info[:2] != (3, 11) or arch != sys.argv[1]:
    raise SystemExit('Use native Python 3.11 matching the requested architecture.')
if int(platform.mac_ver()[0].split('.')[0]) < 13:
    raise SystemExit('Build on macOS 13 or later.')
PY
"$node_command" - "$arch" <<'JS'
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12) || process.arch !== process.argv[2]) {
  throw new Error('Use Node 22.12+ matching the requested native architecture.');
}
JS

requirements="$service_dir/requirements-macos.lock"
[[ -f "$requirements" ]] || fail 'The pinned macOS service requirements are missing.'
build_dir="$project_dir/build/macos-$arch"
environment_dir="$service_dir/.venv-macos-$arch"
mkdir -p "$build_dir" "$project_dir/build/macos"
if [[ ! -x "$environment_dir/bin/python" ]]; then "$python_command" -m venv "$environment_dir"; fi
build_python="$environment_dir/bin/python"
export MACOSX_DEPLOYMENT_TARGET=13.0
"$build_python" -m pip install --requirement "$requirements"
cd "$service_dir"
"$build_python" -m unittest discover -s tests -q
cd "$project_dir"

if ((notarize)); then
  if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then :
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then :
  elif [[ -n "${APPLE_KEYCHAIN:-}" && -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then :
  else fail 'Notarization credentials are missing. Use the Apple API key, Apple ID, or keychain credential set documented in README.md.'; fi
fi

# A console-enabled helper inside its own bundle retains JSON stdio, while
# supplying CoreBluetooth/TCC metadata to NSBundle. It is spawned directly,
# never opened with Launch Services and never asks for permissions at build time.
"$build_python" - "$project_dir" "$service_dir" "$build_dir" "$arch" "$signed" "$notarize" <<'PY'
import json, os, plistlib, sys
from pathlib import Path
project, service, build = map(Path, sys.argv[1:4])
arch, signed, notarize = sys.argv[4], bool(int(sys.argv[5])), bool(int(sys.argv[6]))
pyinstaller_arch = 'x86_64' if arch == 'x64' else 'arm64'
manifest = json.loads((project / 'package.json').read_text())
config = json.loads((project / 'electron-builder.json').read_text())
entitlements = {'com.apple.security.cs.allow-jit': True,
                'com.apple.security.device.audio-input': True,
                'com.apple.security.device.bluetooth': True}
for name in ('entitlements.mac.plist', 'entitlements.mac.inherit.plist'):
    with (project / 'build/macos' / name).open('wb') as output:
        plistlib.dump(entitlements, output)
mac = config['mac']
mac['binaries'] = [f'Contents/Resources/ring-service/{arch}/SpurRingService.app/Contents/MacOS/SpurRingService']
mac['notarize'] = notarize
mac['hardenedRuntime'] = signed
mac['forceCodeSigning'] = signed
if signed:
    if os.environ.get('CSC_NAME'): mac['identity'] = os.environ['CSC_NAME']
else:
    mac['identity'] = None
config['publish'] = None
(build / 'electron-builder.json').write_text(json.dumps(config, indent=2) + '\n')
helper_info = {key: value for key, value in mac['extendInfo'].items() if key.startswith('NS')}
helper_info.update({'LSUIElement': True, 'LSMinimumSystemVersion': '13.0',
                    'CFBundleShortVersionString': manifest['version'], 'CFBundleVersion': manifest['version']})
spec = f'''from PyInstaller.utils.hooks import collect_submodules
a = Analysis([{str(service / 'service_launcher.py')!r}], pathex=[{str(service)!r}],
             hiddenimports=collect_submodules('bleak') + ['Foundation', 'AppKit', 'CoreBluetooth',
                 'ApplicationServices', 'HIServices', 'PrintCore', 'CoreText', 'Quartz', 'objc'],
             excludes=['tkinter', 'pytest'], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='SpurRingService',
          console=True, debug=False, strip=False, upx=False, target_arch={pyinstaller_arch!r},
          codesign_identity=None, entitlements_file={str(project / 'build/macos/entitlements.mac.inherit.plist')!r})
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='SpurRingService')
app = BUNDLE(coll, name='SpurRingService.app', bundle_identifier='com.spur.ringdesktop.service',
             info_plist={helper_info!r})
'''
(build / 'SpurRingService.spec').write_text(spec)
PY

"$build_python" -m PyInstaller --noconfirm --distpath "$build_dir/frozen" --workpath "$build_dir/pyinstaller" "$build_dir/SpurRingService.spec"
helper_bundle="$build_dir/frozen/SpurRingService.app"
helper_executable="$helper_bundle/Contents/MacOS/SpurRingService"
[[ -x "$helper_executable" ]] || fail 'The frozen service bundle was not produced.'
[[ "$(lipo -archs "$helper_executable")" == "${arch/x64/x86_64}" ]] || fail 'The service executable has the wrong architecture.'
"$build_python" - "$helper_bundle" <<'PY'
import re, subprocess, sys
from pathlib import Path
magics = {bytes.fromhex(value) for value in ('cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca')}
for binary in Path(sys.argv[1]).rglob('*'):
    if binary.is_symlink() or not binary.is_file(): continue
    with binary.open('rb') as source:
        if source.read(4) not in magics: continue
    commands = subprocess.check_output(['otool', '-l', str(binary)], text=True)
    versions = re.findall(r'\bminos\s+([\d.]+)', commands)
    versions += re.findall(r'cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version ([\d.]+)', commands)
    for version in versions:
        required = tuple((list(map(int, version.split('.'))) + [0, 0])[:3])
        if required > (13, 0, 0):
            raise SystemExit(f'{binary.name} requires macOS {version}; use a Python 3.11 build compatible with macOS 13.')
PY
"$helper_executable" --help >/dev/null
"$build_python" "$service_dir/collect_licenses.py" "$helper_bundle/Contents/Resources"
# Notice collection changes sealed resources. Restore the local ad-hoc helper
# signature; electron-builder replaces it with the Developer ID in signed builds.
codesign --force --sign - --entitlements "$project_dir/build/macos/entitlements.mac.inherit.plist" "$helper_bundle"
codesign --verify --deep --strict "$helper_bundle"

# Each CPU needs its own PyInstaller bootloader and embedded Python archive.
# Preserve the entire signed helper, its symlinks, and the assistant runtimes.
if ((native_payload)); then
  stage="$(mktemp -d "$build_dir/native.XXXXXX")"
  trap 'rm -rf -- "$stage"' EXIT
  mkdir -p "$stage/ring-service/$arch" "$stage/claude/$arch"
  "$node_command" -e 'console.log(JSON.stringify({arch:process.arch,version:require("./package.json").version,commit:process.env.GITHUB_SHA}))' > "$stage/ring-service/$arch/native-build.json"
  ditto "$helper_bundle" "$stage/ring-service/$arch/SpurRingService.app"
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-fund --no-audit
  claude_pkg="node_modules/@anthropic-ai/claude-agent-sdk-darwin-$arch"
  ditto "$claude_pkg" "$stage/claude/$arch"
  "$stage/claude/$arch/claude" --version
  npm install --prefix "$build_dir/codex-runtime" --ignore-scripts --no-package-lock --no-fund --no-audit "@openai/codex-darwin-$arch@npm:@openai/codex@0.172.0-darwin-$arch"
  "$node_command" scripts/stage-codex.mjs "$build_dir/codex-runtime/node_modules/@openai/codex-darwin-$arch" "$stage/codex/$arch"
  "$stage/codex/$arch/bin/codex" --version
  COPYFILE_DISABLE=1 tar -C "$stage" -cf "$build_dir/native-$arch.tar" ring-service codex claude
  printf 'Native resources ready: %s\n' "$build_dir/native-$arch.tar"
  exit 0
fi

# Replace only this generated staging directory. Do not copy one architecture
# over another's old files, or put Windows .exe/DLL files into a Mac release.
"$build_python" - "$project_dir/resources/ring-service" "$helper_bundle" "$arch" <<'PY'
import shutil, sys
from pathlib import Path
destination, source = map(Path, sys.argv[1:3])
expected = Path.cwd() / 'resources/ring-service'
if destination.resolve() != expected.resolve() or source.name != 'SpurRingService.app':
    raise SystemExit('Unexpected generated service staging path.')
if destination.exists(): shutil.rmtree(destination)
(destination / sys.argv[3]).mkdir(parents=True)
shutil.copytree(source, destination / sys.argv[3] / source.name, symlinks=True)
PY

npm ci --no-fund --no-audit
npm test
npm run build
if ((signed)); then
  printf '%s\n' 'Building with Developer ID signing. The build fails if a valid certificate is unavailable.'
else
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  printf '%s\n' 'Building a local unsigned DMG; this is not a notarized distribution release.'
fi
"$node_command" node_modules/electron-builder/cli.js --mac dmg "--$arch" --config "$build_dir/electron-builder.json" --publish never
"$node_command" scripts/collect-notices.mjs --verify

app_output="$project_dir/release/mac"
if [[ "$arch" == arm64 ]]; then app_output="$project_dir/release/mac-arm64"; fi
app_bundle="$app_output/Spur Desktop.app"
[[ -d "$app_bundle" ]] || fail 'The packaged Mac application is missing.'
if ((signed)); then codesign --verify --deep --strict --verbose=2 "$app_bundle"; fi
if ((notarize)); then xcrun stapler validate "$app_bundle"; fi
if ((smoke_test)); then
  mkdir -p "$project_dir/test-output"
  smoke_report="$project_dir/test-output/macos-$arch-self-test.json"
  # Empty the generated report first so an old successful run cannot hide a
  # startup failure that returns before writing its own diagnostics.
  : > "$smoke_report"
  "$app_bundle/Contents/MacOS/Spur Desktop" --self-test --report "$smoke_report"
  "$build_python" - "$smoke_report" "$project_dir/package.json" <<'PY'
import json, sys
from pathlib import Path
report = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
version = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))['version']
if not isinstance(report, dict) or 'error' in report:
    raise SystemExit('Packaged macOS startup reported an error; inspect the smoke-test JSON.')
required = ('ui', 'service', 'noRendererNode', 'settingsUI', 'macNativeBindings', 'coreBluetoothBindings')
failed = [name for name in required if report.get(name) is not True]
pcm = report.get('pcmWorklet')
if not isinstance(pcm, dict) or pcm.get('verified') is not True or pcm.get('syntheticAudioOnly') is not True:
    failed.append('pcmWorklet')
if report.get('version') != version:
    failed.append('version')
if failed:
    raise SystemExit('Packaged macOS startup checks failed: ' + ', '.join(failed))
print('Packaged macOS startup assertions passed. Ring hardware and live cloud transcription were not tested.')
PY
fi
printf '%s\n' "macOS $arch build complete. DMG: $project_dir/release/Spur-Desktop-$("$node_command" -p "require('./package.json').version")-macOS-$arch.dmg"
