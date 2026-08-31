import { getConfig } from '../src/config.js'
import { transcribeAudio } from '../src/stt/index.js'

async function main(): Promise<void> {
  const filePath = process.argv[2]
  if (!filePath) {
    throw new Error('Usage: bun run test:stt-file <audio.webm|audio.mp3>')
  }

  const config = {
    ...getConfig(),
    sttProvider: 'volcengine' as const,
  }
  const transcript = await transcribeAudio({
    filePath,
    mimeType: filePath.endsWith('.mp3') ? 'audio/mp3' : 'audio/webm',
    config,
  })

  console.log(transcript)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
