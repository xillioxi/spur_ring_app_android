export type AudioSource = 'ring' | 'microphone' | 'ring-recording';
export type RingAudioMessage =
  | { kind: 'start'; id: number }
  | { kind: 'finish'; id: number }
  | { kind: 'cancel'; id: number }
  | { kind: 'data'; id: number; sampleRate: number; channels: number; frameDurationMs: number; frameSize: number; data: Uint8Array };
export type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'syncing';
export interface RingDevice { id: string; name: string; rssi: number; compatible: boolean }
export type Discovery = { status: 'idle' | 'searching' | 'retrying' | 'complete' } | { status: 'failed'; message: string };
export interface Recording { id: string; name: string; path: string; size: number; timestamp: number; transcript?: string }
export interface Settings { hasApiKey: boolean; language: string; shortcut: string; insertAtCursor: boolean; source: AudioSource; credentialStore?: string }
export interface AppState {
  codex?: CodexState;
  claude?: CodexState;
  destination?: 'cursor' | 'project' | 'codex' | 'claude';
  voiceDrafts?: Partial<Record<'claude' | 'codex', { session: number; text: string }>>;
  version: string;
  connection: ConnectionStatus;
  disconnecting?: boolean;
  ringName: string;
  ringAddress?: string;
  ringLabels?: Record<string, string>;
  rememberedRing?: Pick<RingDevice, 'id' | 'name'>;
  autoReconnect?: 'waiting' | 'connecting';
  autoReconnectError?: string;
  ringButton?: 'preparing' | 'ready' | 'paused' | 'error';
  ringButtonError?: string;
  devices: RingDevice[];
  discovery: Discovery;
  recordings: Recording[];
  lastSync?: string;
  syncRetryAddress?: string;
  importNotice?: string;
  transcript: { committed: string; partial: string };
  dictation: { status: 'idle' | 'armed' | 'starting' | 'listening' | 'stopping' | 'error'; source: AudioSource; insertAtCursor: boolean; targetLabel: string; cursorNotice?: string; error?: string; level: number; utteranceStart?: number };
  settings: Settings;
  service: { ready: boolean; error?: string };
  logs: { id: number; time: string; level: 'info' | 'error'; message: string }[];
  progress: number;
  busy: string | null;
  platform?: 'macos' | 'windows';
  permissions?: { accessibility: { required: boolean; granted: boolean; available?: boolean; message?: string }; microphone: string };
}
export interface SpurAPI {
  codexAction(action: string, value?: unknown): Promise<void>;
  claudeAction(action: string, value?: unknown): Promise<void>;
  getState(): Promise<AppState>;
  onState(callback: (state: AppState) => void): () => void;
  scan(address?: string): Promise<void>;
  labelRing(id: string, label: string): Promise<void>;
  connect(id: string): Promise<void>;
  connectAndSync(id: string): Promise<void>;
  disconnect(): Promise<void>;
  sync(): Promise<void>;
  importRecordings(): Promise<void>;
  openRecording(id: string): Promise<void>;
  exportRecording(id: string): Promise<void>;
  openFolder(): Promise<void>;
  saveSettings(settings: { apiKey?: string; language: string; insertAtCursor: boolean; source: AudioSource }): Promise<void>;
  setVoiceDestination(destination: NonNullable<AppState['destination']>): Promise<void>;
  startDictation(destination?: 'project'): Promise<void>;
  pauseRingButton(): Promise<void>;
  resumeRingButton(): Promise<void>;
  stopDictation(): Promise<void>;
  copyTranscript(): Promise<void>;
  clearTranscript(): Promise<void>;
  transcribeRecording(id: string): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  requestPermissions(): Promise<void>;
  sendMicrophoneChunk(pcm: Uint8Array): void;
  reportMicrophoneError(message: string): void;
  onRingAudio(callback: (message: RingAudioMessage) => void): () => void;
  sendRingPCM(id: number, pcm: Uint8Array): void;
  finishRingDecoder(id: number, error?: string): void;
}
declare global { interface Window { spur: SpurAPI } }

export interface CodexMessage { id: string; role: 'user' | 'assistant' | 'activity'; text: string }
export interface CodexConversation { id: string; title: string; project: string }
export interface CodexApproval { id: string; title: string; details: string; canApprove: boolean }
export interface CodexQuestion { id: string; questions: { id: string; question: string; options?: { label: string; description: string }[] }[] }
export interface CodexState {
  model: string;
  models: { id: string; name: string }[];
  status: 'disconnected' | 'connecting' | 'ready' | 'running';
  project: string;
  executable: string;
  authenticated: boolean;
  account: string;
  threadId?: string;
  turnId?: string;
  error?: string;
  activity: string;
  messages: CodexMessage[];
  conversations: CodexConversation[];
  approvals: CodexApproval[];
  questions: CodexQuestion[];
}
