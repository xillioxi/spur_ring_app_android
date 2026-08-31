import { mkdir, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import type { AgentResult } from './agent.js'
import type { AudioAgentConfig } from './config.js'
import { imagePromptFromTranscript } from './imageIntent.js'

const MAX_PROMPT_CHARS = 800

export async function generateAndStoreImage(input: {
  config: AudioAgentConfig
  id: string
  transcript: string
}): Promise<AgentResult> {
  const prompt = imagePromptFromTranscript(input.transcript)
  if (!prompt) {
    throw new Error('Transcript is empty, cannot generate image')
  }

  const { apiKey, baseUrl } = input.config.deepseek
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required for image generation')
  }

  const remote = await requestGeneratedImage({
    apiKey,
    baseUrl,
    model: input.config.image.model,
    prompt: prompt.slice(0, MAX_PROMPT_CHARS),
    imageSize: input.config.image.size,
    steps: input.config.image.steps,
    timeoutMs: input.config.image.timeoutMs,
  })

  const fileName = await persistGeneratedImage({
    config: input.config,
    id: input.id,
    remote,
  })

  return {
    output: '',
    exitCode: 0,
    imageUrl: buildPublicImageUrl(input.config, fileName),
  }
}

export function isSafeImageFileName(fileName: string): boolean {
  return /^[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(fileName)
}

export function contentTypeForImage(fileName: string): string {
  switch (extname(fileName).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

async function requestGeneratedImage(input: {
  apiKey: string
  baseUrl: string
  model: string
  prompt: string
  imageSize: string
  steps: number
  timeoutMs: number
}): Promise<{ url?: string; bytes?: Buffer; extension: string }> {
  const endpoint = `${input.baseUrl.replace(/\/$/, '')}/images/generations`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      image_size: input.imageSize,
      batch_size: 1,
      num_inference_steps: input.steps,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  })
  const text = await response.text()
  let body: unknown = null

  try {
    body = JSON.parse(text) as unknown
  } catch {
    // Keep the raw response in the error below.
  }

  if (!response.ok) {
    throw new Error(
      `Image generation failed: status=${response.status}, body=${text}`,
    )
  }

  const extracted = extractGeneratedImage(body)
  if (extracted.b64) {
    return {
      bytes: Buffer.from(extracted.b64, 'base64'),
      extension: '.png',
    }
  }

  if (extracted.url) {
    return {
      url: extracted.url,
      extension: extensionFromUrl(extracted.url),
    }
  }

  throw new Error(`Image generation response missing image: body=${text}`)
}

async function persistGeneratedImage(input: {
  config: AudioAgentConfig
  id: string
  remote: { url?: string; bytes?: Buffer; extension: string }
}): Promise<string> {
  const imagesDir = join(input.config.appRoot, 'images')
  await mkdir(imagesDir, { recursive: true })

  let bytes = input.remote.bytes
  let extension = input.remote.extension

  if (!bytes && input.remote.url) {
    const downloaded = await fetch(input.remote.url, {
      signal: AbortSignal.timeout(input.config.image.timeoutMs),
    })
    if (!downloaded.ok) {
      throw new Error(
        `Failed to download generated image: status=${downloaded.status}`,
      )
    }
    bytes = Buffer.from(await downloaded.arrayBuffer())
    extension =
      extensionFromContentType(downloaded.headers.get('content-type')) ||
      extension
  }

  if (!bytes?.length) {
    throw new Error('Generated image was empty')
  }

  const fileName = `${input.id}${extension}`
  await writeFile(join(imagesDir, fileName), bytes)
  return fileName
}

function buildPublicImageUrl(config: AudioAgentConfig, fileName: string): string {
  const baseUrl =
    config.volcengine.publicBaseUrl || `http://localhost:${config.port}`
  return `${baseUrl.replace(/\/$/, '')}/images/${encodeURIComponent(fileName)}`
}

function extractGeneratedImage(body: unknown): { url?: string; b64?: string } {
  if (!body || typeof body !== 'object') return {}

  const record = body as Record<string, unknown>
  const lists = [record.data, record.images]

  for (const list of lists) {
    if (!Array.isArray(list) || list.length === 0) continue
    const first = list[0]
    if (typeof first === 'string') {
      if (first.startsWith('http')) return { url: first }
      continue
    }
    if (!first || typeof first !== 'object') continue
    const item = first as Record<string, unknown>
    if (typeof item.url === 'string' && item.url.startsWith('http')) {
      return { url: item.url }
    }
    if (typeof item.image === 'string' && item.image.startsWith('http')) {
      return { url: item.image }
    }
    if (typeof item.b64_json === 'string' && item.b64_json) {
      return { b64: item.b64_json }
    }
  }

  return {}
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return '.jpg'
    if (pathname.endsWith('.webp')) return '.webp'
  } catch {
    // Fall through to png.
  }
  return '.png'
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null
  if (contentType.includes('jpeg')) return '.jpg'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('png')) return '.png'
  return null
}
