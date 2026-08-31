import type { AudioAgentConfig } from './config.js'
import { completeChatPrompt } from './agent.js'

const POLISH_SYSTEM = `You turn spoken dictation into a Typeless-style minimal expression of what the user meant.
Rules:
- Keep the user's language (English or Chinese).
- Be extremely concise — short, clear, ready to use as text.
- Remove filler, stutters, and false starts.
- Preserve names, numbers, and concrete asks.
- Output ONLY the cleaned text. No quotes, labels, or explanations.`

export async function polishSpokenIntent(
  rawTranscript: string,
  config: AudioAgentConfig,
): Promise<string> {
  const raw = rawTranscript.replace(/\s+/g, ' ').trim()
  if (!raw) throw new Error('Transcript is empty')

  const polished = await completeChatPrompt(
    `Raw speech transcript:\n<transcript>\n${raw}\n</transcript>\n\nReturn the cleaned intent only.`,
    config,
    POLISH_SYSTEM,
  )
  return polished.trim() || raw
}
