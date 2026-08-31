import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AudioAgentConfig } from './config.js'

export type RecordingAnalysis = {
  title: string
  summary: string
  keyPoints: string[]
  todos: string[]
  tags: string[]
}

export type RecordingAgentResult = RecordingAnalysis & {
  content: string
  createdAt: string
}

export type Recording = {
  id: string
  sourceType: 'local' | 'upload'
  audioPath: string
  transcript: string
  analysis?: RecordingAnalysis
  agentResult?: RecordingAgentResult
  createdAt: string
  updatedAt: string
}

export async function saveRecording(
  config: AudioAgentConfig,
  recording: Recording,
): Promise<Recording> {
  const recordings = await readRecordings(config)
  const existingIndex = recordings.findIndex(item => item.id === recording.id)

  if (existingIndex >= 0) {
    recordings[existingIndex] = recording
  } else {
    recordings.push(recording)
  }

  await writeRecordings(config, recordings)
  return recording
}

export async function readRecordings(
  config: AudioAgentConfig,
): Promise<Recording[]> {
  try {
    const raw = await readFile(getRecordingsPath(config), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOENT') return []
    }

    throw error
  }
}

export async function listRecordings(
  config: AudioAgentConfig,
): Promise<Recording[]> {
  const recordings = await readRecordings(config)
  return recordings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getRecordingById(
  config: AudioAgentConfig,
  id: string,
): Promise<Recording | null> {
  const recordings = await readRecordings(config)
  return recordings.find(recording => recording.id === id) || null
}

export async function updateRecording(
  config: AudioAgentConfig,
  id: string,
  patch: Partial<Omit<Recording, 'id' | 'createdAt'>>,
): Promise<Recording> {
  const recordings = await readRecordings(config)
  const index = recordings.findIndex(recording => recording.id === id)

  if (index < 0) {
    throw new Error(`Recording not found: ${id}`)
  }

  const updated: Recording = {
    ...recordings[index],
    ...patch,
    id,
    createdAt: recordings[index].createdAt,
    updatedAt: new Date().toISOString(),
  }

  recordings[index] = updated
  await writeRecordings(config, recordings)
  return updated
}

function getRecordingsPath(config: AudioAgentConfig): string {
  return join(config.dataDir, 'recordings.json')
}

async function writeRecordings(
  config: AudioAgentConfig,
  recordings: Recording[],
): Promise<void> {
  await mkdir(config.dataDir, { recursive: true })
  await writeFile(getRecordingsPath(config), JSON.stringify(recordings, null, 2))
}
