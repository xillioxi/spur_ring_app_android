import * as FileSystem from 'expo-file-system/legacy';

export type LocalQuickNote = {
  id: string;
  text: string;
  title: string;
  createdAt: number;
};

const DIRECTORY = `${FileSystem.documentDirectory}quick-notes/`;
const NOTE_ID = /^quick-note-\d+-[a-f0-9]{8}$/;

export async function listLocalQuickNotes(): Promise<LocalQuickNote[]> {
  const info = await FileSystem.getInfoAsync(DIRECTORY);
  if (!info.exists) return [];
  const names = (await FileSystem.readDirectoryAsync(DIRECTORY))
    .filter((name) => name.endsWith('.json') && NOTE_ID.test(name.slice(0, -5)));
  const notes = await Promise.all(names.map(async (name) => {
    try {
      const raw = JSON.parse(await FileSystem.readAsStringAsync(`${DIRECTORY}${name}`));
      if (!raw || raw.id !== name.slice(0, -5) || typeof raw.text !== 'string' ||
          typeof raw.createdAt !== 'number') return null;
      const text: string = raw.text.trim();
      if (!text) return null;
      const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim() || 'Voice note';
      return {
        id: raw.id as string,
        text,
        title: firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine,
        createdAt: raw.createdAt as number,
      };
    } catch {
      return null;
    }
  }));
  return notes.filter((note): note is LocalQuickNote => note !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteLocalQuickNote(id: string): Promise<void> {
  if (!NOTE_ID.test(id)) throw new Error('Invalid voice note ID');
  await FileSystem.deleteAsync(`${DIRECTORY}${id}.json`, { idempotent: true });
}
