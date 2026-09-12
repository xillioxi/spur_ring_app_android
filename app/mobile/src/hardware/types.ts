export type RingConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'syncing' | 'error';

export interface RingDevice {
  id: string;
  name: string;
  rssi?: number;
  battery?: number;
  firmwareVersion?: string;
  connectionState: RingConnectionState;
}

export interface RingRecordingFile {
  id: string;
  name: string;
  startedAt: string;
  durationSeconds: number;
  sizeBytes: number;
  format: 'pcm_s16le_8k_mono' | 'wav' | 'unknown';
  syncedBytes: number;
}

export interface RingSyncProgress {
  fileId: string;
  transferredBytes: number;
  totalBytes: number;
  percent: number;
}

export interface RingTransport {
  scan(): Promise<RingDevice[]>;
  connect(deviceId: string): Promise<RingDevice>;
  disconnect(): Promise<void>;
  getBattery(): Promise<number>;
  listFiles(): Promise<RingRecordingFile[]>;
  syncFile(fileId: string, onProgress?: (progress: RingSyncProgress) => void): Promise<string>;
}
