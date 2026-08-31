type AuthConfig =
  | {
      mode: 'api-key'
      apiKey: string
    }
  | {
      mode: 'legacy'
      appId: string
      accessToken: string
    }

type SubmitConfig = {
  auth: AuthConfig
  submitEndpoint: string
  queryEndpoint: string
  resourceId: string
  language?: string
  pollIntervalMs: number
  timeoutMs: number
  verbose: boolean
}

type AudioFormat = 'wav' | 'mp3'

type ApiResponse = {
  ok: boolean
  status: number
  apiStatusCode: string | null
  apiMessage: string | null
  logId: string | null
  body: unknown
}

async function main(): Promise<void> {
  const audioUrl = process.argv[2]

  if (!audioUrl) {
    throw new Error(
      'Usage: bun run test:asr-url <public-audio.wav|public-audio.mp3>',
    )
  }

  const config = readConfig()
  const existingTaskId = process.env.VOLCENGINE_ASR_TASK_ID
  const taskId = existingTaskId || crypto.randomUUID()
  const format = getAudioFormat(audioUrl)

  if (existingTaskId) {
    const queryResponse = await waitForAsrResult({ config, taskId })
    printResult({ taskId, queryResponse })
    return
  }

  const submitResponse = await submitAsrTask({
    audioUrl,
    config,
    format,
    taskId,
  })

  logVerbose(config, {
    phase: 'submit',
    ok: submitResponse.ok,
    status: submitResponse.status,
    apiStatusCode: submitResponse.apiStatusCode,
    apiMessage: submitResponse.apiMessage,
    logId: submitResponse.logId,
    taskId,
    endpoint: config.submitEndpoint,
    resourceId: config.resourceId,
    format,
    responseBody: submitResponse.body,
  })

  if (!isApiSuccess(submitResponse)) {
    process.exitCode = 1
    return
  }

  console.error(`submit ok, taskId=${taskId}`)
  const queryResponse = await waitForAsrResult({
    config,
    taskId,
    submitLogId: submitResponse.logId,
  })
  printResult({ taskId, queryResponse })
}

function printResult(input: {
  taskId: string
  queryResponse: ApiResponse
}): void {
  const transcript = extractTranscript(input.queryResponse.body)
  console.log(transcript)
}

function readConfig(): SubmitConfig {
  return {
    auth: readAuthConfig(),
    submitEndpoint:
      process.env.VOLCENGINE_ASR_SUBMIT_ENDPOINT ||
      'https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/submit',
    queryEndpoint:
      process.env.VOLCENGINE_ASR_QUERY_ENDPOINT ||
      'https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/query',
    resourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID || 'volc.seedasr.auc',
    language: process.env.VOLCENGINE_ASR_LANGUAGE || 'zh-CN',
    pollIntervalMs: Number(process.env.VOLCENGINE_ASR_POLL_INTERVAL_MS || 1000),
    timeoutMs: Number(process.env.VOLCENGINE_ASR_TIMEOUT_MS || 180000),
    verbose: process.env.VOLCENGINE_ASR_VERBOSE === '1',
  }
}

function readAuthConfig(): AuthConfig {
  if (process.env.VOLCENGINE_ASR_API_KEY) {
    return {
      mode: 'api-key',
      apiKey: process.env.VOLCENGINE_ASR_API_KEY,
    }
  }

  const appId = process.env.VOLCENGINE_ASR_APP_ID
  const accessToken = process.env.VOLCENGINE_ASR_ACCESS_TOKEN

  if (appId && accessToken) {
    return {
      mode: 'legacy',
      appId,
      accessToken,
    }
  }

  throw new Error(
    [
      'Missing Volcengine ASR auth config.',
      'Use either VOLCENGINE_ASR_API_KEY for the new console,',
      'or VOLCENGINE_ASR_APP_ID + VOLCENGINE_ASR_ACCESS_TOKEN for the old console.',
    ].join(' '),
  )
}

async function submitAsrTask(input: {
  audioUrl: string
  config: SubmitConfig
  format: AudioFormat
  taskId: string
}): Promise<{
  ok: boolean
  status: number
  apiStatusCode: string | null
  apiMessage: string | null
  logId: string | null
  body: unknown
}> {
  const response = await fetch(input.config.submitEndpoint, {
    method: 'POST',
    headers: buildHeaders(input.config, input.taskId, {
      sequence: '-1',
    }),
    body: JSON.stringify({
      user: {
        uid: 'audio-agent-test',
      },
      audio: {
        url: input.audioUrl,
        language: input.config.language,
        format: input.format,
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

  return parseApiResponse(response)
}

async function waitForAsrResult(input: {
  config: SubmitConfig
  taskId: string
  submitLogId?: string | null
}): Promise<ApiResponse> {
  const startedAt = Date.now()
  let attempts = 0

  while (true) {
    const response = await queryAsrTask(input)
    attempts += 1

    logVerbose(input.config, {
      phase: 'query',
      taskId: input.taskId,
      apiStatusCode: response.apiStatusCode,
      apiMessage: response.apiMessage,
      logId: response.logId,
    })

    if (isApiSuccess(response)) {
      return response
    }

    if (!isApiPending(response)) {
      throw new Error(
        `ASR query failed: status=${response.status}, apiStatusCode=${response.apiStatusCode}, apiMessage=${response.apiMessage}`,
      )
    }

    if (!input.config.verbose) {
      process.stderr.write(
        `processing... ${attempts}s apiStatusCode=${response.apiStatusCode}\r`,
      )
    }

    if (Date.now() - startedAt > input.config.timeoutMs) {
      throw new Error(
        `ASR query timed out after ${input.config.timeoutMs}ms. taskId=${input.taskId}`,
      )
    }

    await Bun.sleep(input.config.pollIntervalMs)
  }
}

async function queryAsrTask(input: {
  config: SubmitConfig
  taskId: string
  submitLogId?: string | null
}): Promise<ApiResponse> {
  const response = await fetch(input.config.queryEndpoint, {
    method: 'POST',
    headers: buildHeaders(input.config, input.taskId, {
      logId: input.submitLogId,
    }),
    body: JSON.stringify({}),
  })

  return parseApiResponse(response)
}

function buildHeaders(
  config: SubmitConfig,
  taskId: string,
  options: { sequence?: string; logId?: string | null } = {},
): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': config.resourceId,
    'X-Api-Request-Id': taskId,
  }

  if (options.sequence) {
    headers['X-Api-Sequence'] = options.sequence
  }

  if (options.logId) {
    headers['X-Tt-Logid'] = options.logId
  }

  if (config.auth.mode === 'api-key') {
    headers['X-Api-Key'] = config.auth.apiKey
  } else {
    headers['X-Api-App-Key'] = config.auth.appId
    headers['X-Api-Access-Key'] = config.auth.accessToken
  }

  return headers
}

function logVerbose(config: SubmitConfig, value: unknown): void {
  if (!config.verbose) return
  console.error(JSON.stringify(value, null, 2))
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

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getAudioFormat(audioUrl: string): AudioFormat {
  const pathname = new URL(audioUrl).pathname.toLowerCase()

  if (pathname.endsWith('.wav')) return 'wav'
  if (pathname.endsWith('.mp3')) return 'mp3'

  throw new Error('Audio URL must end with .wav or .mp3')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
