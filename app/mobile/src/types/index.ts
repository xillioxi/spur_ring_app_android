export type SpeakerId = 'sales' | 'market' | 'product';

export interface Speaker {
  id: SpeakerId;
  name: string;
  role: string;
  color: string;
}

export interface RecordingMeta {
  id: string;
  title: string;
  date: string;
  dayLabel: string;
  duration: string;
  source: string;
  location: string;
  unread?: boolean;
  syncState?: 'local' | 'syncing' | 'synced' | 'failed';
}

export interface SummarySection {
  title: string;
  bullets: string[];
}

export interface TranscriptSegment {
  id: string;
  speakerId: SpeakerId;
  time: string;
  text: string;
  highlight?: string;
  edited?: boolean;
}

export interface RecordingDetail extends RecordingMeta {
  tags: string[];
  speakers: Speaker[];
  summarySections: SummarySection[];
  transcript: TranscriptSegment[];
  audioUri?: string;
  pcmUri?: string;
}

export interface RecordingGroup {
  key: string;
  title: string;
  records: RecordingMeta[];
}

export interface AssistantPrompt {
  id: string;
  label: string;
  query: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  relatedRecords?: {
    title: string;
    bullets: string[];
  }[];
}

export interface ReminderCard {
  id: string;
  title: string;
  bullets: string[];
  duration: string;
  date: string;
  location: string;
}
