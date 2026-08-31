export type AudioTaskType = 'recording_summary' | 'agent_command' | 'agent_image'

export const DEFAULT_AUDIO_TASK_TYPE: AudioTaskType = 'agent_command'

export function isAudioTaskType(value: unknown): value is AudioTaskType {
  return (
    value === 'recording_summary' ||
    value === 'agent_command' ||
    value === 'agent_image'
  )
}

export function buildTaskPrompt(transcript: string, taskType: AudioTaskType): string {
  if (taskType === 'recording_summary') return recordingSummaryPrompt(transcript)
  if (taskType === 'agent_image') return transcript.trim()
  return agentCommandPrompt(transcript)
}

function recordingSummaryPrompt(transcript: string): string {
  return `You are a professional meeting recording assistant for an international AI voice product.

Transform the transcript into an accurate, concise, useful meeting record. Identify topics, decisions, responsibilities, risks, and next steps rather than merely repeating it.

Language: Use English for mainly English transcripts and Chinese for mainly Chinese transcripts. For mixed or unclear language, prefer English while preserving important Chinese names and expressions. The product is English-first, with Chinese as an auxiliary language.

Required output:
# [Concise, specific, informative title]
## Executive Summary
## Key Points
## Decisions
## Action Items
## Risks / Open Questions

For empty Decisions, Action Items, or Risks sections, explicitly say none were recorded. Never invent facts, owners, or deadlines. Remove filler and repetition. Preserve names, numbers, dates, commitments, and technical terms. Return only the final meeting record in Markdown without greetings, explanations, or disclaimers.

Transcript:
<transcript>
${transcript}
</transcript>`
}

function agentCommandPrompt(transcript: string): string {
  return `You are an action-oriented AI voice agent for an international productivity product.

The transcript is a short voice command. Infer the user's intent and complete it directly. Possible tasks include writing content, translation, rewriting, summarizing, capturing ideas, creating plans or to-dos, and answering questions. Never use the meeting-minutes template unless explicitly requested.

Language: Follow an explicitly requested language. Otherwise, answer English in English and Chinese in Chinese. For mixed or unclear input, prefer English while preserving necessary Chinese names and context.

Perform the task immediately without repeating or explaining the transcript. Produce a usable final result. Turn idea-capture requests into concise notes with informative titles. Make conservative assumptions when only minor details are missing; if essential information is absent, ask one concise clarification question. Never invent facts. Return only the final answer in clean Markdown without greetings or meta commentary.

Voice command transcript:
<transcript>
${transcript}
</transcript>`
}
