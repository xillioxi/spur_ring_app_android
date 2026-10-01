import { YanqiangVoiceNative, type RingDictationStreamEvent } from '@/native/YanqiangVoiceNative'

type ScribeMessage = {
  message_type?: string
  text?: string
  error?: string
}

let socket: WebSocket | null = null
let queuedChunks: string[] = []
let commitRequested = false
let finalReceived = false
let latestPartial = ''
let generation = 0
let finishTimer: ReturnType<typeof setTimeout> | undefined
const PACKAGED_ELEVENLABS_API_KEY =
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || ''

export function handleRingDictationStream(event: RingDictationStreamEvent): void {
  if (event.type === 'start') {
    void startRealtimeSession()
    return
  }
  if (event.type === 'chunk' && event.audioBase64) {
    queuedChunks.push(event.audioBase64)
    flushAudio()
    return
  }
  if (event.type === 'commit') {
    if (queuedChunks.length === 0) {
      failSession('No speech captured')
      return
    }
    commitRequested = true
    flushAudio()
    return
  }
  if (event.type === 'error') failSession('Microphone capture failed')
}

async function startRealtimeSession(): Promise<void> {
  closeSession()
  const sessionGeneration = ++generation
  queuedChunks = []
  commitRequested = false
  finalReceived = false
  latestPartial = ''
  try {
    // Android stores the debug credential in app-private SharedPreferences. It
    // survives a normal APK upgrade even if a later build has no packaged key.
    const apiKey = (await YanqiangVoiceNative.getElevenLabsApiKey(
      PACKAGED_ELEVENLABS_API_KEY,
    )).trim()
    if (!apiKey) {
      throw new Error('This build has no local ElevenLabs key')
    }
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
      method: 'POST',
        headers: { 'xi-api-key': apiKey },
      },
    )
    const payload = (await response.json().catch(() => null)) as
      | { token?: unknown; error?: unknown }
      | null
    if (!response.ok || typeof payload?.token !== 'string') {
      const detail = typeof payload?.error === 'string' ? payload.error : ''
      throw new Error(detail || `ElevenLabs rejected realtime transcription (${response.status})`)
    }
    if (sessionGeneration !== generation) return

    const params = new URLSearchParams({
      token: payload.token,
      model_id: 'scribe_v2_realtime',
      audio_format: 'pcm_16000',
      commit_strategy: 'manual',
      no_verbatim: 'true',
      filter_background_audio: 'true',
      keyterms: 'Spur',
    })
    const activeSocket = new WebSocket(
      `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`,
    )
    socket = activeSocket
    activeSocket.onopen = flushAudio
    activeSocket.onmessage = message => handleScribeMessage(message.data)
    activeSocket.onerror = () => failSession('Realtime transcription connection failed')
    activeSocket.onclose = () => {
      if (!finalReceived && sessionGeneration === generation) {
        failSession('Realtime transcription ended before text was returned')
      }
    }
  } catch (error) {
    if (sessionGeneration !== generation) return
    failSession(error instanceof Error ? error.message : 'Unable to start realtime transcription')
  }
}

function flushAudio(): void {
  const activeSocket = socket
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return
  // Always retain the newest chunk so releasing the ring can attach the manual
  // commit flag to real audio. Previously the live path drained every chunk,
  // leaving nothing to commit when the ring was released.
  while (queuedChunks.length > 1) {
    const chunk = queuedChunks.shift()
    if (chunk) sendChunk(activeSocket, chunk, false)
  }
  if (commitRequested) {
    const finalChunk = queuedChunks.shift()
    sendChunk(activeSocket, finalChunk || '', true)
    commitRequested = false
    finishTimer = setTimeout(() => {
      if (latestPartial.trim()) {
        finalReceived = true
        void YanqiangVoiceNative.completeRingDictation(latestPartial)
        closeSession()
      } else {
        failSession('Realtime transcription timed out')
      }
    }, 10_000)
  }
}

function sendChunk(activeSocket: WebSocket, audioBase64: string, commit: boolean): void {
  activeSocket.send(
    JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: audioBase64,
      ...(commit ? { commit: true } : {}),
    }),
  )
}

function handleScribeMessage(raw: unknown): void {
  if (typeof raw !== 'string') return
  let message: ScribeMessage
  try {
    message = JSON.parse(raw) as ScribeMessage
  } catch {
    return
  }
  if (message.message_type === 'partial_transcript' && typeof message.text === 'string') {
    latestPartial = message.text
    void YanqiangVoiceNative.updateRingDictationPartial(message.text)
    return
  }
  if (message.message_type === 'committed_transcript' && typeof message.text === 'string') {
    finalReceived = true
    if (finishTimer) clearTimeout(finishTimer)
    void YanqiangVoiceNative.completeRingDictation(message.text)
    closeSession()
    return
  }
  if (message.error) failSession(message.error)
}

function failSession(message: string): void {
  if (finishTimer) clearTimeout(finishTimer)
  void YanqiangVoiceNative.failRingDictation(message)
  closeSession()
}

function closeSession(): void {
  generation += 1
  if (finishTimer) clearTimeout(finishTimer)
  finishTimer = undefined
  const activeSocket = socket
  socket = null
  if (activeSocket && activeSocket.readyState < WebSocket.CLOSING) activeSocket.close()
  queuedChunks = []
  commitRequested = false
}
