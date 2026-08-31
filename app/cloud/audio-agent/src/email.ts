import { Socket } from 'net'
import { connect as tlsConnect, type TLSSocket } from 'tls'
import type { AudioAgentConfig } from './config.js'

export type EmailResult =
  | {
      enabled: false
      sent: false
    }
  | {
      enabled: true
      sent: true
      to: string
    }
  | {
      enabled: true
      sent: false
      to: string
      error: string
    }

export type AgentResultEmailInput = {
  config: AudioAgentConfig
  id: string
  transcript: string
  agentOutput: string
  agentExitCode: number
  transcriptPath: string
  reportUrl: string
  durationMs: number
}

type SmtpSocket = Socket | TLSSocket

export async function sendAgentResultEmail(
  input: AgentResultEmailInput,
): Promise<EmailResult> {
  const email = input.config.email
  if (!email.enabled) {
    return { enabled: false, sent: false }
  }

  try {
    validateEmailConfig(input.config)
    const subject = `Audio Agent 任务完成：${input.id}`
    const text = [
      'Audio Agent 任务已完成。',
      '',
      `任务 ID：${input.id}`,
      `处理耗时：${formatDuration(input.durationMs)}`,
      `Agent exitCode：${input.agentExitCode}`,
      `转写文件：${input.transcriptPath}`,
      '',
      '## 报告链接',
      input.reportUrl,
      '',
      '## 转写文本',
      input.transcript,
      '',
      '## Agent 输出',
      input.agentOutput,
    ].join('\n')

    await sendSmtpMail({
      host: email.smtpHost,
      port: email.smtpPort,
      user: email.smtpUser,
      pass: email.smtpPass,
      from: email.from,
      to: email.to,
      subject,
      text,
    })

    return {
      enabled: true,
      sent: true,
      to: email.to,
    }
  } catch (error) {
    return {
      enabled: true,
      sent: false,
      to: email.to,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'unknown'
  return `${(durationMs / 1000).toFixed(1)}s`
}

function validateEmailConfig(config: AudioAgentConfig): void {
  const required = {
    AUDIO_AGENT_EMAIL_TO: config.email.to,
    AUDIO_AGENT_EMAIL_FROM: config.email.from,
    SMTP_HOST: config.email.smtpHost,
    SMTP_USER: config.email.smtpUser,
    SMTP_PASS: config.email.smtpPass,
  }
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Missing email config: ${missing.join(', ')}`)
  }
}

async function sendSmtpMail(input: {
  host: string
  port: number
  user: string
  pass: string
  from: string
  to: string
  subject: string
  text: string
}): Promise<void> {
  const client = await createSmtpClient(input.host, input.port)

  try {
    await client.expect(220)
    await client.command(`EHLO localhost`, 250)

    if (input.port !== 465) {
      await client.command('STARTTLS', 220)
      await client.startTls(input.host)
      await client.command(`EHLO localhost`, 250)
    }

    await client.command('AUTH LOGIN', 334)
    await client.command(Buffer.from(input.user).toString('base64'), 334)
    await client.command(Buffer.from(input.pass).toString('base64'), 235)
    await client.command(`MAIL FROM:<${input.from}>`, 250)
    await client.command(`RCPT TO:<${input.to}>`, 250)
    await client.command('DATA', 354)
    await client.command(buildEmailMessage(input), 250)
    await client.command('QUIT', 221)
  } finally {
    client.close()
  }
}

async function createSmtpClient(host: string, port: number) {
  let socket: SmtpSocket =
    port === 465
      ? tlsConnect({ host, port, servername: host })
      : new Socket().connect(port, host)
  let buffer = ''

  socket.setEncoding('utf8')

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('secureConnect', resolve)
    socket.once('error', reject)
  })

  socket.on('data', chunk => {
    buffer += chunk
  })

  async function readResponse(): Promise<string> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 30000) {
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const last = lines.at(-1)
      if (last && /^\d{3} /.test(last)) {
        const response = buffer
        buffer = ''
        return response
      }
      await Bun.sleep(25)
    }
    throw new Error('SMTP response timeout')
  }

  return {
    async expect(code: number) {
      const response = await readResponse()
      assertSmtpCode(response, code)
      return response
    },
    async command(command: string, code: number) {
      socket.write(`${command}\r\n`)
      const response = await readResponse()
      assertSmtpCode(response, code)
      return response
    },
    async startTls(servername: string) {
      socket = tlsConnect({
        socket,
        servername,
      })
      buffer = ''
      socket.setEncoding('utf8')
      socket.on('data', chunk => {
        buffer += chunk
      })
      await new Promise<void>((resolve, reject) => {
        socket.once('secureConnect', resolve)
        socket.once('error', reject)
      })
    },
    close() {
      socket.destroy()
    },
  }
}

function assertSmtpCode(response: string, code: number): void {
  if (!response.includes(`${code} `) && !response.includes(`${code}-`)) {
    throw new Error(`SMTP expected ${code}, got: ${response.trim()}`)
  }
}

function buildEmailMessage(input: {
  from: string
  to: string
  subject: string
  text: string
}): string {
  return [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${mimeHeader(input.subject)}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    input.text,
    '.',
  ].join('\r\n')
}

function mimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`
}
