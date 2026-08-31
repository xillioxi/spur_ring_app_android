import { dirname } from 'path'
import type { AudioAgentConfig } from './config.js'
import { buildTaskPrompt, type AudioTaskType } from './taskPrompts.js'

export type AgentResult = {
  output: string
  exitCode: number
  imageUrl?: string
}

export async function runParentAgent(
  transcript: string,
  config: AudioAgentConfig,
  taskType: AudioTaskType = 'agent_command',
): Promise<AgentResult> {
  const prompt = buildTaskPrompt(transcript, taskType)

  if (config.deepseek.apiKey) {
    const output = await completeChatPrompt(prompt, config)
    return { output, exitCode: 0 }
  }

  return runLocalAgent(prompt, config)
}

/** Direct chat completion (no taskPrompts wrapper). Used by voice polish / skill refine. */
export async function completeChatPrompt(
  userPrompt: string,
  config: AudioAgentConfig,
  systemPrompt =
    'You are a reliable AI voice assistant. Follow the task-specific instructions exactly and return only the requested final content.',
): Promise<string> {
  if (!config.deepseek.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required')
  }

  const endpoint = `${config.deepseek.baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.deepseek.apiKey}`,
    },
    body: JSON.stringify({
      model: config.deepseek.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(isDeepSeekOfficialHost(config.deepseek.baseUrl)
        ? { thinking: { type: 'disabled' } }
        : {}),
      stream: false,
    }),
    signal: AbortSignal.timeout(config.deepseek.timeoutMs),
  })
  const text = await response.text()
  let body: DeepSeekResponse | null = null

  try {
    body = JSON.parse(text) as DeepSeekResponse
  } catch {
    // Keep the raw response in the error below.
  }

  if (!response.ok) {
    throw new Error(
      `DeepSeek request failed: status=${response.status}, body=${text}`,
    )
  }

  const output = body?.choices?.[0]?.message?.content?.trim()
  if (!output) {
    throw new Error(`DeepSeek response missing content: body=${text}`)
  }

  return output
}

function isDeepSeekOfficialHost(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith('deepseek.com')
  } catch {
    return false
  }
}

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

async function runLocalAgent(
  prompt: string,
  config: AudioAgentConfig,
): Promise<AgentResult> {
  const commandParts = config.agentCommand.split(/\s+/).filter(Boolean)
  const [cmd, ...args] = commandParts

  if (!cmd) {
    throw new Error('AUDIO_AGENT_AGENT_COMMAND is empty')
  }

  const process = Bun.spawn([cmd, ...args, prompt], {
    cwd: config.parentRoot,
    env: {
      ...processEnvWithBunOnPath(),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])

  return {
    output: stdout || stderr,
    exitCode,
  }
}

function processEnvWithBunOnPath(): NodeJS.ProcessEnv {
  const bunDir = dirname(process.execPath)
  const existingPath = process.env.PATH || ''

  return {
    ...process.env,
    BUN_INSTALL: process.env.BUN_INSTALL || joinHomeBun(),
    PATH: existingPath.startsWith(`${bunDir}:`)
      ? existingPath
      : `${bunDir}:${existingPath}`,
  }
}

function joinHomeBun(): string {
  return `${process.env.HOME || ''}/.bun`
}
