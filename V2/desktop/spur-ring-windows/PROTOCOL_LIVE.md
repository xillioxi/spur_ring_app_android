# Ring-controlled realtime dictation

The Android repository supplied by the user does implement realtime ElevenLabs
dictation. Its AIZO integration uses the ring as a start/stop controller and
captures the **phone microphone**. The Windows equivalent uses the computer
microphone for the ring-controlled computer microphone option. Windows also
supports the ring microphone through the distinct AIZO 3.2.1 protocol below.

## Live ring microphone on Windows

The official AIZO RING 3.2.1 application (`com.eiot.be.ring`, build 300201)
registers its real-time audio listener in `AiChatAc.rebindRingAudioListeners`.
Its `BeDeviceConfigUtil.receiveDeviceRunningStateNotify` checks voice function
1 and state 1 and starts `BeRealtimeAudioTransferUtil.startSyncFile`. Its
AC52 handler forwards each Opus packet to the listener. The AI chat screen
decodes this stream in `RingRealtimeAudioSession` while the recording is open.
State 4 signals that a recording is ready. This behavior was checked in
`classes2.dex` of the supplied application. Different firmware may only deliver
the saved recording after release.

`armDictation({liveRingAudio: true})` opts into this path. A physical long press
or recording state triggers an AC51 request. On firmware where state 1 also
means idle, a fresh first AC52 packet confirms the take. The helper matches
the recording timestamp against the gesture with three seconds of clock
tolerance and emits complete Opus frames in sequence. It ignores other queued
recordings. After release it accepts trailing packets for up to five seconds.
AC54 must account for every packet before the helper writes the raw frames,
Ogg and metadata, reports the file, acknowledges it with AC55, and signals
the end of the live take. If the release notification is missing, the verified
end closes the take and a later duplicate release is ignored. Saved-file sync
does not emit live audio.

The Windows app also receives a `recording-ready` event with the connected
`address` and a `source` of `state` or `touch`. An authenticated recording-ready
state or a release following a recording start can request a local download
while dictation is off. Repeated ready notifications for the same take are
coalesced. When the live transfer has already saved the file, its verified end
handles completion. After reconnect, a `syncRecordings` request with
`storedOnlyIfReported` checks AA13 first. A confirmed zero count and byte size
with no ready signal finishes that inventory check immediately. Missing
inventory, pending recordings, and a ready signal use the normal transfer.

The private bridge emits `ring-opus` with `timestamp` (Unix seconds),
`sequence` (one-based), `data` (base64), `frameSize`, `frameDurationMs`,
`sampleRate` and `channels`. `ring-live-end` carries the timestamp of a
verified take. `ring-live-error` carries a message when an active take is
incomplete. These paths are tested with simulated Bluetooth notifications.

## Reference source

Repository: `xillioxi/spur_ring_app_android`, branch `codex/v1.0.28`, immutable
commit `914626b3a69dea9707022040555588a28a2e6296`. The same realtime helper and
accessibility implementation also appear in `codex/recover-v1.0.16` and
`codex/new-ui-replacement`; they are absent from the older default-branch
snapshot `dea72a4b5d9892cfa75fff3d746714702f9ec2e8`.

- [YanqiangVoiceModule.java lines 87-118](https://github.com/xillioxi/spur_ring_app_android/blob/914626b3a69dea9707022040555588a28a2e6296/app/mobile/android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoiceModule.java#L87-L118): ring working state 2 starts dictation, state 4 stops; touch `long_press` and `release_press` do the same. Double-click suppresses the state-based start for 900 ms. Windows emits both sources for its coordinator to deduplicate.
- [RingDictationAccessibilityService.java lines 266-305](https://github.com/xillioxi/spur_ring_app_android/blob/914626b3a69dea9707022040555588a28a2e6296/app/mobile/android/app/src/main/java/com/spur/recordingring/yanqiang/RingDictationAccessibilityService.java#L266-L305): constructs Android `AudioRecord` with `VOICE_RECOGNITION`, 16000 Hz, mono, PCM16; reads microphone bytes, base64-encodes them, and sends them to the realtime transcriber.
- [ElevenLabsRealtimeTranscriber.java](https://github.com/xillioxi/spur_ring_app_android/blob/914626b3a69dea9707022040555588a28a2e6296/app/mobile/android/app/src/main/java/com/spur/recordingring/yanqiang/ElevenLabsRealtimeTranscriber.java): realtime Scribe token/WebSocket client, `pcm_16000`, manual commit.
- [YanqiangVoiceModule.java lines 877-887](https://github.com/xillioxi/spur_ring_app_android/blob/914626b3a69dea9707022040555588a28a2e6296/app/mobile/android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoiceModule.java#L877-L887): enables SDK touch reporting after connecting. Windows enables it only when the user explicitly arms dictation.

Fetched blob SHAs: Yanqiang module `1ab0a578452e5754d1158827a2b118250428aa1d`;
dictation service `9a1be304dc2fc813f0f1e3e2a882a24289cf041c`;
ElevenLabs helper `79a9ea12b01f5b7db5575e48ac99e7fa0167e65b`.

## AIZO control protocol and API

These commands use the existing authenticated FE02 transport, version3 outgoing
frames, negotiated ATT size, and CRC handling. Authentication is unchanged.

| Payload | Meaning |
| --- | --- |
| `816301` | Enable touch reporting. |
| `816300` | Disable touch reporting. |
| `8164xx` | Set-reporting reply; `xx=01` succeeds, other values fail. |
| `8161` + 8-byte records | Each record is 6 calendar bytes followed by a 2-byte big-endian touch code. |
| `816201` | Application acknowledgment of parsed touch records. |
| `816202` | Application rejection of an incomplete touch record. |
| `AA11` + function,state[,remainingTime] | Ring working-state notification; function 1 is voice recording. |
| `AA1201` / `AA1200` | Valid/invalid working-state notification acknowledgment. |

Evidence is the bundled `aizo_serversdk_release_v2_2.2.6.aar` (SHA256
`d5c569a9cf4e8c91a7359ede40a486b3335177c1917f8586518125e43e69e626`), recovered
using CFR and checked against `javap -c -p`:

- `DeviceManager.setTouchEventReportSwitch`: `8163` + one-byte switch,
  `requestHex(...,33124)` (`0x8164`), accepts byte 2 equal to 1.
- `BeDataReceive.ALHK5CCJFOBTdxTtuzb`: splits touch data into 8-byte records,
  calendar 6/code 2, code big-endian; dispatcher bytecode offsets 2514-2556 sends
  `8162` + parse result. The vendor parser silently ignores incomplete trailing
  bytes; Windows rejects the whole malformed message before emitting triggers.
- `DeviceManager.receiveDeviceWorkingStateNotify`: `AA11` function/state and
  optional 2-byte big-endian remaining time.
- Android bridge maps codes `0x0103` (259) and `0x0106` (262) to long-press and
  release. Codes `0x1103`/`0x1106` are volume-up/swipe-down and do not start/stop.

`await RingClient.arm_dictation()` requires authentication, sends the enable
command, and waits up to 8 seconds for a successful 8164. Rejection/timeout leaves
dictation disarmed. `await disarm_dictation()` stops emitting triggers immediately
and requests disabling. Disconnect also attempts disabling if this session
requested reporting. No microphone is opened by either transport method.

While armed, events are:

```json
{"type":"dictation-trigger","action":"start","source":"touch"}
{"type":"dictation-trigger","action":"stop","source":"state"}
```

The transport emits `ring-state` with numeric `state`, readable `name`, and optional
`remaining_time`, plus `ring-touch` with numeric `event`, `action`, and opaque
calendar `time_bytes`. Capture triggers require the authenticated,explicitly
armed session; corrupt, non-hex, and malformed notifications cannot trigger it.
The coordinator must deduplicate repeated starts/stops and own microphone and
ElevenLabs lifecycle. Notifications can report both state and touch for one
gesture. Arming only enables controls; it does not itself begin capture.

`RingClient.live_audio_capability()` reports implemented capabilities:
`ring_triggered_dictation=true`, `ring_live_audio=true` on Windows, and
`audio_source=computer_microphone` for the default control-only call.
These control APIs are tested against synthetic notifications; successful
touch reporting on the user's physical firmware still needs a user-initiated
acceptance run.

## Other hardware paths and boundaries

The same repository also contains a separate
[SmartRingProtocol.ts](https://github.com/xillioxi/spur_ring_app_android/blob/914626b3a69dea9707022040555588a28a2e6296/app/mobile/src/sdk/smartRing/SmartRingProtocol.ts)
using BAE80001/BAE80010/BAE80011 or legacy 1000/1001/1002 UUIDs and 0x71 ADPCM
notifications. It supports 8 kHz streaming and start command `0009710001`.
Those commands are **not** sent to the user's FE02 AIZO device. NUS/Speex is yet
another hardware path. The user's observed GATT exposes FE02 and no BAE8 service.
FF12/FF14/FF15 are explicitly the vendor OTA service/data-in/data-out UUIDs in
`ota/ab_model/bluetooth/BleManager.java`, not an audio route.

VoiceRecordParam contains volume, bitrate, optional bitrates, and light brightness;
the A103 setter has no live/offline mode flag. The reference Android bridge
blocks saved-file sync while recording/paused (states 2/3). This guard is present
in the native app, not proof of an undocumented firmware streaming capability.
The existing Windows saved-file sync behavior is preserved.

Verification: parser tests cover multiple records, byte order, unrelated gestures,
malformed records, and honest capability metadata. Mock-BLE integration tests
cover explicit arming, 8164 rejection/timeout, both trigger sources, disarming,
disconnect cleanup, and corrupt/malformed notification rejection. They do not
record a microphone, contact ElevenLabs, or issue commands to a physical ring.
