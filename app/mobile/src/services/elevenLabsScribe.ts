import type { AudioTranscriptSegment } from '@/services/audioAgentApi';

type ScribeWord = {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  type?: unknown;
  speaker_id?: unknown;
};

type ScribeResponse = {
  text?: unknown;
  words?: unknown;
  language_code?: unknown;
  language_probability?: unknown;
};

export type DirectScribeResult = {
  transcript: string;
  segments: AudioTranscriptSegment[];
  languageCode?: string;
  languageProbability?: number;
};

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || '';
const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';

export function isDirectScribeConfigured() {
  return API_KEY.length > 0;
}

/** Debug/local-only direct Scribe path. Production must keep the key server-side. */
export async function transcribeDirectWithScribe(input: {
  uri: string;
  name: string;
}): Promise<DirectScribeResult> {
  if (!API_KEY) throw new Error('Local Scribe key is not configured in this build');

  const body = new FormData();
  body.append('file', {
    uri: input.uri,
    name: input.name || 'recording.ogg',
    type: mimeTypeForAudioName(input.name)
  } as unknown as Blob);
  body.append('model_id', 'scribe_v2');
  body.append('diarize', 'true');
  body.append('tag_audio_events', 'true');
  body.append('timestamps_granularity', 'word');
  body.append('use_speaker_library', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY },
      body,
      signal: controller.signal
    });
    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      throw new Error(`Scribe failed (${response.status}): ${readApiError(payload)}`);
    }

    const plainText = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!plainText) throw new Error('Scribe returned an empty transcript');

    const segments = groupSpeakerSegments(payload.words);
    return {
      transcript: segments.length
        ? segments.map((segment) => `${segment.speakerName}: ${segment.text}`).join('\n')
        : plainText,
      segments,
      languageCode:
        typeof payload.language_code === 'string' ? payload.language_code : undefined,
      languageProbability:
        typeof payload.language_probability === 'number'
          ? payload.language_probability
          : undefined
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Scribe transcription timed out after 5 minutes');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function groupSpeakerSegments(value: unknown): AudioTranscriptSegment[] {
  if (!Array.isArray(value)) return [];

  const segments: AudioTranscriptSegment[] = [];
  for (const candidate of value as ScribeWord[]) {
    if (!candidate || typeof candidate !== 'object') continue;
    if (!['word', 'spacing', 'audio_event'].includes(String(candidate.type))) continue;

    const text = typeof candidate.text === 'string' ? candidate.text : '';
    if (!text) continue;

    const previous = segments.at(-1);
    const explicitSpeaker =
      typeof candidate.speaker_id === 'string' && candidate.speaker_id
        ? candidate.speaker_id
        : undefined;
    const speakerId = explicitSpeaker || previous?.speakerId || 'speaker_unknown';
    const start = finiteNumber(candidate.start);
    const end = finiteNumber(candidate.end);

    if (previous && previous.speakerId === speakerId) {
      previous.text += text;
      if (end !== undefined) previous.end = Math.max(previous.end, end);
      continue;
    }

    segments.push({
      speakerId,
      speakerName: displaySpeakerName(speakerId),
      start: start ?? end ?? 0,
      end: end ?? start ?? 0,
      text
    });
  }

  return segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0);
}

function displaySpeakerName(speakerId: string) {
  if (speakerId === 'speaker_unknown') return 'Unknown speaker';
  if (!speakerId.toLowerCase().startsWith('speaker_')) return speakerId;
  const suffix = speakerId.slice('speaker_'.length);
  const number = Number(suffix);
  return Number.isInteger(number)
    ? `Speaker ${number + 1}`
    : `Speaker ${suffix.replaceAll('_', ' ')}`;
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mimeTypeForAudioName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4') || lower.endsWith('.aac')) {
    return 'audio/mp4';
  }
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  return 'audio/ogg';
}

function parseJson(raw: string): ScribeResponse {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readApiError(payload: ScribeResponse) {
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'unknown API error';
}
