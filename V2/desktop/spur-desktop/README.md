# Spur Desktop 0.3.12

## Dictate into an open Claude or Codex project

Open the project in Claude or Codex and select the model in that app.
Spur enables the ring button automatically when the ring connects and an
ElevenLabs key is saved. When Spur shows **Ring button ready**, click the
project's message box and record on the ring. This also works with Spur in
the tray. If you previously chose a draft inside Spur, select **Use this
project** on the **Open project** page to send words to the focused field.
On macOS, grant Bluetooth access to connect the ring, Microphone access for
computer audio, and Accessibility access to type into other apps.
With the computer microphone, choose **Start project dictation** and focus the
message box within three seconds. To start from the project window instead,
choose **Use shortcut in project** and press the displayed shortcut while the
message box has focus. Review and send the message in the project.
That conversation supplies its own account, model, history, and tools. Spur
only needs its ElevenLabs transcription credential for this workflow.

For live dictation like the Android cross-app voice notes app, choose **Ring
control** in Dictation. Hold the ring button and speak near the computer
microphone. Provisional words update in the floating caption and the open
project pane while you speak. Confirmed phrases go into the focused editor.
If Windows cannot select a text field, the transcript stays available in Spur.

**Chat in Spur** opens the separate embedded assistant described below.

## Claude workspace

Open **Claude → Chat in Spur**, enter your Anthropic API key, and select **Connect Claude**.
Spur also accepts `ANTHROPIC_API_KEY` from its launch environment and encrypts
keys saved through the app. Choose a project folder and one of the models
available to your key. Type a request or arm the ring, stop recording, and add
the transcript to your draft. Review it and select **Send to Claude**.
The bundled Claude runtime streams replies and asks before running commands
or changing files. Select a previous conversation to continue it in the same
project. Each assistant has its own drafts and conversation history.
Anthropic charges Claude API usage to the account that issued your key.

## Codex workspace

The **Codex** page connects Spur to a locally installed Codex CLI using its
app-server protocol over stdio. Open **Codex → Chat in Spur → Connect Codex**, sign in if
needed, choose a project folder and an available model, then type an instruction
or select **Arm ring for Codex**. Audio uses the source and ElevenLabs key in
Settings. Stop/disarm voice, add the transcript to the instruction, review it,
and select **Send to Codex**. Nothing is submitted by a ring gesture alone.

Spur displays streamed replies, commands, file changes, approval requests, and
questions. **Stop task** interrupts an active turn. The conversation selector
resumes conversations created by Spur for the selected project; it does not
attach to an arbitrary open Codex desktop chat. Codex-bound dictation disables
foreground text insertion. Select **Write where my cursor is** on Dictation to
return to cursor insertion.

The universal Mac build and the Windows Codex build bundle Codex CLI 0.172.0.
Existing CLI sign-in is reused. **Choose Codex executable** supports a custom installation; on Windows
select the native `codex.exe`, not a `.cmd`/`.ps1` launcher. The model selector
uses the installed CLI's advertised models. If the service rejects a model due
to CLI compatibility, update Codex CLI and reconnect. Codex account billing and
ElevenLabs transcription billing are separate.

Spur requests a project-scoped workspace-write sandbox and on-request approvals.
Approvals are forwarded to the user, never automatically accepted. Unsupported
tool interactions fail closed; requests granting a broader write root can only
be declined in this version. Codex may read project files and edit files inside
the project as part of an instruction. Transcripts and project context sent to
Codex follow the connected Codex account's policies.

`codex.json` beside the desktop preferences stores the executable path, selected
model/project, and up to 100 Spur conversation references. Codex stores the
actual conversations in its own local account data. Spur does not store a copy
of Codex credentials. Unsent instructions remain in the UI across navigation and
connection failures, but are not persisted when the app quits.

To reproduce the Windows x64 package with Codex and Claude after preparing the
normal ring-service resources, install `@openai/codex@0.172.0` in the repository's
`.build-tools/codex-runtime` directory, then run from this desktop directory:

```powershell
node scripts/stage-codex.mjs
npm run build
npm test
node node_modules/electron-builder/out/cli/cli.js --win dir --config electron-builder.codex.json
```

Staging downloads the pinned release's Apache license and notice and preserves
the runtime's bundled third-party notices. Output is a separate directory under
`artifacts/Spur-Desktop-Windows-Codex-Claude-0.3.12`. The standard Windows/macOS packaging
configuration still supports an independently installed Codex CLI. Resumed
conversations display up to 50 recent turns (300 visible items); Codex retains
the underlying conversation history.

On Windows, connecting a ring saves its Bluetooth address after authentication. Spur reconnects to that ring on launch and when it comes back into range. Choose **Disconnect** or **Stop auto-reconnect** to clear the saved ring.

While connected, Spur downloads a finished ring recording to **Recordings** automatically, including when the window is in the tray. The download works with dictation off and requires no ElevenLabs key. After an automatic reconnection, Spur also checks the ring for recordings saved while it was away. Choose **Connect & sync** to retrieve existing recordings when connecting manually.

**Disconnect** also works while ring dictation is armed or recording, while a connection is opening, and during a sync. It stops ring dictation, cancels pending transfers, and keeps previously saved recordings available in the library.

Choose **Name ring** beside a nearby or connected ring to give it a name on this PC. Spur recognizes the same Bluetooth address on later scans, even if the ring advertises no name. Use **Rename** to edit or remove the label. Disconnecting keeps your label.

Closing the Windows app window keeps Spur running in the system tray. Your ring connection, active dictation, and keyboard shortcut stay available. Click the Spur tray icon or launch Spur again to reopen the window. To exit completely, right-click the tray icon and choose **Quit Spur**.

A Windows and macOS desktop app with a React/TypeScript interface, ElevenLabs speech
recognition, a global dictation shortcut, and native Unicode text insertion.
The Bluetooth authentication and recording adapter runs in a bundled Python
service. Python and Node do not need to be installed to run a packaged release.
The Windows protocol baseline has been verified with the ring. Native macOS
packaging, permissions, Bluetooth, and cursor insertion require acceptance on a
Mac; adding build support does not establish those hardware results.

## Start

On Windows, extract the complete release folder and open **Spur Desktop.exe**. Keep its
`resources` and other runtime files alongside it. Close the old Tk desktop app
before connecting the ring from this version.

On an Intel or Apple Silicon Mac running **macOS 13 Ventura or later**, open
`Spur-Desktop-0.3.12-macOS-universal.dmg`, drag **Spur Desktop** into
**Applications**, eject the disk image, and open Spur from Applications.
The same installer includes native components for both processors.

In **Settings**, enter your ElevenLabs API key, choose the audio source and
language, then save. Electron safeStorage protects the key using Windows DPAPI
or macOS Keychain. The renderer never receives the saved key. An existing
`ELEVENLABS_API_KEY` environment variable is also supported.

Audio is sent to ElevenLabs only during an explicitly started dictation session
or when you select a recording's **Transcribe** action. Your account's speech-to-text
permissions, credits, and internet access are required. The two computer microphone
modes also require permission to use the computer microphone.

## Three audio modes

| Mode | Microphone | Behavior |
| --- | --- | --- |
| Ring control | Computer | Focus your destination, hold the ring button to speak, and release to finish. Spur enables the button when the ring connects. |
| Computer mic | Computer | Focus a text field and press **Ctrl+Shift+Space** on Windows or **Cmd+Shift+Space** on macOS to start or stop live dictation. Starting from the app gives you 3 seconds to select your destination. |
| Ring microphone | Ring | Click the destination field and start recording when the ring button is ready. Live ring streams produce captions as you speak. Rings that supply only completed files are transcribed after release. |

The Android app linked by the user uses `AudioRecord` on the **phone** for its
live ElevenLabs stream; the AIZO ring supplies gesture/recording-state controls.
Ring control reproduces that behavior with the computer's microphone. Desktop
ring microphone mode uses the AIZO 3.2.1 live Opus transfer when the connected firmware
provides it. The separate BAE8 SmartRing stream uses another protocol.
See the bundled `PROTOCOL_LIVE.md` for immutable source links and command evidence.

In **Settings**, turn on **Write where my cursor is** to insert text. Place
the caret in a document or message, then record on the ring.
**Pause ring button** suspends dictation until you choose **Enable ring button**.
ElevenLabs drafts appear in the caption. Each confirmed phrase is typed once.
Keep the field focused while you dictate. If Spur pauses insertion, check its
on-screen notice. Your transcript remains available to copy from Dictation.
Windows may block input into elevated programs. macOS requires Accessibility
permission for cursor insertion. Native password fields are
excluded. Dictation does not press Enter, send a message, or execute commands.

For ring audio, a physical recording while armed starts the live session. Spur
decodes incoming ring audio to mono 16 kHz PCM and sends it to ElevenLabs Scribe
Realtime. A completed live transcript is saved beside the matching recording.
If the live feed is unavailable or incomplete, file transcription requires
exactly one fresh recording whose timestamp fits the current recording cycle.

## Recordings and data

The library supports sync, playback in your default Ogg player, export, and
manual transcription. Original audio and transcripts remain under
`%LOCALAPPDATA%/Spur/RingDesktop/recordings` on Windows and
`~/Library/Application Support/Spur/RingDesktop/recordings` on macOS. Existing
desktop ring identity and recordings are reused. Preserve `desktop.json` during
upgrades. macOS identifies Bluetooth peripherals with a computer-specific UUID;
scan on that Mac rather than copying a Windows Bluetooth address.

`desktop-ui.json` stores preferences; `elevenlabs-key.bin` stores the encrypted
key. Transcripts are saved beside audio as `.ogg.transcript.json`. Live microphone
audio is streamed without being saved; the current live transcript stays in the
app until cleared or closed. No transcription is started automatically on launch.

The previous app's frame CRC/packet checks and iOS-compatible whole-file checksum
policy remain in effect. See `PROTOCOL_RECORDINGS.md` for recording limitations.

## Validation

The Windows baseline passed TypeScript compilation, protocol/lifecycle tests,
and the Python Bluetooth, packet, audio, IPC and cursor regression suite.
Native English/Chinese/emoji insertion was verified in a disposable test field.
The standalone Electron app passes UI/service startup, Settings navigation, and
renderer isolation checks. Refer to `release-manifest.json` for the final counts
and hardware/cloud acceptance status; mocked tests are not a live ElevenLabs test.
These are the recorded Windows checks, not a claim that a macOS release passed
native or ring testing. A Mac build must be tested on its target architecture.
Final local 0.3.0 checks: 120 Python tests and 33 TypeScript tests passed. Two
native macOS binding tests were skipped on Windows and run by the Mac workflow.
The cross-platform source app also passed startup, Settings, renderer-isolation
and synthetic PCM checks on Windows. These checks do not replace a native Mac
build or a physical ring test on macOS.

```powershell
& '.\Spur Desktop.exe' --self-test --report "$PWD\self-test.json"
```

## macOS permissions

Allow **Bluetooth** when you first scan for your ring, and **Microphone** when you
start live computer-microphone dictation. For cursor insertion, use Spur's
permission controls and enable the application named by macOS under
**System Settings → Privacy & Security → Accessibility**. It may list Spur Desktop
or its bundled SpurRingService helper. Quit and reopen the installed app after
changing permissions. You can use transcript preview and copy without cursor
insertion permission.

If Bluetooth or microphone access was denied, re-enable it in the corresponding
Privacy & Security pane. macOS does not let an app repeatedly request a denied
Bluetooth permission; [Bleak documents the permission lifecycle](https://bleak.readthedocs.io/en/latest/backends/macos.html#permissions).
No permissions, Bluetooth connection, or transcription are requested by the build
script. The optional startup smoke test does not scan or connect a ring.

## Build Windows

Use Node 22.12+ and Python 3.11 x64. The adjacent `spur-ring-windows` project holds
the protocol/service implementation and pinned Python requirements. Install
those requirements plus PyInstaller into your Python environment, then run:

```powershell
.\build.ps1 -PythonPath 'C:\path\to\python.exe'
```

The script builds the native service, installs the locked TypeScript dependencies,
builds the UI, and packages Windows output under `release/win-unpacked`.
No app signing certificate is included; this is a local unsigned test release.

## Build macOS DMGs

The universal build uses one native helper build from each architecture.
On each Mac, run the following from this directory, substituting its architecture
(`x64` on Intel or `arm64` on Apple Silicon).

```sh
bash build-macos.sh --arch "$arch" --native-payload
```

Copy `build/macos-x64/native-x64.tar` and `build/macos-arm64/native-arm64.tar`
to one Mac and pass their paths to the packaging script.

```sh
npm ci
npm test
npm run build
node scripts/package-universal-mac.mjs /path/to/native-x64.tar /path/to/native-arm64.tar
```

The single installer is `release/Spur-Desktop-0.3.12-macOS-universal.dmg`.
The macOS workflow mounts this image and tests its application on each architecture.
The default universal build is ad-hoc signed. Gatekeeper may require approval
the first time someone opens a downloaded copy.

### Single-architecture builds

Build on **macOS 13 or later**, using native **Python 3.11**, **Node 22.12+**, npm,
and Xcode command line tools (`xcode-select --install`). Use an Apple Silicon Mac
for arm64 and an Intel Mac for x64. The script rejects Rosetta and mismatched
Python/Node architectures. PyInstaller must freeze its service on the target OS;
the Windows workstation cannot produce a working macOS service executable.

From this directory, run the command appropriate to the build machine:

```sh
# On an Apple Silicon Mac
bash build-macos.sh --arch arm64

# On an Intel Mac
bash build-macos.sh --arch x64
```

`--python /path/to/python3.11` and `--node /path/to/node` select explicit tools.
`SPUR_BUILD_PYTHON` and `SPUR_BUILD_NODE` provide the same defaults. The script
creates `../spur-ring-windows/.venv-macos-<arch>`, installs
`requirements-macos.lock`, runs Python and TypeScript regressions, freezes a
console-enabled `SpurRingService.app`, and builds the Electron app and DMG.
The helper has its own Bluetooth and microphone purpose strings and retains
JSON stdio for the private bridge. The top-level app and nested binaries receive
the generated JIT, audio-input, and Bluetooth entitlements when signed.

Artifacts are named `release/Spur-Desktop-<version>-macOS-arm64.dmg` and
`release/Spur-Desktop-<version>-macOS-x64.dmg`. The unpacked app is in
`release/mac-arm64/` or `release/mac/`. Build each architecture in its own checkout
if running the jobs concurrently: `resources/ring-service` is a generated staging
directory shared by the platform build scripts. Never stage the Windows service
in a Mac app or mix two architectures' service files.

By default, the DMG is a **local unsigned build**, without Developer ID signing
or notarization. macOS may block it; follow the system's explicit Open Anyway
flow only for a build you trust. No command disables Gatekeeper. For a distributable
release, pass `--signed` with a Developer ID Application certificate available in
the keychain or through `CSC_LINK` and `CSC_KEY_PASSWORD`; `CSC_NAME` can select
the identity. Missing signing credentials fail a signed build.

`--notarize` enables signing and Apple's notarization service. Supply one complete
credential set: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`; or
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; or `APPLE_KEYCHAIN`,
`APPLE_KEYCHAIN_PROFILE`. Keep secrets outside source control. Notarization runs
only with that flag. Every build uses `--publish never`; no release is uploaded.
See the pinned [electron-builder v26 signing documentation](https://www.electron.build/v26/docs/mac/).

Notices are copied into the app by an `afterPack` hook **before** signing and DMG
creation. `node scripts/collect-notices.mjs --verify` checks both platforms' output
without modifying signed Mac bundles. Python/PyObjC notices stay inside the
helper's Resources directory.

On a Mac with a graphical session, add `--smoke-test` to run the installed-format
app's hidden startup checks. The report is `test-output/macos-<arch>-self-test.json`.
Then mount the DMG, install the app, and verify the Bluetooth/microphone prompts,
ring authentication and recording transfer, Accessibility cursor insertion,
hotkey, playback, and ElevenLabs dictation. A startup report alone does not prove
those hardware/cloud flows. Signed/notarized builds additionally verify code
signatures and the stapled notarization ticket.

ElevenLabs API references: [realtime speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
and [file transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).
