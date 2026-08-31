import { copyFile, mkdir, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { runChat } from './chat.js'
import { getConfig } from './config.js'
import { sendAgentResultEmail } from './email.js'
import { runParentAgent } from './agent.js'
import {
  contentTypeForImage,
  generateAndStoreImage,
  isSafeImageFileName,
} from './image.js'
import { transcriptWantsImage } from './imageIntent.js'
import { polishSpokenIntent } from './voicePolish.js'
import { rewriteResultFromIntent } from './resultRewrite.js'
import { transcribeWithSaucBigmodel } from './stt/saucBigmodel.js'
import { isAssistantSkill, refineWithSkill } from './skillRefine.js'
import { DEFAULT_AUDIO_TASK_TYPE, isAudioTaskType } from './taskPrompts.js'
import { createReportPage } from './report.js'
import { createPdfReport } from './pdfReport.js'
import { runIntelligentProcessor } from './intelligentProcessor.js'
import {
  getMimeTypeForAudioPath,
  listLocalAudioFiles,
  validateLocalAudioPath,
} from './localAudio.js'
import {
  getRecordingById,
  listRecordings,
  saveRecording,
  updateRecording,
} from './storage.js'
import { transcribeAudio } from './stt/index.js'

const config = getConfig()
const webRoot = join(config.appRoot, 'src/web')
const uploadsDir = join(config.appRoot, 'uploads')
const transcriptsDir = join(config.appRoot, 'transcripts')
const imagesDir = join(config.appRoot, 'images')
const demoMeetingAudioPath = join(config.localAudioDir, '1.wav')

await Promise.all([
  mkdir(uploadsDir, { recursive: true }),
  mkdir(transcriptsDir, { recursive: true }),
  mkdir(imagesDir, { recursive: true }),
])

Bun.serve({
  port: config.port,
  idleTimeout: 255,
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/') {
      return serveFile(join(webRoot, 'index.html'), 'text/html')
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'audio-agent',
        timestamp: new Date().toISOString(),
      })
    }

    if (request.method === 'GET' && url.pathname === '/app.js') {
      return serveFile(join(webRoot, 'app.js'), 'text/javascript')
    }

    if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
      return serveFile(join(uploadsDir, url.pathname.replace('/media/', '')), 'audio/mpeg')
    }

    if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
      return serveFile(
        join(config.appRoot, url.pathname.replace(/^\//, '')),
        getReportContentType(url.pathname),
      )
    }

    if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
      const fileName = decodeURIComponent(url.pathname.slice('/images/'.length))
      if (!isSafeImageFileName(fileName)) {
        return new Response('Not found', { status: 404 })
      }
      return serveFile(join(imagesDir, fileName), contentTypeForImage(fileName))
    }

    if (request.method === 'POST' && url.pathname === '/api/audio-task') {
      return handleAudioTask(request)
    }

    if (request.method === 'GET' && url.pathname === '/api/local-audio-files') {
      return handleListLocalAudioFiles()
    }

    if (request.method === 'POST' && url.pathname === '/api/transcribe-local') {
      return handleTranscribeLocal(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/audio-agent-local') {
      return handleAudioAgentLocal(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/demo-transcribe') {
      return handleDemoTranscribe()
    }

    if (request.method === 'POST' && url.pathname === '/api/demo-meeting-summary') {
      return handleDemoMeetingSummary(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/demo-transcribe-and-summary') {
      return handleDemoTranscribeAndSummary()
    }

    if (request.method === 'POST' && url.pathname === '/api/agent-command-local') {
      return handleAgentCommandLocal(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/agent-command-local-pdf') {
      return handleAgentCommandLocalPdf(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      return handleChat(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant/voice-intent') {
      return handleAssistantVoiceIntent(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant/voice-polish') {
      return handleAssistantVoicePolish(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant/polish-text') {
      return handleAssistantPolishText(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant/rewrite-result') {
      return handleAssistantRewriteResult(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant/skill-refine') {
      return handleAssistantSkillRefine(request)
    }

    if (request.method === 'GET' && url.pathname === '/api/recordings') {
      return handleListRecordings()
    }

    const recordingMatch = url.pathname.match(/^\/api\/recordings\/([^/]+)$/)
    if (request.method === 'GET' && recordingMatch) {
      return handleGetRecording(recordingMatch[1])
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`Audio Agent listening on http://localhost:${config.port}`)

async function handleListLocalAudioFiles(): Promise<Response> {
  try {
    return Response.json({
      files: await listLocalAudioFiles(config),
    })
  } catch (error) {
    return jsonError(error, 'List local audio files failed')
  }
}

async function handleTranscribeLocal(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''

    if (!filePath) {
      return Response.json({ error: 'Missing filePath' }, { status: 400 })
    }

    const { recording, sourceAudioPath } = await transcribeLocalFile(filePath)

    return Response.json({
      recordingId: recording.id,
      transcript: recording.transcript,
      source: {
        type: recording.sourceType,
        filePath: sourceAudioPath,
        storedPath: recording.audioPath,
      },
    })
  } catch (error) {
    return jsonError(error, 'Transcribe local audio failed')
  }
}

async function handleAudioAgentLocal(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''
    const instruction =
      typeof body.instruction === 'string'
        ? body.instruction
        : '请总结这段录音，提取重点和待办。'

    if (!filePath) {
      return Response.json({ error: 'Missing filePath' }, { status: 400 })
    }

    const { recording, sourceAudioPath } = await transcribeLocalFile(filePath)
    const agentResult = await runIntelligentProcessor({
      config,
      transcript: recording.transcript,
      instruction,
      recording,
    })
    const updatedRecording = await updateRecording(config, recording.id, {
      agentResult,
    })

    return Response.json({
      recording: updatedRecording,
      transcript: updatedRecording.transcript,
      agentResult,
      source: {
        type: updatedRecording.sourceType,
        filePath: sourceAudioPath,
        storedPath: updatedRecording.audioPath,
      },
    })
  } catch (error) {
    return jsonError(error, 'Audio agent local failed')
  }
}

async function handleDemoTranscribe(): Promise<Response> {
  try {
    const { recording, sourceAudioPath } = await transcribeLocalFile(
      demoMeetingAudioPath,
    )

    return Response.json({
      recordingId: recording.id,
      transcript: recording.transcript,
    })
  } catch (error) {
    return jsonError(error, 'Demo transcribe failed')
  }
}

async function handleDemoMeetingSummary(request: Request): Promise<Response> {
  try {
    const body = await readOptionalJson(request)
    const recordingId =
      body && typeof body.recordingId === 'string' ? body.recordingId : ''
    const recording = recordingId
      ? await getRecordingById(config, recordingId)
      : await getLatestRecording()

    if (!recording) {
      return Response.json(
        { error: 'No recording found. Call /api/demo-transcribe first.' },
        { status: 404 },
      )
    }

    const agentResult = await runIntelligentProcessor({
      config,
      transcript: recording.transcript,
      instruction: '请基于这段录音生成结构化会议纪要。',
      recording,
      template: 'meeting_summary',
    })
    const updatedRecording = await updateRecording(config, recording.id, {
      agentResult,
    })

    return Response.json({
      recordingId: updatedRecording.id,
      summary: agentResult.content,
    })
  } catch (error) {
    return jsonError(error, 'Demo meeting summary failed')
  }
}

async function handleDemoTranscribeAndSummary(): Promise<Response> {
  try {
    const { recording, sourceAudioPath } = await transcribeLocalFile(
      demoMeetingAudioPath,
    )
    const agentResult = await runIntelligentProcessor({
      config,
      transcript: recording.transcript,
      instruction: '请基于这段录音生成结构化会议纪要。',
      recording,
      template: 'meeting_summary',
    })
    const updatedRecording = await updateRecording(config, recording.id, {
      agentResult,
    })

    return Response.json({
      recordingId: updatedRecording.id,
      transcript: updatedRecording.transcript,
      summary: agentResult.content,
    })
  } catch (error) {
    return jsonError(error, 'Demo transcribe and summary failed')
  }
}

async function handleAgentCommandLocal(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''

    if (!filePath) {
      return Response.json({ error: 'Missing filePath' }, { status: 400 })
    }

    const { recording, sourceAudioPath } = await transcribeLocalFile(filePath)
    const commandText = recording.transcript.trim()

    if (!commandText) {
      return Response.json(
        { error: 'Agent command transcript is empty' },
        { status: 400 },
      )
    }

    const agentResult = await runIntelligentProcessor({
      config,
      transcript: '这是一段语音指令，不是需要总结的录音材料。请直接执行用户指令。',
      instruction: commandText,
      recording,
    })
    const updatedRecording = await updateRecording(config, recording.id, {
      agentResult,
    })

    return Response.json({
      recordingId: updatedRecording.id,
      commandText,
      result: agentResult.content,
    })
  } catch (error) {
    return jsonError(error, 'Agent command local failed')
  }
}

async function handleAgentCommandLocalPdf(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''

    if (!filePath) {
      return Response.json({ error: 'Missing filePath' }, { status: 400 })
    }

    const { recording } = await transcribeLocalFile(filePath)
    const commandText = recording.transcript.trim()

    if (!commandText) {
      return Response.json(
        { error: 'Agent command transcript is empty' },
        { status: 400 },
      )
    }

    const agentResult = await runIntelligentProcessor({
      config,
      transcript: '这是一段语音指令，不是需要总结的录音材料。请直接执行用户指令。',
      instruction: commandText,
      recording,
    })
    const updatedRecording = await updateRecording(config, recording.id, {
      agentResult,
    })
    const pdf = await createPdfReport({
      config,
      id: updatedRecording.id,
      title: agentResult.title,
      content: agentResult.content,
    })

    return Response.json({
      recordingId: updatedRecording.id,
      commandText,
      result: agentResult.content,
      pdfUrl: pdf.url,
      pdfPath: pdf.filePath,
    })
  } catch (error) {
    return jsonError(error, 'Agent command local PDF failed')
  }
}

async function handleChat(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const recordingIds = Array.isArray(body.recordingIds)
      ? body.recordingIds.filter((id: unknown): id is string => typeof id === 'string')
      : []

    if (!message) {
      return Response.json({ error: 'Missing message' }, { status: 400 })
    }

    const result = await runChat({
      config,
      message,
      recordingIds,
    })

    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Chat failed')
  }
}

async function handleAssistantVoiceIntent(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const id = `${Date.now()}-${crypto.randomUUID()}`
    const uploadPath = join(uploadsDir, `${id}${getAudioExtension(audio)}`)
    await writeFile(uploadPath, Buffer.from(await audio.arrayBuffer()))

    // 悬浮窗：大模型流式 STT（sauc/bigmodel）→ 文字意图，不做 Typeless 清洗，不做 S2S。
    const transcript = await transcribeWithSaucBigmodel({
      config,
      filePath: uploadPath,
      mimeType: audio.type || 'audio/webm',
    })
    const intent = transcript.trim()
    if (!intent) {
      return Response.json({ error: 'Empty transcript' }, { status: 502 })
    }

    return Response.json({
      id,
      transcript: intent,
      intent,
      provider: 'volc.sauc.bigmodel',
    })
  } catch (error) {
    return jsonError(error, 'Voice intent failed')
  }
}

async function handleAssistantVoicePolish(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const id = `${Date.now()}-${crypto.randomUUID()}`
    const uploadPath = join(uploadsDir, `${id}${getAudioExtension(audio)}`)
    await writeFile(uploadPath, Buffer.from(await audio.arrayBuffer()))

    const transcript = await transcribeAudio({
      filePath: uploadPath,
      mimeType: audio.type || 'audio/webm',
      config,
      preferFlash: true,
    })
    const polished = await polishSpokenIntent(transcript, config)

    return Response.json({
      id,
      transcript,
      polished,
    })
  } catch (error) {
    return jsonError(error, 'Voice polish failed')
  }
}

async function handleAssistantPolishText(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return Response.json({ error: 'Missing text' }, { status: 400 })
    }
    const polished = await polishSpokenIntent(text, config)
    return Response.json({ polished })
  } catch (error) {
    return jsonError(error, 'Polish text failed')
  }
}

async function handleAssistantRewriteResult(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const instruction =
      typeof body.instruction === 'string' ? body.instruction.trim() : ''
    if (!instruction) {
      return Response.json({ error: 'Missing instruction' }, { status: 400 })
    }

    const rewriteImage =
      body.rewriteImage === true ||
      body.mode === 'image' ||
      Boolean(body.hasImage)

    const result = await rewriteResultFromIntent({
      config,
      instruction,
      rewriteImage,
      transcript:
        typeof body.transcript === 'string' ? body.transcript : undefined,
      previousOutput:
        typeof body.previousOutput === 'string' ? body.previousOutput : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
    })

    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Rewrite result failed')
  }
}

async function handleAssistantSkillRefine(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const skill = body.skill
    const instruction =
      typeof body.instruction === 'string' ? body.instruction.trim() : ''
    if (!isAssistantSkill(skill)) {
      return Response.json(
        { error: 'skill must be document | ppt | image' },
        { status: 400 },
      )
    }
    if (!instruction) {
      return Response.json({ error: 'Missing instruction' }, { status: 400 })
    }

    const result = await refineWithSkill({
      config,
      skill,
      instruction,
      transcript:
        typeof body.transcript === 'string' ? body.transcript : undefined,
      previousOutput:
        typeof body.previousOutput === 'string' ? body.previousOutput : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
    })

    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Skill refine failed')
  }
}

async function handleListRecordings(): Promise<Response> {
  try {
    return Response.json({
      recordings: await listRecordings(config),
    })
  } catch (error) {
    return jsonError(error, 'List recordings failed')
  }
}

async function handleGetRecording(id: string): Promise<Response> {
  try {
    const recording = await getRecordingById(config, decodeURIComponent(id))

    if (!recording) {
      return Response.json({ error: 'Recording not found' }, { status: 404 })
    }

    return Response.json({ recording })
  } catch (error) {
    return jsonError(error, 'Get recording failed')
  }
}

async function getLatestRecording() {
  const recordings = await listRecordings(config)
  return recordings[0] || null
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength === '0') return null

  const text = await request.text()
  if (!text.trim()) return null

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

async function transcribeLocalFile(filePath: string) {
  const sourceAudioPath = await validateLocalAudioPath(filePath, config)
  const id = `rec_${Date.now()}_${crypto.randomUUID()}`
  const uploadPath = join(
    uploadsDir,
    `${id}${extname(sourceAudioPath).toLowerCase() || '.audio'}`,
  )

  await copyFile(sourceAudioPath, uploadPath)

  const transcript = await transcribeAudio({
    filePath: uploadPath,
    mimeType: getMimeTypeForAudioPath(uploadPath),
    config,
  })
  const now = new Date().toISOString()
  const recording = await saveRecording(config, {
    id,
    sourceType: 'local',
    audioPath: uploadPath,
    transcript,
    createdAt: now,
    updatedAt: now,
  })

  return {
    recording,
    sourceAudioPath,
  }
}

async function handleAudioTask(request: Request): Promise<Response> {
  const startedAt = Date.now()

  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const requestedTaskType = formData.get('taskType')

    if (!(audio instanceof File)) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const taskType = isAudioTaskType(requestedTaskType)
      ? requestedTaskType
      : DEFAULT_AUDIO_TASK_TYPE

    const id = `${Date.now()}-${crypto.randomUUID()}`
    const uploadPath = join(uploadsDir, `${id}${getAudioExtension(audio)}`)
    const transcriptPath = join(transcriptsDir, `${id}.txt`)

    await writeFile(uploadPath, Buffer.from(await audio.arrayBuffer()))

    const transcript = await transcribeAudio({
      filePath: uploadPath,
      mimeType: audio.type || 'audio/webm',
      config,
    })
    await writeFile(transcriptPath, transcript)

    const wantsImage =
      taskType === 'agent_image' ||
      (taskType === 'agent_command' &&
        (await transcriptWantsImage(transcript, config)))
    const agent = wantsImage
      ? await generateAndStoreImage({ config, id, transcript })
      : await runParentAgent(transcript, config, taskType)
    const report = await createReportPage({
      config,
      id,
      transcript,
      agentOutput: agent.output,
      imageUrl: agent.imageUrl,
    })
    const email = await sendAgentResultEmail({
      config,
      id,
      transcript,
      agentOutput: agent.output,
      agentExitCode: agent.exitCode,
      transcriptPath,
      reportUrl: report.url,
      durationMs: Date.now() - startedAt,
    })

    return Response.json({
      id,
      taskType,
      transcript,
      transcriptPath,
      agent,
      report,
      email,
    })
  } catch (error) {
    return jsonError(error, 'Audio task failed')
  }
}

function getAudioExtension(audio: File): string {
  const nameExtension = audio.name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase()
  if (nameExtension) {
    return nameExtension
  }

  switch (audio.type) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return '.wav'
    case 'audio/mp4':
    case 'audio/x-m4a':
      return '.m4a'
    case 'audio/ogg':
      return '.ogg'
    case 'audio/webm':
    default:
      return '.webm'
  }
}

async function serveFile(path: string, contentType: string): Promise<Response> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
    },
  })
}

function getReportContentType(pathname: string): string {
  if (pathname.endsWith('.pdf')) return 'application/pdf'
  if (pathname.endsWith('.html')) return 'text/html'
  return 'application/octet-stream'
}

function jsonError(error: unknown, fallback: string): Response {
  return Response.json(
    {
      error: error instanceof Error ? error.message : fallback,
      details: error instanceof Error ? error.stack : String(error),
    },
    { status: 500 },
  )
}
