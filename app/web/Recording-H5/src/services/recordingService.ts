import {
  assistantPrompts,
  getRecordingById,
  recordingGroups,
  reminderCards
} from '../mock/recordings';
import type {
  AssistantMessage,
  AssistantPrompt,
  RecordingDetail,
  RecordingGroup,
  ReminderCard,
  TranscriptSegment
} from '../types';
import { apiFetch, waitForMock } from './apiClient';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

interface ChatResponse {
  message: string;
  recordingIds: string[];
  createdAt: string;
}

export const recordingApi = {
  async listRecordings(): Promise<RecordingGroup[]> {
    if (useMock) return waitForMock(recordingGroups);
    return apiFetch<RecordingGroup[]>('/api/recordings');
  },

  async getRecording(id: string): Promise<RecordingDetail> {
    if (useMock) return waitForMock(getRecordingById(id));
    return apiFetch<RecordingDetail>(`/api/recordings/${id}`);
  },

  async getTranscript(id: string): Promise<TranscriptSegment[]> {
    if (useMock) return waitForMock(getRecordingById(id).transcript);
    return apiFetch<TranscriptSegment[]>(`/api/recordings/${id}/transcript`);
  },

  async listAssistantPrompts(): Promise<AssistantPrompt[]> {
    if (useMock) return waitForMock(assistantPrompts);
    return apiFetch<AssistantPrompt[]>('/api/assistant/prompts');
  },

  async askAssistant(message: string): Promise<AssistantMessage[]> {
    const data = await apiFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
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
    if (useMock) return waitForMock(reminderCards);
    return apiFetch<ReminderCard[]>('/api/assistant/reminders');
  }
};
