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

type YanqiangVoiceNativeModule = {
  initSdk(): Promise<boolean>
  startScan(): Promise<boolean>
  stopScan(): void
  connect(macAddress: string): Promise<boolean>
  disconnect(): Promise<boolean>
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
  isAvailable: Platform.OS === 'android' && !!native,
  initSdk: () => requireNative().initSdk(),
  startScan: () => requireNative().startScan(),
  stopScan: () => requireNative().stopScan(),
  connect: (macAddress: string) => requireNative().connect(macAddress),
  disconnect: () => requireNative().disconnect(),
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
} as const

function requireNative(): YanqiangVoiceNativeModule {
  if (!native) {
    throw new Error('YanqiangVoiceModule is only available on Android after native installation')
  }
  return native
}

export type { NativeFile, RecordingSummary, VoiceRecordParamResult }
