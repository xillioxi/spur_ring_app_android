import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { compareDemoFirst } from '@/services/demoContent';

export type LocalAudioFile = {
  id: string;
  name: string;
  uri: string;
  size: number;
  modifiedAt: number;
  durationMs: number;
  category: 'recording' | 'agent';
};

const RECORDING_DIR = `${FileSystem.documentDirectory}voice-recordings/`;
const ANALYSIS_PATH = `${FileSystem.documentDirectory}recording-analysis.json`;
const AGENT_CARDS_PATH = `${FileSystem.documentDirectory}agent-cards.json`;
const DELETED_AUDIO_NAMES_PATH = `${FileSystem.documentDirectory}deleted-audio-names.json`;
const AGENT_THRESHOLD_MS = 15_000;

/** Playback must ignore the iOS silent switch — opening a recording is intentional. */
export async function preparePlayback(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false
  });
}

export async function listLocalAudioFiles(): Promise<LocalAudioFile[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];

  const deleted = await readDeletedAudioNames();
  const names = (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    if (!(lower.endsWith('.ogg') || lower.endsWith('.m4a'))) return false;
    return !deleted.has(name);
  });
  const files = await Promise.all(names.map(loadFile));
  return files.sort((a, b) => compareDemoFirst(a.name, b.name, b.modifiedAt - a.modifiedAt));
}

export async function deleteLocalAudioFile(uri: string) {
  const name = uri.split('/').pop();
  if (name) await rememberDeletedAudioNames([name]);
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function clearLocalAudioFiles() {
  const existingNames = await listAudioNamesOnDisk();
  if (existingNames.length > 0) await rememberDeletedAudioNames(existingNames);

  await FileSystem.deleteAsync(RECORDING_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
  await FileSystem.deleteAsync(ANALYSIS_PATH, { idempotent: true });
  await FileSystem.deleteAsync(AGENT_CARDS_PATH, { idempotent: true });
}

export async function isDeletedAudioName(name: string): Promise<boolean> {
  const deleted = await readDeletedAudioNames();
  return deleted.has(name);
}

/**
 * After ring sync, permanently drop any files the user already deleted on phone.
 * Sync may still download them from the ring; we remove them again and keep the tombstone.
 */
export async function purgeReimportedDeletedAudio(): Promise<void> {
  const names = await readDeletedAudioNames();
  if (names.size === 0) return;
  await Promise.all(
    [...names].map((name) =>
      FileSystem.deleteAsync(`${RECORDING_DIR}${name}`, { idempotent: true })
    )
  );
}

async function listAudioNamesOnDisk(): Promise<string[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];
  return (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.ogg') || lower.endsWith('.m4a');
  });
}

async function rememberDeletedAudioNames(toAdd: string[]) {
  const names = await readDeletedAudioNames();
  for (const name of toAdd) names.add(name);
  await FileSystem.writeAsStringAsync(DELETED_AUDIO_NAMES_PATH, JSON.stringify([...names]));
}

async function readDeletedAudioNames(): Promise<Set<string>> {
  try {
    const raw = await FileSystem.readAsStringAsync(DELETED_AUDIO_NAMES_PATH);
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

async function loadFile(name: string): Promise<LocalAudioFile> {
  // Keep a raw file:// path for AVPlayback — encoding the filename breaks expo-av on iOS.
  const uri = `${RECORDING_DIR}${name}`;
  const info = await FileSystem.getInfoAsync(uri);
  const durationMs = await readDuration(uri);
  return {
    id: uri,
    name,
    uri,
    size: info.exists && 'size' in info ? Number(info.size || 0) : 0,
    modifiedAt: info.exists && 'modificationTime' in info ? Number(info.modificationTime || 0) * 1000 : 0,
    durationMs,
    // If duration cannot be decoded, retain the file in the recording library instead of
    // accidentally sending it to the agent flow.
    category: durationMs > 0 && durationMs < AGENT_THRESHOLD_MS ? 'agent' : 'recording'
  };
}

async function readDuration(uri: string) {
  let sound: Audio.Sound | null = null;
  try {
    const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    sound = created.sound;
    return created.status.isLoaded ? Number(created.status.durationMillis || 0) : 0;
  } catch {
    return 0;
  } finally {
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }
}
