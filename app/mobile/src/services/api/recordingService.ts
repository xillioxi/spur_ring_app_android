import {
  assistantPrompts,
  getRecordingById,
  recordingGroups,
  reminderCards
} from '@/mock/recordings';
import type {
  AssistantMessage,
  AssistantPrompt,
  RecordingDetail,
  RecordingGroup,
  ReminderCard,
  TranscriptSegment
} from '@/types';

import { apiConfig, apiFetch, waitForMock } from './apiClient';

interface ChatResponse {
  message: string;
  recordingIds?: string[];
  createdAt?: string;
}

export const recordingApi = {
  async listRecordings(): Promise<RecordingGroup[]> {
    if (apiConfig.useMock) return waitForMock(recordingGroups);

    const data = await apiFetch<RecordingGroup[] | { recordings: RecordingGroup[] }>('/api/recordings');
    return Array.isArray(data) ? data : data.recordings;
  },

  async getRecording(id: string): Promise<RecordingDetail> {
    if (apiConfig.useMock) return waitForMock(getRecordingById(id));

    const data = await apiFetch<RecordingDetail | { recording: RecordingDetail }>(`/api/recordings/${id}`);
    return 'recording' in data ? data.recording : data;
  },

  async getTranscript(id: string): Promise<TranscriptSegment[]> {
    if (apiConfig.useMock) return waitForMock(getRecordingById(id).transcript);

    const data = await apiFetch<TranscriptSegment[] | { transcript: TranscriptSegment[] }>(
      `/api/recordings/${id}/transcript`
    );
    return Array.isArray(data) ? data : data.transcript;
  },

  async listAssistantPrompts(): Promise<AssistantPrompt[]> {
    if (apiConfig.useMock) return waitForMock(assistantPrompts);
    return apiFetch<AssistantPrompt[]>('/api/assistant/prompts');
  },

  async askAssistant(
    message: string,
    options?: { transcript?: string; meetingNotes?: string }
  ): Promise<AssistantMessage[]> {
    const contextBlocks: string[] = [];
    if (options?.meetingNotes?.trim()) {
      contextBlocks.push(`Meeting notes:\n${options.meetingNotes.trim()}`);
    }
    if (options?.transcript?.trim()) {
      contextBlocks.push(`Transcript:\n${options.transcript.trim()}`);
    }

    const prompt =
      contextBlocks.length > 0
        ? [
            'Answer the user question using only the meeting notes and transcript below.',
            'If the answer is not in the materials, say so briefly.',
            '',
            contextBlocks.join('\n\n'),
            '',
            `User question:\n${message}`
          ].join('\n')
        : message;

    const data = await apiFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: prompt })
    });

    return [
      {
        id: `assistant-${data.createdAt || Date.now()}`,
        role: 'assistant',
        text: data.message
      }
    ];
  },

  async listReminders(): Promise<ReminderCard[]> {
    if (apiConfig.useMock) return waitForMock(reminderCards);
    return apiFetch<ReminderCard[]>('/api/assistant/reminders');
  }
};
