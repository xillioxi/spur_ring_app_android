import { gunzipSync, gzipSync } from 'zlib'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import WebSocket from 'ws'
import type { AudioAgentConfig } from '../config.js'

const PROTOCOL_VERSION = 0b0001
const HEADER_SIZE = 0b0001
const MSG_FULL_CLIENT = 0b0001
const MSG_AUDIO_ONLY = 0b0010
const MSG_FULL_SERVER = 0b1001
const MSG_ERROR = 0b1111
const FLAG_NO_SEQ = 0b0000
const FLAG_POS_SEQ = 0b0001
const FLAG_NEG_SEQ = 0b0010
const FLAG_NEG_WITH_SEQ = 0b0011
const SERIAL_RAW = 0b0000
const SERIAL_JSON = 0b0001
const COMPRESS_GZIP = 0b0001

/** ~200ms of 16kHz mono s16le */
const PCM_CHUNK_BYTES = 6400

export type SaucTranscribeInput = {
  config: AudioAgentConfig
  filePath: string
  mimeType?: string
}

/**
 * 豆包语音识别模型 2.0 — 大模型流式语音识别（sauc/bigmodel*）。
 * 语音进 → 文字出。不是 S2S realtime-dialog。
 */
export async function transcribeWithSaucBigmodel(
  input: SaucTranscribeInput,
): Promise<string> {
  const { appId, accessToken, apiKey } = input.config.volcengine
  if (!apiKey && (!appId || !accessToken)) {
    throw new Error(
      'Missing Volcengine credentials for SAUC. Set VOLCENGINE_ASR_API_KEY, or APP_ID + ACCESS_TOKEN.',
    )
  }

  const pcm = await convertToPcm16k(input)
  if (!pcm.length) throw new Error('Audio converted to empty PCM')

  const endpoint =
    input.config.volcengine.saucEndpoint ||
    'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream'
  const primaryResource =
    input.config.volcengine.saucResourceId || 'volc.seedasr.sauc.duration'
  const fallbackResources = unique([
    primaryResource,
    'volc.seedasr.sauc.duration',
    'volc.bigasr.sauc.duration',
  ])

  let lastError: Error | null = null
  for (const resourceId of fallbackResources) {
    try {
      return await recognizeOnce({
        input,
        pcm,
        endpoint,
        resourceId,
        appId,
        accessToken,
        apiKey,
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(
        `[sauc] resourceId=${resourceId} failed:`,
        lastError.message,
      )
    }
  }
  throw lastError || new Error('SAUC recognition failed')
}

async function recognizeOnce(input: {
  input: SaucTranscribeInput
  pcm: Buffer
  endpoint: string
  resourceId: string
  appId: string
  accessToken: string
  apiKey: string
}): Promise<string> {
  const connectId = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const headers: Record<string, string> = {
    'X-Api-Resource-Id': input.resourceId,
    'X-Api-Connect-Id': connectId,
    'X-Api-Request-Id': requestId,
  }
  if (input.apiKey) {
    headers['X-Api-Key'] = input.apiKey
  } else {
    headers['X-Api-App-Key'] = input.appId
    headers['X-Api-Access-Key'] = input.accessToken
  }

  const timeoutMs = Math.max(
    30_000,
    input.input.config.volcengine.timeoutMs || 180_000,
  )

  return await new Promise<string>((resolve, reject) => {
    let settled = false
    let latestText = ''
    let finalText = ''
    let started = false
    let seq = 1

    const ws = new WebSocket(input.endpoint, {
      headers,
      handshakeTimeout: 20_000,
      maxPayload: 64 * 1024 * 1024,
    })

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.terminate()
      } catch {
        // ignore
      }
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    const succeed = (text: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // ignore
      }
      const out = text.replace(/\s+/g, ' ').trim()
      if (!out) {
        reject(new Error('SAUC returned empty transcript'))
        return
      }
      resolve(out)
    }

    const timer = setTimeout(() => {
      fail(new Error(`SAUC timed out after ${timeoutMs}ms (${input.resourceId})`))
    }, timeoutMs)

    const sendAudio = () => {
      if (started) return
      started = true
      for (let offset = 0; offset < input.pcm.length; offset += PCM_CHUNK_BYTES) {
        const end = Math.min(offset + PCM_CHUNK_BYTES, input.pcm.length)
        const chunk = input.pcm.subarray(offset, end)
        const isLast = end >= input.pcm.length
        seq += 1
        ws.send(buildAudioOnlyRequest(chunk, isLast ? -seq : seq))
      }
    }

    ws.on('unexpected-response', (_req, res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 240)
        const logId = res.headers['x-tt-logid']
        fail(
          new Error(
            `SAUC handshake HTTP ${res.statusCode} resource=${input.resourceId} logid=${logId || '-'} body=${body || '-'}`,
          ),
        )
      })
    })

    ws.on('open', () => {
      try {
        const startPayload = {
          user: {
            uid: input.appId || 'audio-agent',
          },
          audio: {
            format: 'pcm',
            codec: 'raw',
            rate: 16000,
            bits: 16,
            channel: 1,
            language: input.input.config.volcengine.language || 'zh-CN',
          },
          request: {
            model_name: 'bigmodel',
            enable_itn: true,
            enable_punc: true,
            enable_ddc: true,
            show_utterances: true,
            result_type: 'full',
          },
        }
        ws.send(buildFullClientRequest(startPayload, seq))
        // nostream: can send audio immediately after init frame
        sendAudio()
      } catch (error) {
        fail(error)
      }
    })

    ws.on('message', (data) => {
      try {
        const parsed = parseServerFrame(toBuffer(data))
        if (parsed.kind === 'error') {
          fail(
            new Error(
              `SAUC error ${parsed.code}: ${parsed.message || 'unknown'} (${input.resourceId})`,
            ),
          )
          return
        }
        if (parsed.kind !== 'result') return
        if (parsed.text) latestText = parsed.text
        if (parsed.isFinal && parsed.text) finalText = parsed.text
        if (parsed.isFinal) succeed(finalText || latestText)
      } catch (error) {
        fail(error)
      }
    })

    ws.on('error', (error) => {
      fail(
        new Error(
          `SAUC WebSocket error (${input.resourceId}): ${error.message || String(error)}`,
        ),
      )
    })

    ws.on('close', (code, reasonBuf) => {
      if (settled) return
      if (finalText || latestText) {
        succeed(finalText || latestText)
        return
      }
      const reason = reasonBuf?.toString('utf8') || ''
      fail(
        new Error(
          `SAUC closed code=${code} reason=${reason || '-'} resource=${input.resourceId}`,
        ),
      )
    })
  })
}

async function convertToPcm16k(input: SaucTranscribeInput): Promise<Buffer> {
  const ffmpeg = input.config.ffmpegPath || 'ffmpeg'
  const pcmPath = input.filePath.replace(extname(input.filePath) || '.m4a', '.pcm')

  if (
    input.mimeType === 'audio/pcm' ||
    input.filePath.toLowerCase().endsWith('.pcm')
  ) {
    return Buffer.from(await readFile(input.filePath))
  }

  const process = Bun.spawn(
    [
      ffmpeg,
      '-y',
      '-i',
      input.filePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      pcmPath,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  const [stderr, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`ffmpeg PCM conversion failed: ${stderr}`)
  }
  return Buffer.from(await readFile(pcmPath))
}

function buildHeader(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number,
): Buffer {
  const header = Buffer.alloc(4)
  header[0] = (PROTOCOL_VERSION << 4) | HEADER_SIZE
  header[1] = (messageType << 4) | flags
  header[2] = (serialization << 4) | compression
  header[3] = 0
  return header
}

function buildFullClientRequest(body: unknown, sequence: number): Buffer {
  const json = Buffer.from(JSON.stringify(body), 'utf8')
  const payload = gzipSync(json)
  const header = buildHeader(
    MSG_FULL_CLIENT,
    FLAG_POS_SEQ,
    SERIAL_JSON,
    COMPRESS_GZIP,
  )
  const seq = Buffer.alloc(4)
  seq.writeInt32BE(sequence, 0)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(payload.length, 0)
  return Buffer.concat([header, seq, size, payload])
}

function buildAudioOnlyRequest(pcmChunk: Buffer, sequence: number): Buffer {
  const isLast = sequence < 0
  const flags = isLast ? FLAG_NEG_WITH_SEQ : FLAG_POS_SEQ
  const payload = gzipSync(pcmChunk)
  const header = buildHeader(MSG_AUDIO_ONLY, flags, SERIAL_RAW, COMPRESS_GZIP)
  const seq = Buffer.alloc(4)
  seq.writeInt32BE(sequence, 0)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(payload.length, 0)
  return Buffer.concat([header, seq, size, payload])
}

type ParsedFrame =
  | { kind: 'result'; text: string; isFinal: boolean }
  | { kind: 'error'; code: number; message: string }
  | { kind: 'ignore' }

function parseServerFrame(frame: Buffer): ParsedFrame {
  if (frame.length < 4) return { kind: 'ignore' }

  const messageType = (frame[1] >> 4) & 0x0f
  const flags = frame[1] & 0x0f
  const serialization = (frame[2] >> 4) & 0x0f
  const compression = frame[2] & 0x0f
  const headerSize = (frame[0] & 0x0f) * 4
  let payload = frame.subarray(headerSize)

  if (flags & 0x01) {
    if (payload.length < 4) return { kind: 'ignore' }
    payload = payload.subarray(4) // skip sequence
  }
  const isLast = (flags & 0x02) !== 0

  if (messageType === MSG_ERROR) {
    if (payload.length < 8) {
      return { kind: 'error', code: -1, message: 'truncated error frame' }
    }
    const code = payload.readUInt32BE(0)
    const msgSize = payload.readUInt32BE(4)
    const message = payload.subarray(8, 8 + msgSize).toString('utf8')
    return { kind: 'error', code, message }
  }

  if (messageType !== MSG_FULL_SERVER) return { kind: 'ignore' }
  if (payload.length < 4) return { kind: 'ignore' }

  const payloadSize = payload.readUInt32BE(0)
  let bodyBytes = payload.subarray(4, 4 + payloadSize)
  if (compression === COMPRESS_GZIP) {
    bodyBytes = Buffer.from(gunzipSync(bodyBytes))
  }
  if (serialization !== SERIAL_JSON) return { kind: 'ignore' }

  let body: unknown
  try {
    body = JSON.parse(bodyBytes.toString('utf8'))
  } catch {
    return { kind: 'ignore' }
  }

  const text = extractText(body)
  return {
    kind: 'result',
    text,
    isFinal: isLast || hasDefiniteUtterance(body),
  }
}

function extractText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const result = (body as { result?: unknown }).result
  if (!result || typeof result !== 'object') return ''
  const text = (result as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

function hasDefiniteUtterance(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const result = (body as { result?: unknown }).result
  if (!result || typeof result !== 'object') return false
  const utterances = (result as { utterances?: unknown }).utterances
  if (!Array.isArray(utterances)) return false
  return utterances.some(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item as { definite?: unknown }).definite === true,
  )
}

function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  if (Array.isArray(data)) return Buffer.concat(data.map((part) => Buffer.from(part)))
  return Buffer.from(String(data))
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

// silence unused const warning in some toolchains
void FLAG_NO_SEQ
void FLAG_NEG_SEQ
