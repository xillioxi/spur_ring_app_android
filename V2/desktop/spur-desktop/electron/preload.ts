import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, RingAudioMessage, SpurAPI } from '../src/types';
const invoke = (method: string, ...args: unknown[]) => ipcRenderer.invoke('spur:command', method, ...args);
const api: SpurAPI = {
  codexAction: (action, value) => invoke('codex', { action, value }),
  claudeAction: (action, value) => invoke('claude', { action, value }),
  getState: () => invoke('getState'),
  onState(callback) { const listener = (_event: unknown, state: AppState) => callback(state); ipcRenderer.on('spur:state', listener); return () => ipcRenderer.removeListener('spur:state', listener); },
  scan: address => invoke('scan', address), connect: id => invoke('connect', id), connectAndSync: id => invoke('connectAndSync', id),
  labelRing: (id, label) => invoke('labelRing', { id, label }),
  disconnect: () => invoke('disconnect'), sync: () => invoke('sync'),
  openRecording: id => invoke('openRecording', id), exportRecording: id => invoke('exportRecording', id), openFolder: () => invoke('openFolder'),
  importRecordings: () => invoke('importRecordings'),
  setVoiceDestination: destination => invoke('setVoiceDestination', destination),
  pauseRingButton: () => invoke('pauseRingButton'), resumeRingButton: () => invoke('resumeRingButton'),
  saveSettings: settings => invoke('saveSettings', settings), startDictation: destination => invoke('startDictation', destination), stopDictation: () => invoke('stopDictation'),
  copyTranscript: () => invoke('copyTranscript'), clearTranscript: () => invoke('clearTranscript'), transcribeRecording: id => invoke('transcribeRecording', id),
  minimize: () => invoke('minimize'), close: () => invoke('close'),
  requestPermissions: () => invoke('requestPermissions'),
  sendMicrophoneChunk: pcm => ipcRenderer.send('spur:microphone', pcm), reportMicrophoneError: message => ipcRenderer.send('spur:microphone-error', message),
  onRingAudio(callback) {
    const listener = (_event: unknown, message: RingAudioMessage) => callback(message);
    ipcRenderer.on('spur:ring-audio', listener);
    return () => ipcRenderer.removeListener('spur:ring-audio', listener);
  },
  sendRingPCM: (id, pcm) => ipcRenderer.send('spur:ring-pcm', id, pcm),
  finishRingDecoder: (id, error) => ipcRenderer.send('spur:ring-decoder-end', id, error),
};
contextBridge.exposeInMainWorld('spur', api);
