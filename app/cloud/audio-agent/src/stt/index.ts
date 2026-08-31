import type { AudioAgentConfig } from '../config.js'
import { transcribeWithMock } from './mock.js'
import { transcribeWithVolcengine } from './volcengine.js'

export type TranscribeInput = {
  filePath: string
  mimeType: string
  config: AudioAgentConfig
  /** Short dictation: try Volcengine flash (base64) before submit/query URL flow. */
  preferFlash?: boolean
}

export async function transcribeAudio(input: TranscribeInput): Promise<string> {
  switch (input.config.sttProvider) {
    case 'mock':
      return transcribeWithMock(input)
    case 'volcengine':
      return transcribeWithVolcengine(input)
    default:
      throw new Error(`Unsupported STT provider: ${input.config.sttProvider}`)
  }
}
