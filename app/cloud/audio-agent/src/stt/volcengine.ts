import { readFile } from 'fs/promises'
import { extname } from 'path'
import type { TranscribeInput } from './index.js'

export async function transcribeWithVolcengine(
  input: TranscribeInput,
): Promise<string> {
  if (
    !input.config.volcengine.apiKey &&
    (!input.config.volcengine.appId || !input.config.volcengine.accessToken)
  ) {
    throw new Error(
      'Missing Volcengine ASR credentials. Set VOLCENGINE_ASR_API_KEY, or set both VOLCENGINE_ASR_APP_ID and VOLCENGINE_ASR_ACCESS_TOKEN.',
    )
  }

  const mp3Path = await convertToMp3(input)

  if (input.preferFlash) {
    const audioBase64 = await fileToBase64(mp3Path)
    const primary = await recognizeFlash({
      input,
      audioBase64,
      resourceId: input.config.volcengine.flashResourceId,
    })
    if (primary.transcript) return primary.transcript

    if (
      input.config.volcengine.fallbackFlashResourceId &&
      input.config.volcengine.fallbackFlashResourceId !==
        input.config.volcengine.flashResourceId
    ) {
      const fallback = await recognizeFlash({
        input,
        audioBase64,
        resourceId: input.config.volcengine.fallbackFlashResourceId,
      })
      if (fallback.transcript) return fallback.transcript
    }
    // Fall through to URL submit/query if flash is unavailable.
  }

  if (input.config.volcengine.publicBaseUrl) {
    return transcribeWithSubmitQuery({
      input,
      audioUrl: buildPublicMediaUrl(input, mp3Path),
    })
  }

  throw new Error(
    'Volcengine ASR 2.0 requires a public audio URL. Set AUDIO_AGENT_PUBLIC_BASE_URL to a public tunnel or deployed server URL.',
  )
}

async function transcribeWithSubmitQuery(input: {
  input: TranscribeInput
  audioUrl: string
}): Promise<string> {
  const taskId = crypto.randomUUID()
  const submit = await fetch(input.input.config.volcengine.submitEndpoint, {
    method: 'POST',
    headers: buildAucHeaders(input.input, taskId, {
      sequence: '-1',
    }),
    body: JSON.stringify({
      user: {
        uid: input.input.config.volcengine.appId || 'audio-agent',
      },
      audio: {
        url: input.audioUrl,
        language: input.input.config.volcengine.language,
        format: 'mp3',
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
      },
    }),
  })
  const submitResponse = await parseApiResponse(submit)

  if (!isApiSuccess(submitResponse)) {
    throw new Error(formatApiError('Volcengine submit failed', submitResponse))
  }

  const result = await waitForResult({
    input: input.input,
    taskId,
    submitLogId: submitResponse.logId,
  })
  const transcript = extractTranscript(result.body)

  if (!transcript) {
    throw new Error(formatApiError('Volcengine result missing transcript', result))
  }

  return transcript
}

async function waitForResult(input: {
  input: TranscribeInput
  taskId: string
  submitLogId: string | null
}): Promise<ApiResponse> {
  const startedAt = Date.now()

  while (true) {
    const response = await fetch(input.input.config.volcengine.queryEndpoint, {
      method: 'POST',
      headers: buildAucHeaders(input.input, input.taskId, {
        logId: input.submitLogId,
      }),
      body: JSON.stringify({}),
    })
    const apiResponse = await parseApiResponse(response)

    if (isApiSuccess(apiResponse)) {
      return apiResponse
    }

    if (!isApiPending(apiResponse)) {
      throw new Error(formatApiError('Volcengine query failed', apiResponse))
    }

    if (Date.now() - startedAt > input.input.config.volcengine.timeoutMs) {
      throw new Error(`Volcengine query timed out. taskId=${input.taskId}`)
    }

    await Bun.sleep(input.input.config.volcengine.pollIntervalMs)
  }
}

function buildPublicMediaUrl(input: TranscribeInput, mp3Path: string): string {
  const fileName = mp3Path.split('/').pop()
  if (!fileName) {
    throw new Error(`Cannot build media URL for ${mp3Path}`)
  }

  return `${input.config.volcengine.publicBaseUrl.replace(/\/$/, '')}/media/${encodeURIComponent(fileName)}`
}

async function convertToMp3(input: TranscribeInput): Promise<string> {
  if (input.mimeType === 'audio/mp3' || input.filePath.endsWith('.mp3')) {
    return input.filePath
  }

  const mp3Path = input.filePath.replace(
    extname(input.filePath) || '.webm',
    '.mp3',
  )
  const pcmInputArgs =
    input.mimeType === 'audio/pcm' || input.filePath.endsWith('.pcm')
      ? ['-f', 's16le', '-ar', '8000', '-ac', '1']
      : []
  const process = Bun.spawn(
    [
      input.config.ffmpegPath,
      '-y',
      ...pcmInputArgs,
      '-i',
      input.filePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '64k',
      mp3Path,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  const [stderr, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(`ffmpeg conversion failed: ${stderr}`)
  }

  return mp3Path
}

async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return buffer.toString('base64')
}

async function recognizeFlash(input: {
  input: TranscribeInput
  audioBase64: string
  resourceId: string
}): Promise<{ transcript: string; error?: string }> {
  const taskId = crypto.randomUUID()
  const response = await fetch(input.input.config.volcengine.flashEndpoint, {
    method: 'POST',
    headers: buildAuthHeaders(input.input, {
      'Content-Type': 'application/json',
      'X-Api-Resource-Id': input.resourceId,
      'X-Api-Request-Id': taskId,
      'X-Api-Sequence': '-1',
    }),
    body: JSON.stringify({
      user: {
        uid: input.input.config.volcengine.appId || 'audio-agent',
      },
      audio: {
        data: input.audioBase64,
        format: 'mp3',
      },
      request: {
        model_name: 'bigmodel',
        language: input.input.config.volcengine.language,
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
      },
    }),
  })

  const apiStatusCode = response.headers.get('X-Api-Status-Code')
  const apiMessage = response.headers.get('X-Api-Message')
  const logId = response.headers.get('X-Tt-Logid')
  const body = await readResponseBody(response)

  if (response.ok && apiStatusCode === '20000000') {
    const transcript = extractTranscript(body)
    if (transcript) {
      return { transcript }
    }
  }

  return {
    transcript: '',
    error: `Volcengine ASR failed: resourceId=${input.resourceId}, status=${response.status}, apiStatusCode=${apiStatusCode}, apiMessage=${apiMessage}, logId=${logId}, body=${JSON.stringify(body)}`,
  }
}

type ApiResponse = {
  ok: boolean
  status: number
  apiStatusCode: string | null
  apiMessage: string | null
  logId: string | null
  body: unknown
}

async function parseApiResponse(response: Response): Promise<ApiResponse> {
  return {
    ok: response.ok,
    status: response.status,
    apiStatusCode: response.headers.get('X-Api-Status-Code'),
    apiMessage: response.headers.get('X-Api-Message'),
    logId: response.headers.get('X-Tt-Logid'),
    body: await readResponseBody(response),
  }
}

function buildAucHeaders(
  input: TranscribeInput,
  taskId: string,
  options: { sequence?: string; logId?: string | null } = {},
): Record<string, string> {
  const headers = buildAuthHeaders(input, {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': input.config.volcengine.resourceId,
    'X-Api-Request-Id': taskId,
  })

  if (options.sequence) {
    headers['X-Api-Sequence'] = options.sequence
  }

  if (options.logId) {
    headers['X-Tt-Logid'] = options.logId
  }

  return headers
}

function buildAuthHeaders(
  input: TranscribeInput,
  headers: Record<string, string>,
): Record<string, string> {
  if (input.config.volcengine.apiKey) {
    return { ...headers, 'X-Api-Key': input.config.volcengine.apiKey }
  }

  return {
    ...headers,
    'X-Api-App-Key': input.config.volcengine.appId,
    'X-Api-Access-Key': input.config.volcengine.accessToken,
  }
}

function isApiSuccess(response: ApiResponse): boolean {
  return response.ok && response.apiStatusCode === '20000000'
}

function isApiPending(response: ApiResponse): boolean {
  return (
    response.ok &&
    (response.apiStatusCode === '20000001' ||
      response.apiStatusCode === '20000002')
  )
}

function formatApiError(prefix: string, response: ApiResponse): string {
  return `${prefix}: status=${response.status}, apiStatusCode=${response.apiStatusCode}, apiMessage=${response.apiMessage}, logId=${response.logId}, body=${JSON.stringify(response.body)}`
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractTranscript(body: unknown): string {
  if (
    body &&
    typeof body === 'object' &&
    'result' in body &&
    body.result &&
    typeof body.result === 'object' &&
    'text' in body.result &&
    typeof body.result.text === 'string'
  ) {
    return body.result.text
  }

  return ''
}
