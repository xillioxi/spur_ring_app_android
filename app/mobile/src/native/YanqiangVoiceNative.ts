import { NativeEventEmitter, NativeModules, Platform } from 'react-native'

type NativeFile = {
  name: string
  uri: string
  timestamp: number
  size: number
  rawFileTime?: number
}

type RecordingSummary = {
  supported: boolean
  code?: number
  message?: string
  function?: number
  fileCount: number
  totalBytes: number
  files: NativeFile[]
}

type VoiceRecordParamResult = {
  code: number
  message?: string
  data?: {
    volume: number
    bitrate: number
    lightBrightness: number
  }
}

type RingDictationStatus = {
  accessibilityEnabled: boolean
  microphoneGranted: boolean
  listening: boolean
}

type RingDictationAudio = {
  uri: string
  name: string
  size: number
}

type RingDictationStreamEvent = {
  type: 'start' | 'chunk' | 'commit' | 'error'
  sampleRate: number
  audioBase64?: string
}

type YanqiangVoiceNativeModule = {
  initSdk(): Promise<boolean>
  resumeBackgroundSync?(): Promise<boolean>
  startScan(): Promise<boolean>
  stopScan(): void
  connect(macAddress: string): Promise<boolean>
  disconnect(): Promise<boolean>
  setTouchEventReporting(enabled: boolean): Promise<{ enabled: boolean; result: number }>
  getRingDictationStatus(): Promise<RingDictationStatus>
  openRingDictationSettings(): Promise<boolean>
  startRingDictationTest(): Promise<boolean>
  stopRingDictationTest(): Promise<boolean>
  completeRingDictation(text: string): Promise<boolean>
  failRingDictation(message: string): Promise<boolean>
  updateRingDictationPartial(text: string): Promise<boolean>
  getElevenLabsApiKey(packagedKey: string): Promise<string>
  queryVoiceRecordingSummary(): Promise<RecordingSummary>
  syncVoiceRecordings(): Promise<{ files: NativeFile[] }>
  getVoiceRecordParam(): Promise<VoiceRecordParamResult>
  setVoiceRecordParam(
    bitrate: number,
    volume: number,
    lightBrightness: number,
  ): Promise<VoiceRecordParamResult>
}

const native = NativeModules.YanqiangVoiceModule as YanqiangVoiceNativeModule | undefined

export const YanqiangVoiceNative = {
  isAvailable: (Platform.OS === 'android' || Platform.OS === 'ios') && !!native,
  initSdk: () => requireNative().initSdk(),
  resumeBackgroundSync: () => native?.resumeBackgroundSync?.() ?? Promise.resolve(false),
  startScan: () => requireNative().startScan(),
  stopScan: () => requireNative().stopScan(),
  connect: (macAddress: string) => requireNative().connect(macAddress),
  disconnect: () => requireNative().disconnect(),
  setTouchEventReporting: (enabled: boolean) => requireNative().setTouchEventReporting(enabled),
  getRingDictationStatus: () => requireNative().getRingDictationStatus(),
  openRingDictationSettings: () => requireNative().openRingDictationSettings(),
  startRingDictationTest: () => requireNative().startRingDictationTest(),
  stopRingDictationTest: () => requireNative().stopRingDictationTest(),
  completeRingDictation: (text: string) => requireNative().completeRingDictation(text),
  failRingDictation: (message: string) => requireNative().failRingDictation(message),
  updateRingDictationPartial: (text: string) =>
    requireNative().updateRingDictationPartial(text),
  getElevenLabsApiKey: (packagedKey: string) =>
    requireNative().getElevenLabsApiKey(packagedKey),
  queryVoiceRecordingSummary: () => requireNative().queryVoiceRecordingSummary(),
  syncVoiceRecordings: () => requireNative().syncVoiceRecordings(),
  getVoiceRecordParam: () => requireNative().getVoiceRecordParam(),
  setVoiceRecordParam: (bitrate: number, volume: number, lightBrightness: number) =>
    requireNative().setVoiceRecordParam(bitrate, volume, lightBrightness),
}

export const YanqiangVoiceEvents = native ? new NativeEventEmitter(native as any) : undefined

export const YanqiangVoiceEventNames = {
  scan: 'yanqiangVoiceScanEvent',
  connection: 'yanqiangVoiceConnectionChanged',
  status: 'yanqiangVoiceStatusUpdate',
  syncState: 'yanqiangVoiceSyncState',
  syncProgress: 'yanqiangVoiceSyncProgress',
  fileReady: 'yanqiangVoiceFileReady',
  error: 'yanqiangVoiceError',
  touch: 'yanqiangSmartTouchEvent',
  dictationAudio: 'yanqiangDictationAudioReady',
  dictationStream: 'yanqiangDictationStream',
} as const

function requireNative(): YanqiangVoiceNativeModule {
  if (!native) {
    throw new Error(`YanqiangVoiceModule is unavailable on ${Platform.OS} after native installation`)
  }
  return native
}

export type {
  NativeFile,
  RecordingSummary,
  RingDictationAudio,
  RingDictationStreamEvent,
  RingDictationStatus,
  VoiceRecordParamResult,
}
