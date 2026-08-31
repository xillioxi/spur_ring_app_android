import { getConfig } from '../src/config.js'
import { sendAgentResultEmail } from '../src/email.js'

async function main(): Promise<void> {
  const config = {
    ...getConfig(),
    email: {
      ...getConfig().email,
      enabled: true,
    },
  }

  const result = await sendAgentResultEmail({
    config,
    id: `test-${Date.now()}`,
    transcript: '这是一封 Audio Agent 邮件测试。',
    agentOutput: '如果你收到这封邮件，说明 SMTP 配置可用。',
    agentExitCode: 0,
    transcriptPath: '(test)',
    reportUrl: 'http://localhost:18987/reports/test.html',
    durationMs: 1234,
  })

  console.log(JSON.stringify(result, null, 2))
  if ('sent' in result && !result.sent) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
