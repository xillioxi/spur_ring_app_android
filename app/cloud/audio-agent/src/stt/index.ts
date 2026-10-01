import { transcribeWithMock } from './mock.js'
import { transcribeWithVolcengine } from './volcengine.js'
import { transcribeWithElevenLabs } from './elevenlabs.js'
import type { TranscribeInput, TranscriptionResult } from './types.js'

export type {
  TranscriptSegment,
  TranscribeInput,
  TranscriptionResult,
} from './types.js'

export async function transcribeAudio(input: TranscribeInput): Promise<string> {
  return (await transcribeAudioDetailed(input)).text
}

export async function transcribeAudioDetailed(
  input: TranscribeInput,
): Promise<TranscriptionResult> {
  switch (input.config.sttProvider) {
    case 'mock':
      return {
        text: await transcribeWithMock(input),
        segments: [],
        provider: 'mock',
      }
    case 'volcengine':
      return {
        text: await transcribeWithVolcengine(input),
        segments: [],
        provider: 'volcengine',
      }
    case 'elevenlabs':
      return transcribeWithElevenLabs(input)
    default:
      throw new Error(`Unsupported STT provider: ${input.config.sttProvider}`)
  }
}
