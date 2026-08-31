import type { AudioAgentConfig } from './config.js'
import { runParentAgent } from './agent.js'
import type { Recording, RecordingAgentResult } from './storage.js'

export type IntelligentProcessorInput = {
  config: AudioAgentConfig
  transcript: string
  instruction: string
  recording: Recording
  template?: 'general' | 'meeting_summary'
}

export async function runIntelligentProcessor(
  input: IntelligentProcessorInput,
): Promise<RecordingAgentResult> {
  const agent = await runParentAgent(buildAgentTranscript(input), input.config)
  const content = agent.output || '智能体没有返回内容。'
  const title = buildTitle(content || input.transcript)

  return {
    title,
    summary: buildSummary(content),
    keyPoints: [],
    todos: [],
    tags: ['recording', 'agent'],
    content,
    createdAt: new Date().toISOString(),
  }
}

function buildAgentTranscript(input: IntelligentProcessorInput): string {
  if (input.template === 'meeting_summary') {
    return buildMeetingSummaryPrompt(input)
  }

  return [
    '请执行下面的用户指令。',
    '',
    `<instruction>${input.instruction || '请总结这段录音，提取重点和待办。'}</instruction>`,
    '',
    `录音记录 ID：${input.recording.id}`,
    '',
    '可用上下文：',
    input.transcript,
  ].join('\n')
}

function buildMeetingSummaryPrompt(input: IntelligentProcessorInput): string {
  return [
    '你是录音硬件 App 的专业会议纪要助手。',
    '请把语音转写文本整理成适合前端直接展示的结构化录音纪要。',
    '',
    '输出要求：',
    '1. 使用 Markdown。',
    '2. 不要说“以下是”“我将为你”等开场白。',
    '3. 如果录音不像正式会议，也要按“内容纪要”方式整理。',
    '4. 不要编造具体日期、时长、参会人姓名；未知信息写“未提供”。',
    '5. 说话人未知时，写“[SPEAKER_00]”。',
    '6. 内容要专业、清晰，像录音硬件 App 自动生成的纪要。',
    '',
    '请严格按下面结构输出：',
    '',
    '# 标题：{自动生成一个简洁标题}',
    '',
    '**时间：** 未提供',
    '**时长：** 未提供',
    '**主题标签：** {3-5 个标签，用 / 分隔}',
    '**出席人员：** [SPEAKER_00]',
    '',
    '## 会议概述',
    '- **交流对象：** {如果无法判断，写“未提供”}',
    '- **目的与背景：** {概括这段录音讨论/讲述的背景和目的}',
    '',
    '## 关键信息',
    '- {关键信息 1}',
    '- {关键信息 2}',
    '- {关键信息 3}',
    '',
    '## 核心观点',
    '- {核心观点 1}',
    '- {核心观点 2}',
    '',
    '## 待办/下一步',
    '- {如果没有明确待办，请给出合理的延伸方向或写“未提及明确待办”}',
    '',
    '## 结论',
    '{用 1 段话总结本段录音的核心价值或结论}',
    '',
    '<transcript>',
    input.transcript,
    '</transcript>',
  ].join('\n')
}

function buildTitle(content: string): string {
  const firstLine = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => line.replace(/^#+\s*/, ''))
    .find(Boolean)

  if (!firstLine) return '录音智能体结果'
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine
}

function buildSummary(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > 280 ? `${compact.slice(0, 280)}...` : compact
}
