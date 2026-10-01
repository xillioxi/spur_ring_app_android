import * as FileSystem from 'expo-file-system/legacy';

import { processAudioWithAi, type AudioTranscriptSegment } from '@/services/audioAgentApi';
import { recordingApi } from '@/services/api/recordingService';
import {
  isDirectScribeConfigured,
  transcribeDirectWithScribe
} from '@/services/elevenLabsScribe';
import type { LocalAudioFile } from '@/services/localAudioLibrary';
import {
  buildMeetingNotePrompt,
  getMeetingNoteTemplate,
  type GenerateMeetingNoteOptions,
  type MeetingNoteSummary
} from '@/services/meetingNoteTemplates';

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
  transcriptSegments?: AudioTranscriptSegment[];
  transcriptionProvider?: string;
  transcriptionModel?: string;
  transcriptionLanguageCode?: string;
  meetingNotes?: string;
  summaryDimensions?: MeetingNoteSummary[];
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
    if (isDirectScribeConfigured()) {
      const result = await transcribeDirectWithScribe({ uri: file.uri, name: file.name });
      const completed: LocalRecordingAnalysis = {
        ...fromFile(file, 'completed'),
        transcript: result.transcript,
        transcriptSegments: result.segments,
        transcriptionProvider: 'elevenlabs',
        transcriptionModel: 'scribe_v2',
        transcriptionLanguageCode: result.languageCode,
        meetingNotes: await createMeetingNotes(result.transcript)
      };
      await saveRecordingAnalysis(completed);
      return completed;
    }

    const result = await processAudioWithAi({ uri: file.uri, name: file.name, taskType: 'recording_summary' });
    const completed: LocalRecordingAnalysis = {
      ...fromFile(file, 'completed'),
      transcript: result.transcript,
      transcriptSegments: result.transcriptSegments,
      transcriptionProvider: result.transcription?.provider,
      transcriptionModel: result.transcription?.model,
      transcriptionLanguageCode: result.transcription?.languageCode,
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

export function getMeetingNoteSummaries(record: LocalRecordingAnalysis): MeetingNoteSummary[] {
  if (record.summaryDimensions?.length) return record.summaryDimensions;
  if (!record.meetingNotes?.trim()) return [];
  return [{
    id: 'original-meeting-notes',
    templateId: 'adaptive-summary',
    title: 'Meeting Notes',
    content: record.meetingNotes,
    mode: 'auto',
    language: 'auto',
    speakerLabels: true,
    createdAt: record.updatedAt,
    updatedAt: record.updatedAt
  }];
}

export async function generateMeetingNoteSummary(
  id: string,
  options: GenerateMeetingNoteOptions
): Promise<{ record: LocalRecordingAnalysis; summary: MeetingNoteSummary }> {
  const record = await getRecordingAnalysis(id);
  if (!record) throw new Error('Recording analysis is unavailable.');
  const transcript = transcriptForSummary(record);
  if (!transcript.trim()) throw new Error('A transcript is required before generating meeting notes.');

  const template = getMeetingNoteTemplate(options.mode === 'auto' ? 'adaptive-summary' : options.templateId);
  const prompt = buildMeetingNotePrompt(template, options);
  const replies = await recordingApi.askAssistant(prompt, { transcript });
  const content = replies.find((item) => item.role === 'assistant')?.text?.trim();
  if (!content) throw new Error('The assistant returned an empty note.');

  const now = Date.now();
  const summary: MeetingNoteSummary = {
    id: `summary-${now}-${Math.random().toString(36).slice(2, 7)}`,
    templateId: options.customPrompt?.trim() ? 'custom' : template.id,
    title: options.customPrompt?.trim() ? 'Custom Summary' : template.title.en,
    content,
    mode: options.mode,
    language: options.language,
    speakerLabels: options.speakerLabels,
    createdAt: now,
    updatedAt: now
  };
  const updated: LocalRecordingAnalysis = {
    ...record,
    summaryDimensions: [...getMeetingNoteSummaries(record), summary],
    updatedAt: now
  };
  await saveRecordingAnalysis(updated);
  return { record: updated, summary };
}

async function createMeetingNotes(transcript: string): Promise<string> {
  try {
    const replies = await recordingApi.askAssistant(
      [
        'Create concise structured meeting notes from this transcript.',
        'Include topics, decisions, action items with owners, and unresolved questions.',
        'Preserve speaker attribution and do not invent information.'
      ].join(' '),
      { transcript }
    );
    return replies.find((item) => item.role === 'assistant')?.text || transcript;
  } catch {
    // Transcription remains useful when the optional summary service is unavailable.
    return transcript;
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

function transcriptForSummary(record: LocalRecordingAnalysis) {
  if (record.transcriptSegments?.length) {
    return record.transcriptSegments
      .map((segment) => `[${formatTranscriptTime(segment.start)}] ${segment.speakerName}: ${segment.text}`)
      .join('\n');
  }
  return record.transcript || '';
}

function formatTranscriptTime(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
