import type { AudioAgentConfig } from './config.js'

const CLASSIFY_TIMEOUT_MS = 12_000

const IMAGE_INTENT_PATTERNS = [
  /生成.{0,24}(图片|图像|插画|海报|壁纸|封面|图)/,
  /生图|出图|配图|文生图/,
  /(画|绘制)\s*(一)?(张|个|只|幅)/,
  /帮我画|给我画|来画|画一张|画一个/,
  /做\s*(一)?(张|个)\s*(图|图片|插画|海报|壁纸)/,
  /generate\s+(me\s+)?(an?\s+)?(image|picture|illustration|poster|photo)/i,
  /draw\s+(me\s+)?(an?\s+)?/i,
  /create\s+(an?\s+)?(image|picture|illustration|poster)/i,
  /make\s+(an?\s+)?(image|picture|poster|illustration)/i,
  /text[\s-]*to[\s-]*image|txt2img|dall-?e/i,
]

const NOT_IMAGE_PATTERNS = [/画重点/, /划重点/, /画句号/, /画饼/, /画个重点/]

export function hasImageIntentKeywords(transcript: string): boolean {
  const value = transcript.trim()
  if (!value) return false
  if (NOT_IMAGE_PATTERNS.some((pattern) => pattern.test(value))) return false
  return IMAGE_INTENT_PATTERNS.some((pattern) => pattern.test(value))
}

export function imagePromptFromTranscript(transcript: string): string {
  const cleaned = transcript
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(请|麻烦|帮我|给我|我想|我要)?(生成|画|绘制|做|来)?(一)?(张|个|只|幅)?(图片|图像|插画|海报|图)?[：:，,.\s]*/u,
      '',
    )
    .replace(
      /^(please\s+)?((help\s+me|can\s+you)\s+)?(generate|draw|create|make)\s+(me\s+)?(an?\s+)?(image|picture|illustration|poster|photo)\s+(of\s+)?/i,
      '',
    )
    .trim()

  return cleaned || transcript.replace(/\s+/g, ' ').trim()
}

export async function transcriptWantsImage(
  transcript: string,
  config: AudioAgentConfig,
): Promise<boolean> {
  if (hasImageIntentKeywords(transcript)) return true
  if (!transcript.trim() || !config.deepseek.apiKey) return false
  return classifyImageIntentWithLlm(transcript, config)
}

async function classifyImageIntentWithLlm(
  transcript: string,
  config: AudioAgentConfig,
): Promise<boolean> {
  const endpoint = `${config.deepseek.baseUrl.replace(/\/$/, '')}/chat/completions`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        messages: [
          {
            role: 'system',
            content:
              'Decide if the user wants an AI-generated image. Reply with only YES or NO. YES if they ask to draw, paint, illustrate, or generate a picture/image/poster/illustration. NO for notes, translation, todos, summaries, questions, or other text work.',
          },
          { role: 'user', content: transcript.slice(0, 800) },
        ],
        max_tokens: 8,
        temperature: 0,
        ...(isDeepSeekOfficialHost(config.deepseek.baseUrl)
          ? { thinking: { type: 'disabled' } }
          : {}),
        stream: false,
      }),
      signal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
    })
    const text = await response.text()
    if (!response.ok) return false
    const body = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const answer = body.choices?.[0]?.message?.content?.trim().toUpperCase() || ''
    return answer.startsWith('YES')
  } catch {
    return false
  }
}

function isDeepSeekOfficialHost(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith('deepseek.com')
  } catch {
    return false
  }
}
