# Audio Agent

Audio Agent is a small local web app for recording audio and sending the
transcribed text into the parent Claude Code agent.

## Architecture

```text
browser recording
  -> Bun server upload
  -> STT provider
  -> parent agent CLI
  -> browser result
```

The app is intentionally isolated from the main CLI code. It calls the parent
agent through a subprocess first, so the existing Claude Code implementation can
stay unchanged.

## Run

```bash
bun install
bun run dev
```

Then open:

```text
http://localhost:8787
```

## Environment

```bash
export AUDIO_AGENT_PORT=8787
export AUDIO_AGENT_STT_PROVIDER=mock
export AUDIO_AGENT_PARENT_ROOT=/Users/spur/X/space/claudeV2
export AUDIO_AGENT_AGENT_COMMAND="bun run scripts/dev.ts -p"
```

`mock` STT is the default for the first development pass.

### ElevenLabs Scribe v2 meeting transcription

The Android app uploads ring recordings to this service. Scribe credentials stay
on this server and are never shipped in the APK:

```bash
export AUDIO_AGENT_STT_PROVIDER=elevenlabs
export ELEVENLABS_API_KEY=your_server_side_key
export ELEVENLABS_STT_MODEL=scribe_v2
export ELEVENLABS_STT_DIARIZE=1
```

Meeting recordings return speaker-attributed transcript segments with timestamps.
Set `ELEVENLABS_STT_USE_SPEAKER_LIBRARY=1` after enrolling known speakers in the
ElevenLabs workspace. `ELEVENLABS_STT_NUM_SPEAKERS` may optionally be set from 1
to 32 when the expected participant count is known.

## Production build

```bash
bun run build
bun run start
```

The compiled server is written to `dist/server.js`. The default health check is
available at `http://localhost:8787/health`.
