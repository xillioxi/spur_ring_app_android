# ElevenLabs Scribe v2 transcription

The mobile app can replace its existing transcription path with ElevenLabs Scribe v2 after a ring recording has been synchronized and saved as an OGG file.

## Local test setup

Create `app/mobile/.env.local` (it is ignored by Git):

```env
EXPO_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Never commit the real key. An `EXPO_PUBLIC_` value is bundled into the APK and is suitable only for private testing. Production requests must go through a backend that stores the key securely.

## Request flow

1. Sync the binary OPUS recording from the ring over BLE.
2. Convert it to OGG and save it locally.
3. Upload the OGG file to `POST https://api.elevenlabs.io/v1/speech-to-text` as `multipart/form-data`.
4. Send these form fields:
   - `model_id=scribe_v2`
   - `diarize=true`
   - `tag_audio_events=true`
   - `timestamps_granularity=word`
5. Authenticate with the `xi-api-key` header, then store the returned transcript, speaker segments, timestamps, and language code.

The implementation already lives in `src/services/elevenLabsScribe.ts`. Recording processing calls `transcribeDirectWithScribe()` from `src/services/localRecordingAnalysis.ts`. Keep the audio as a file upload; Base64 is unnecessary and increases its size by about 33%.

## Production replacement

Move the same multipart request into the Spur backend. The Android app should upload the recording to that backend, and the backend should call ElevenLabs using a server-only `ELEVENLABS_API_KEY`. Return only the transcript and diarization result to the app.

Ring cursor dictation is intentionally configured as a direct local-test path. It uses the
same `EXPO_PUBLIC_ELEVENLABS_API_KEY` to request a single-use `realtime_scribe` token from
ElevenLabs, then streams 16 kHz PCM directly to `scribe_v2_realtime`. This avoids the Spur
API server but embeds the permanent key in the APK; do not distribute that APK publicly.
