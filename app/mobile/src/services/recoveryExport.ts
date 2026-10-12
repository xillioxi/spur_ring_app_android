import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const ROOT = FileSystem.documentDirectory;
const INDEXES = [
  'agent-cards.json',
  'agent-cards.backup.json',
  'recording-analysis.json',
  'note-projects.json',
  'legacy-process-recovery.json',
  'audio-duration-cache.json',
  'deleted-audio-names.json',
];

/** Read-only snapshot for diagnosing lost entries; the user chooses where to share it. */
export async function exportRecoveryReport(): Promise<void> {
  if (!ROOT || !(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device');
  }

  const indexes: Record<string, string | null> = {};
  for (const name of INDEXES) {
    try { indexes[name] = await FileSystem.readAsStringAsync(`${ROOT}${name}`); }
    catch { indexes[name] = null; }
  }

  const recordings: Array<{ name: string; size: number; modifiedAt: number }> = [];
  const recordingDir = `${ROOT}voice-recordings/`;
  if ((await FileSystem.getInfoAsync(recordingDir)).exists) {
    for (const name of await FileSystem.readDirectoryAsync(recordingDir)) {
      try {
        const info = await FileSystem.getInfoAsync(`${recordingDir}${name}`);
        if (info.exists && !info.isDirectory) recordings.push({
          name,
          size: 'size' in info ? Number(info.size || 0) : 0,
          modifiedAt: 'modificationTime' in info ? Number(info.modificationTime || 0) * 1000 : 0,
        });
      } catch { /* Report every readable file. */ }
    }
  }

  const quickNotes: Record<string, string> = {};
  const quickDir = `${ROOT}quick-notes/`;
  if ((await FileSystem.getInfoAsync(quickDir)).exists) {
    for (const name of await FileSystem.readDirectoryAsync(quickDir)) {
      if (!/^quick-note-\d+-[a-f0-9]{8}\.json$/.test(name)) continue;
      try { quickNotes[name] = await FileSystem.readAsStringAsync(`${quickDir}${name}`); }
      catch { /* Keep the rest of the report. */ }
    }
  }

  const output = `${ROOT}spur-recovery-export-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(output, JSON.stringify({
    exportedAt: new Date().toISOString(),
    indexes,
    recordings,
    quickNotes,
  }));
  await Sharing.shareAsync(output, { mimeType: 'application/json', dialogTitle: 'Export SPUR saved data' });
}
