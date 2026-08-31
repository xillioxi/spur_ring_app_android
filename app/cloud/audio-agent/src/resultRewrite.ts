import type { AudioAgentConfig } from './config.js'
import { completeChatPrompt } from './agent.js'
import { generateAndStoreImage } from './image.js'

const REWRITE_SYSTEM = `You revise an existing AI result according to the user's cleaned intent.
Rules:
- Follow the user's intent precisely (short Typeless-style instruction).
- Edit the current result in place — do not replace it with the instruction itself.
- Keep the user's language (English or Chinese) unless they ask to change language.
- Do not invent facts absent from the current result or transcript.
- Return ONLY the revised result text. No quotes, labels, or explanations.`

const IMAGE_PROMPT_SYSTEM = `You write ONE English image-generation prompt for Kolors/Stable Diffusion style models.
Rules:
- Follow the user's voice intent to revise/refine the previous image idea.
- Keep concrete subjects, style, lighting, and composition.
- Do not invent unrelated scenes.
- Output ONLY the prompt text. No quotes, labels, or explanations.`

export type RewriteResultInput = {
  config: AudioAgentConfig
  instruction: string
  previousOutput?: string
  transcript?: string
  title?: string
  /** When true, regenerate image instead of rewriting text. */
  rewriteImage?: boolean
}

export type RewriteResultOutput = {
  output: string
  imageUrl?: string
}

export async function rewriteResultFromIntent(
  input: RewriteResultInput,
): Promise<RewriteResultOutput> {
  const instruction = input.instruction.replace(/\s+/g, ' ').trim()
  if (!instruction) throw new Error('Missing instruction')

  if (input.rewriteImage) {
    return rewriteImageFromIntent(input, instruction)
  }

  const previous = (input.previousOutput || '').trim()
  if (!previous && !(input.transcript || '').trim()) {
    throw new Error('Missing content to rewrite')
  }

  const userPrompt = [
    input.title ? `Card title: ${input.title}` : '',
    input.transcript
      ? `Original transcript:\n<transcript>\n${input.transcript}\n</transcript>`
      : '',
    previous
      ? `Current AI result:\n<result>\n${previous}\n</result>`
      : '',
    `User intent (cleaned):\n<intent>\n${instruction}\n</intent>`,
    'Revise the current AI result according to the intent. Return only the revised result.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const output = await completeChatPrompt(userPrompt, input.config, REWRITE_SYSTEM)
  const text = output.trim()
  if (!text) throw new Error('Rewrite returned empty text')
  return { output: text }
}

async function rewriteImageFromIntent(
  input: RewriteResultInput,
  instruction: string,
): Promise<RewriteResultOutput> {
  const promptSeed = [
    input.title ? `Card title: ${input.title}` : '',
    input.previousOutput
      ? `Previous image caption / result:\n${input.previousOutput}`
      : '',
    input.transcript ? `Original transcript:\n${input.transcript}` : '',
    `User revision intent:\n${instruction}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const imagePrompt = (
    await completeChatPrompt(
      `${promptSeed}\n\nWrite the revised image prompt now.`,
      input.config,
      IMAGE_PROMPT_SYSTEM,
    ).catch(() => instruction)
  ).trim() || instruction

  const id = `rewrite-img-${Date.now()}-${crypto.randomUUID()}`
  const image = await generateAndStoreImage({
    config: input.config,
    id,
    transcript: imagePrompt,
  })

  const caption =
    (
      await completeChatPrompt(
        [
          `User intent: ${instruction}`,
          input.previousOutput
            ? `Previous caption:\n${input.previousOutput}`
            : '',
          'Write a short caption (1–3 sentences) for the revised image. Same language as the user intent. Return only the caption.',
        ]
          .filter(Boolean)
          .join('\n\n'),
        input.config,
        'You write a brief image caption. Return only the caption text.',
      ).catch(() => instruction)
    ).trim() || instruction

  return {
    output: caption,
    imageUrl: image.imageUrl,
  }
}
