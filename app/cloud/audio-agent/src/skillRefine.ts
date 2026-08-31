import type { AudioAgentConfig } from './config.js'
import { completeChatPrompt } from './agent.js'
import { generateAndStoreImage } from './image.js'

export type AssistantSkill = 'document' | 'ppt' | 'image'

export function isAssistantSkill(value: unknown): value is AssistantSkill {
  return value === 'document' || value === 'ppt' || value === 'image'
}

export type SkillRefineInput = {
  config: AudioAgentConfig
  skill: AssistantSkill
  instruction: string
  transcript?: string
  previousOutput?: string
  title?: string
}

export type SkillRefineResult = {
  output: string
  imageUrl?: string
}

export async function refineWithSkill(
  input: SkillRefineInput,
): Promise<SkillRefineResult> {
  const instruction = input.instruction.replace(/\s+/g, ' ').trim()
  if (!instruction) throw new Error('Missing instruction')

  if (input.skill === 'image') {
    const id = `skill-${Date.now()}-${crypto.randomUUID()}`
    const promptSeed = [
      instruction,
      input.previousOutput ? `Prior result:\n${input.previousOutput}` : '',
      input.transcript ? `Transcript:\n${input.transcript}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const image = await generateAndStoreImage({
      config: input.config,
      id,
      transcript: promptSeed,
    })
    const caption = await completeChatPrompt(
      buildSkillUserPrompt(input, instruction),
      input.config,
      skillSystemPrompt('image'),
    ).catch(() => instruction)
    return {
      output: caption.trim() || instruction,
      imageUrl: image.imageUrl,
    }
  }

  const output = await completeChatPrompt(
    buildSkillUserPrompt(input, instruction),
    input.config,
    skillSystemPrompt(input.skill),
  )
  return { output: output.trim() }
}

function skillSystemPrompt(skill: AssistantSkill): string {
  if (skill === 'document') {
    return `You rewrite existing voice-note material into a clean deliverable document.
Follow the user's instruction. Prefer Markdown with a clear title and short sections.
Do not invent facts absent from the context. Return only the document.`
  }
  if (skill === 'ppt') {
    return `You turn existing voice-note material into a concise slide outline for a presentation.
Use Markdown: each slide starts with "## Slide N: Title" then 3–6 bullets.
Follow the user's instruction. Do not invent facts. Return only the outline.`
  }
  return `You write a short image-generation brief (1–3 sentences) matching the user's instruction and context.
Return only the brief text.`
}

function buildSkillUserPrompt(
  input: SkillRefineInput,
  instruction: string,
): string {
  return [
    input.title ? `Card title: ${input.title}` : '',
    input.transcript
      ? `Original transcript:\n<transcript>\n${input.transcript}\n</transcript>`
      : '',
    input.previousOutput
      ? `Current AI result:\n<result>\n${input.previousOutput}\n</result>`
      : '',
    `User instruction (already cleaned):\n<instruction>\n${instruction}\n</instruction>`,
    'Produce the deliverable now.',
  ]
    .filter(Boolean)
    .join('\n\n')
}
