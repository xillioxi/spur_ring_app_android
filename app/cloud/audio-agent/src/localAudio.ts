import { readdir, realpath, stat } from 'fs/promises'
import { extname, resolve, sep } from 'path'
import type { AudioAgentConfig } from './config.js'

export type LocalAudioFile = {
  name: string
  path: string
  size: number
  updatedAt: string
}

const supportedAudioExtensions = new Set([
  '.wav',
  '.mp3',
  '.m4a',
  '.webm',
  '.ogg',
  '.pcm',
])

export async function listLocalAudioFiles(
  config: AudioAgentConfig,
): Promise<LocalAudioFile[]> {
  const entries = await readdir(config.localAudioDir, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter(entry => entry.isFile() && isSupportedAudioFile(entry.name))
      .map(async entry => {
        const path = resolve(config.localAudioDir, entry.name)
        const fileStat = await stat(path)

        return {
          name: entry.name,
          path,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
        }
      }),
  )

  return files.sort((a, b) => a.name.localeCompare(b.name))
}

export async function validateLocalAudioPath(
  filePath: string,
  config: AudioAgentConfig,
): Promise<string> {
  const localRoot = await realpath(config.localAudioDir)
  const audioPath = await realpath(resolve(filePath))

  if (audioPath !== localRoot && !audioPath.startsWith(`${localRoot}${sep}`)) {
    throw new Error('filePath must be inside AUDIO_AGENT_LOCAL_AUDIO_DIR')
  }

  if (!isSupportedAudioFile(audioPath)) {
    throw new Error(`Unsupported local audio file type: ${extname(audioPath)}`)
  }

  const fileStat = await stat(audioPath)
  if (!fileStat.isFile()) {
    throw new Error('filePath must point to a file')
  }

  return audioPath
}

export function getMimeTypeForAudioPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mp3':
      return 'audio/mp3'
    case '.wav':
      return 'audio/wav'
    case '.m4a':
      return 'audio/x-m4a'
    case '.ogg':
      return 'audio/ogg'
    case '.pcm':
      return 'audio/pcm'
    case '.webm':
    default:
      return 'audio/webm'
  }
}

function isSupportedAudioFile(filePath: string): boolean {
  return supportedAudioExtensions.has(extname(filePath).toLowerCase())
}
