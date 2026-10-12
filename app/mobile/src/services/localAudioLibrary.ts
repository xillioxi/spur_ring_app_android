import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { compareDemoFirst, demoDurationMs } from '@/services/demoContent';

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
const DURATION_CACHE_PATH = `${FileSystem.documentDirectory}audio-duration-cache.json`;
const AGENT_THRESHOLD_MS = 15_000;
const durationCache = new Map<string, { size: number; modifiedAt: number; durationMs: number }>();
let durationCacheLoaded = false;
let savedDurationCacheJson = '';
let listInFlight: Promise<LocalAudioFile[]> | null = null;

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
  if (listInFlight) return listInFlight;
  listInFlight = scanLocalAudioFiles().finally(() => { listInFlight = null; });
  return listInFlight;
}

async function scanLocalAudioFiles(): Promise<LocalAudioFile[]> {
  const dir = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dir.exists) return [];

  await loadDurationCache();

  const deleted = await readDeletedAudioNames();
  const names = (await FileSystem.readDirectoryAsync(RECORDING_DIR)).filter((name) => {
    const lower = name.toLowerCase();
    if (!(lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.wav'))) return false;
    return !deleted.has(name);
  });
  // A damaged file must not hide every saved note or process.
  const files: LocalAudioFile[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, names.length) }, async () => {
    while (next < names.length) {
      const name = names[next++];
      try { files.push(await loadFile(name)); }
      catch (error) { console.warn('[audioLibrary] unable to read recording', name, error); }
    }
  }));
  const current = new Set(files.map((file) => file.uri));
  for (const uri of durationCache.keys()) if (!current.has(uri)) durationCache.delete(uri);
  await saveDurationCache();
  return files.sort((a, b) => compareDemoFirst(a.name, b.name, b.modifiedAt - a.modifiedAt));
}

async function loadDurationCache() {
  if (durationCacheLoaded) return;
  durationCacheLoaded = true;
  try {
    const raw = await FileSystem.readAsStringAsync(DURATION_CACHE_PATH);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [uri, value] of Object.entries(parsed)) {
      const entry = value as { size?: unknown; modifiedAt?: unknown; durationMs?: unknown };
      if (typeof entry.size === 'number' && typeof entry.modifiedAt === 'number' &&
          typeof entry.durationMs === 'number' && entry.durationMs > 0) {
        durationCache.set(uri, { size: entry.size, modifiedAt: entry.modifiedAt, durationMs: entry.durationMs });
      }
    }
    savedDurationCacheJson = JSON.stringify(Object.fromEntries(durationCache));
  } catch {
    // A missing or invalid cache only means durations will be measured again.
  }
}

async function saveDurationCache() {
  const next = JSON.stringify(Object.fromEntries(durationCache));
  if (next === savedDurationCacheJson) return;
  try {
    await FileSystem.writeAsStringAsync(DURATION_CACHE_PATH, next);
    savedDurationCacheJson = next;
  } catch {
    // Duration caching is optional; the recording library still works without it.
  }
}

export async function deleteLocalAudioFile(uri: string) {
  const name = uri.split('/').pop();
  if (name) await rememberDeletedAudioNames([name]);
  await FileSystem.deleteAsync(uri, { idempotent: true });
  if (name?.startsWith('command-') && name.endsWith('.wav')) {
    await FileSystem.deleteAsync(`${uri}.json`, { idempotent: true });
  }
  durationCache.delete(uri);
}

export async function clearLocalAudioFiles() {
  const existingNames = await listAudioNamesOnDisk();
  if (existingNames.length > 0) await rememberDeletedAudioNames(existingNames);

  await FileSystem.deleteAsync(RECORDING_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
  await FileSystem.deleteAsync(ANALYSIS_PATH, { idempotent: true });
  await FileSystem.deleteAsync(AGENT_CARDS_PATH, { idempotent: true });
  await FileSystem.deleteAsync(DURATION_CACHE_PATH, { idempotent: true });
  durationCache.clear();
  savedDurationCacheJson = '';
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
    return lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.wav');
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
  const size = info.exists && 'size' in info ? Number(info.size || 0) : 0;
  const modifiedAt = info.exists && 'modificationTime' in info ? Number(info.modificationTime || 0) * 1000 : 0;
  const cached = durationCache.get(uri);
  const durationMs = demoDurationMs(name) ?? (cached && cached.size === size && cached.modifiedAt === modifiedAt
    ? cached.durationMs
    : await readDuration(uri));
  if (durationMs > 0 && (!cached || cached.size !== size || cached.modifiedAt !== modifiedAt)) {
    durationCache.set(uri, { size, modifiedAt, durationMs });
  } else if (durationMs <= 0) {
    durationCache.delete(uri);
  }
  return {
    id: uri,
    name,
    uri,
    size,
    modifiedAt,
    durationMs,
    category: name.startsWith('command-') && name.endsWith('.wav')
      ? 'agent'
      : durationMs > 0 && durationMs < AGENT_THRESHOLD_MS ? 'agent' : 'recording'
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
