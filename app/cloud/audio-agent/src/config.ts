import { join } from 'path'
import { fileURLToPath } from 'url'

export type AudioAgentConfig = {
  port: number
  sttProvider: 'mock' | 'volcengine' | 'elevenlabs'
  appRoot: string
  parentRoot: string
  dataDir: string
  localAudioDir: string
  agentCommand: string
  ffmpegPath: string
  volcengine: {
    apiKey: string
    appId: string
    accessToken: string
    publicBaseUrl: string
    submitEndpoint: string
    queryEndpoint: string
    resourceId: string
    flashEndpoint: string
    flashResourceId: string
    fallbackFlashResourceId: string
    /** 大模型流式语音识别（sauc/bigmodel），悬浮窗语音→文字 */
    saucEndpoint: string
    saucResourceId: string
    language: string
    pollIntervalMs: number
    timeoutMs: number
  }
  elevenlabs: {
    apiKey: string
    endpoint: string
    modelId: string
    languageCode: string
    diarize: boolean
    tagAudioEvents: boolean
    useSpeakerLibrary: boolean
    numSpeakers?: number
    timeoutMs: number
  }
  deepseek: {
    apiKey: string
    baseUrl: string
    model: string
    timeoutMs: number
  }
  image: {
    model: string
    size: string
    steps: number
    timeoutMs: number
  }
  email: {
    enabled: boolean
    to: string
    from: string
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPass: string
  }
}

const appRoot = fileURLToPath(new URL('..', import.meta.url))

export function getConfig(): AudioAgentConfig {
  const parentRoot =
    process.env.AUDIO_AGENT_PARENT_ROOT || join(appRoot, '../..')

  return {
    port: Number(process.env.AUDIO_AGENT_PORT || 8787),
    sttProvider: (process.env.AUDIO_AGENT_STT_PROVIDER ||
      (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'mock')) as
      | 'mock'
      | 'volcengine'
      | 'elevenlabs',
    appRoot,
    parentRoot,
    dataDir: process.env.AUDIO_AGENT_DATA_DIR || join(appRoot, 'data'),
    localAudioDir:
      process.env.AUDIO_AGENT_LOCAL_AUDIO_DIR || join(appRoot, '../recording2'),
    agentCommand:
      process.env.AUDIO_AGENT_AGENT_COMMAND ||
      `${process.execPath} run scripts/dev.ts -p`,
    ffmpegPath: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
    volcengine: {
      apiKey: process.env.VOLCENGINE_ASR_API_KEY || '',
      appId: process.env.VOLCENGINE_ASR_APP_ID || '',
      accessToken: process.env.VOLCENGINE_ASR_ACCESS_TOKEN || '',
      publicBaseUrl: process.env.AUDIO_AGENT_PUBLIC_BASE_URL || '',
      submitEndpoint:
        process.env.VOLCENGINE_ASR_SUBMIT_ENDPOINT ||
        'https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/submit',
      queryEndpoint:
        process.env.VOLCENGINE_ASR_QUERY_ENDPOINT ||
        'https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/query',
      resourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID || 'volc.seedasr.auc',
      flashEndpoint:
        process.env.VOLCENGINE_ASR_FLASH_ENDPOINT ||
        'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
      flashResourceId:
        process.env.VOLCENGINE_ASR_FLASH_RESOURCE_ID || 'volc.seedasr.auc',
      fallbackFlashResourceId:
        process.env.VOLCENGINE_ASR_FALLBACK_FLASH_RESOURCE_ID || '',
      saucEndpoint:
        process.env.VOLCENGINE_SAUC_ENDPOINT ||
        'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream',
      saucResourceId:
        process.env.VOLCENGINE_SAUC_RESOURCE_ID ||
        'volc.seedasr.sauc.duration',
      language: process.env.VOLCENGINE_ASR_LANGUAGE || 'zh-CN',
      pollIntervalMs: Number(process.env.VOLCENGINE_ASR_POLL_INTERVAL_MS || 1000),
      timeoutMs: Number(process.env.VOLCENGINE_ASR_TIMEOUT_MS || 180000),
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      endpoint:
        process.env.ELEVENLABS_STT_ENDPOINT ||
        'https://api.elevenlabs.io/v1/speech-to-text',
      modelId: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2',
      languageCode: process.env.ELEVENLABS_STT_LANGUAGE || '',
      diarize: process.env.ELEVENLABS_STT_DIARIZE !== '0',
      tagAudioEvents: process.env.ELEVENLABS_STT_TAG_AUDIO_EVENTS !== '0',
      useSpeakerLibrary:
        process.env.ELEVENLABS_STT_USE_SPEAKER_LIBRARY === '1',
      numSpeakers: optionalSpeakerCount(process.env.ELEVENLABS_STT_NUM_SPEAKERS),
      timeoutMs: Number(process.env.ELEVENLABS_STT_TIMEOUT_MS || 300000),
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 180000),
    },
    image: {
      model: process.env.SILICONFLOW_IMAGE_MODEL || 'Kwai-Kolors/Kolors',
      size: process.env.SILICONFLOW_IMAGE_SIZE || '1024x1024',
      steps: Number(process.env.SILICONFLOW_IMAGE_STEPS || 20),
      timeoutMs: Number(process.env.SILICONFLOW_IMAGE_TIMEOUT_MS || 120000),
    },
    email: {
      enabled: process.env.AUDIO_AGENT_EMAIL_ENABLED === '1',
      to: process.env.AUDIO_AGENT_EMAIL_TO || '',
      from: process.env.AUDIO_AGENT_EMAIL_FROM || process.env.SMTP_USER || '',
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: Number(process.env.SMTP_PORT || 465),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
    },
  }
}

function optionalSpeakerCount(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 32
    ? parsed
    : undefined
}
