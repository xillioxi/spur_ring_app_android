import * as FileSystem from 'expo-file-system';

import { processAudioWithAi } from '@/services/audioAgentApi';
import type { LocalAudioFile } from '@/services/localAudioLibrary';

export type RecordingProcessStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type LocalRecordingAnalysis = {
  id: string;
  fileUri: string;
  fileName: string;
  durationMs: number;
  size: number;
  modifiedAt: number;
  status: RecordingProcessStatus;
  transcript?: string;
  meetingNotes?: string;
  remoteId?: string;
  error?: string;
  updatedAt: number;
};

const INDEX_PATH = `${FileSystem.documentDirectory}recording-analysis.json`;

export async function listRecordingAnalyses(): Promise<Record<string, LocalRecordingAnalysis>> {
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getRecordingAnalysis(id: string): Promise<LocalRecordingAnalysis | null> {
  const records = await listRecordingAnalyses();
  return records[id] ?? null;
}

export async function processLocalRecording(file: LocalAudioFile): Promise<LocalRecordingAnalysis> {
  await saveRecordingAnalysis(fromFile(file, 'processing'));

  try {
    const result = await processAudioWithAi({ uri: file.uri, name: file.name, taskType: 'recording_summary' });
    const completed: LocalRecordingAnalysis = {
      ...fromFile(file, 'completed'),
      transcript: result.transcript,
      meetingNotes: result.agent.output,
      remoteId: result.id
    };
    await saveRecordingAnalysis(completed);
    return completed;
  } catch (error) {
    const failed: LocalRecordingAnalysis = {
      ...fromFile(file, 'failed'),
      error: error instanceof Error ? error.message : String(error)
    };
    await saveRecordingAnalysis(failed);
    throw error;
  }
}

export async function deleteRecordingAnalysis(id: string) {
  const records = await listRecordingAnalyses();
  delete records[id];
  await writeIndex(records);
}

export async function clearRecordingAnalyses() {
  await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true });
}

async function saveRecordingAnalysis(value: LocalRecordingAnalysis) {
  const records = await listRecordingAnalyses();
  records[value.id] = value;
  await writeIndex(records);
}

async function writeIndex(records: Record<string, LocalRecordingAnalysis>) {
  await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(records));
}

function fromFile(file: LocalAudioFile, status: RecordingProcessStatus): LocalRecordingAnalysis {
  return {
    id: file.id,
    fileUri: file.uri,
    fileName: file.name,
    durationMs: file.durationMs,
    size: file.size,
    modifiedAt: file.modifiedAt,
    status,
    updatedAt: Date.now()
  };
}
