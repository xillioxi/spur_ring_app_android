import type { AudioAgentConfig } from '../config.js'

export type TranscriptSegment = {
  speakerId: string
  speakerName: string
  start: number
  end: number
  text: string
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptSegment[]
  provider: 'mock' | 'volcengine' | 'elevenlabs'
  model?: string
  languageCode?: string
  languageProbability?: number
}

export type TranscribeInput = {
  filePath: string
  mimeType: string
  config: AudioAgentConfig
  /** Short dictation: try Volcengine flash (base64) before submit/query URL flow. */
  preferFlash?: boolean
  /** Override provider-level diarization for short commands or meeting audio. */
  diarize?: boolean
}
