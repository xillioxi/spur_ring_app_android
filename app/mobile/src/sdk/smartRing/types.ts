export type SmartRingConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'recording' | 'error';

export interface SmartRingDevice {
  id: string;
  name: string;
  rssi?: number;
  serviceUUIDs?: string[];
}

export interface SmartRingScanOptions {
  timeoutMs?: number;
  namePrefixes?: string[];
  onDeviceFound?: (device: SmartRingDevice) => void;
}

export interface SmartRingConnection {
  device: SmartRingDevice;
  serviceUuid: string;
  writeCharacteristicUuid: string;
  notifyCharacteristicUuid: string;
}

export interface SmartRingPcmPacket {
  payload: Uint8Array;
  payloadLength: number;
  raw: Uint8Array;
  receivedAt: number;
}

export type SmartRingAudioNotifyType = 'record_begin' | 'adpcm_data' | 'record_end' | 'pcm_data' | 'unknown';

export interface SmartRingAudioMeta {
  version: number;
  codec: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  value: number;
  durationMs: number;
}

export interface SmartRingAudioNotify {
  type: SmartRingAudioNotifyType;
  cmd: number;
  subcmd: number;
  payloadLength: number;
  seq: number;
  payload: Uint8Array;
  raw: Uint8Array;
  receivedAt: number;
  meta?: SmartRingAudioMeta;
}

export interface SmartRingRecordingStats {
  packetCount: number;
  pcmBytes: number;
  adpcmBytes?: number;
  pcmSamples?: number;
  lostPackets?: number;
  lastSeq?: number;
  wavPath?: string;
  startedAt?: number;
  stoppedAt?: number;
}

export type SmartRingPcmListener = (packet: SmartRingPcmPacket) => void;
export type SmartRingAudioNotifyListener = (packet: SmartRingAudioNotify) => void;
export type SmartRingLogListener = (message: string) => void;
