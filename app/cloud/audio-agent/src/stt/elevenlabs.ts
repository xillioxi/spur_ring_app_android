import { basename } from 'path'
import { readFile } from 'fs/promises'
import type {
  TranscriptSegment,
  TranscribeInput,
  TranscriptionResult,
} from './types.js'

type ElevenLabsWord = {
  text?: unknown
  start?: unknown
  end?: unknown
  type?: unknown
  speaker_id?: unknown
}

type ElevenLabsResponse = {
  text?: unknown
  words?: unknown
  language_code?: unknown
  language_probability?: unknown
}

export async function transcribeWithElevenLabs(
  input: TranscribeInput,
): Promise<TranscriptionResult> {
  const settings = input.config.elevenlabs
  if (!settings.apiKey) {
    throw new Error(
      'Missing ElevenLabs API key. Set ELEVENLABS_API_KEY on the audio-agent server.',
    )
  }

  const body = new FormData()
  const audioBytes = await readFile(input.filePath)
  const diarize = input.diarize ?? settings.diarize
  body.append(
    'file',
    new File([audioBytes], basename(input.filePath), { type: input.mimeType }),
  )
  body.append('model_id', settings.modelId)
  body.append('timestamps_granularity', 'word')
  body.append('diarize', String(diarize))
  body.append('tag_audio_events', String(settings.tagAudioEvents))
  if (diarize) {
    body.append('use_speaker_library', String(settings.useSpeakerLibrary))
  }
  if (settings.languageCode) body.append('language_code', settings.languageCode)
  if (diarize && settings.numSpeakers !== undefined) {
    body.append('num_speakers', String(settings.numSpeakers))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs)

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { 'xi-api-key': settings.apiKey },
      body,
      signal: controller.signal,
    })
    const raw = await response.text()
    const payload = parseJson(raw)

    if (!response.ok) {
      throw new Error(
        `ElevenLabs transcription failed (${response.status}): ${readApiError(payload)}`,
      )
    }

    const text = typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!text) throw new Error('ElevenLabs returned an empty transcript')

    const segments = segmentsFromElevenLabsWords(payload.words)
    return {
      text: segments.length > 0 ? formatSpeakerTranscript(segments) : text,
      segments,
      provider: 'elevenlabs',
      model: settings.modelId,
      languageCode:
        typeof payload.language_code === 'string'
          ? payload.language_code
          : undefined,
      languageProbability:
        typeof payload.language_probability === 'number'
          ? payload.language_probability
          : undefined,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `ElevenLabs transcription timed out after ${settings.timeoutMs}ms`,
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function segmentsFromElevenLabsWords(
  value: unknown,
): TranscriptSegment[] {
  if (!Array.isArray(value)) return []

  const segments: TranscriptSegment[] = []
  for (const candidate of value as ElevenLabsWord[]) {
    if (!candidate || typeof candidate !== 'object') continue
    if (
      candidate.type !== 'word' &&
      candidate.type !== 'spacing' &&
      candidate.type !== 'audio_event'
    ) {
      continue
    }

    const text = typeof candidate.text === 'string' ? candidate.text : ''
    if (!text) continue

    const explicitSpeakerId =
      typeof candidate.speaker_id === 'string' && candidate.speaker_id
        ? candidate.speaker_id
        : undefined
    const start = finiteNumber(candidate.start)
    const end = finiteNumber(candidate.end)
    const previous = segments.at(-1)
    const speakerId = explicitSpeakerId || previous?.speakerId || 'speaker_unknown'

    if (previous && previous.speakerId === speakerId) {
      previous.text += text
      if (end !== undefined) previous.end = Math.max(previous.end, end)
      continue
    }

    segments.push({
      speakerId,
      speakerName: displaySpeakerName(speakerId),
      start: start ?? end ?? 0,
      end: end ?? start ?? 0,
      text,
    })
  }

  return segments
    .map(segment => ({ ...segment, text: segment.text.trim() }))
    .filter(segment => segment.text.length > 0)
}

function formatSpeakerTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map(segment => `${segment.speakerName}: ${segment.text}`)
    .join('\n')
}

function displaySpeakerName(speakerId: string): string {
  if (speakerId === 'speaker_unknown') return 'Unknown speaker'
  if (!speakerId.toLowerCase().startsWith('speaker_')) return speakerId
  const suffix = speakerId.slice('speaker_'.length)
  const number = Number(suffix)
  return Number.isInteger(number)
    ? `Speaker ${number + 1}`
    : `Speaker ${suffix.replaceAll('_', ' ')}`
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseJson(raw: string): ElevenLabsResponse {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readApiError(payload: ElevenLabsResponse): string {
  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'unknown API error'
}
