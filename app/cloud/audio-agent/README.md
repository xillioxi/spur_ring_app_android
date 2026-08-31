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
cd /Users/spur/X/space/claudeV2/apps/audio-agent
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
