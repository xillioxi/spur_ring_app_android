import type { AudioAgentConfig } from './config.js'
import { runParentAgent } from './agent.js'
import { getRecordingById, type Recording } from './storage.js'

export type ChatInput = {
  config: AudioAgentConfig
  message: string
  recordingIds: string[]
}

export type ChatResult = {
  message: string
  recordingIds: string[]
  createdAt: string
}

export async function runChat(input: ChatInput): Promise<ChatResult> {
  const recordings = await getRecordings(input.config, input.recordingIds)
  const prompt = buildChatPrompt({
    message: input.message,
    recordings,
  })
  const agent = await runParentAgent(prompt, input.config)

  return {
    message: agent.output || '大模型没有返回内容。',
    recordingIds: recordings.map(recording => recording.id),
    createdAt: new Date().toISOString(),
  }
}

async function getRecordings(
  config: AudioAgentConfig,
  recordingIds: string[],
): Promise<Recording[]> {
  const recordings = await Promise.all(
    recordingIds.map(id => getRecordingById(config, id)),
  )

  return recordings.filter((recording): recording is Recording =>
    Boolean(recording),
  )
}

function buildChatPrompt(input: {
  message: string
  recordings: Recording[]
}): string {
  const context =
    input.recordings.length > 0
      ? [
          '以下是用户选择的录音上下文：',
          '',
          ...input.recordings.map(recording =>
            [
              `<recording id="${recording.id}">`,
              recording.transcript,
              '</recording>',
            ].join('\n'),
          ),
        ].join('\n')
      : '用户没有选择录音上下文。'

  return [
    '你是录音 App 的大模型助手。',
    '请根据用户消息直接回答。如果提供了录音上下文，请优先结合录音内容。',
    '',
    context,
    '',
    '用户消息：',
    input.message,
  ].join('\n')
}
