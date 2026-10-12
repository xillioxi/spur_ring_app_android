import * as FileSystem from 'expo-file-system/legacy';

import { processAudioWithAi } from '@/services/audioAgentApi';
import { compareDemoFirst, isDemoAudioName } from '@/services/demoContent';
import { deleteLocalAudioFile, listLocalAudioFiles, type LocalAudioFile } from '@/services/localAudioLibrary';
import { YanqiangVoiceNative } from '@/native/YanqiangVoiceNative';

export type AgentCardStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AgentCardCategory = 'idea' | 'report' | 'action' | 'note';

export type AgentOfficeStatus = 'generating' | 'ready' | 'failed' | 'cancelled';

export type AgentOfficeState = {
  kind: 'pdf' | 'pptx';
  status: AgentOfficeStatus;
  trajectory: string[];
  prompt?: string;
  fileName?: string;
  localUri?: string;
  remoteUrl?: string;
  error?: string;
  startedAt?: number;
};

export type LocalAgentCard = {
  id: string;
  fileUri: string;
  fileName: string;
  durationMs: number;
  modifiedAt: number;
  status: AgentCardStatus;
  favorite: boolean;
  title: string;
  category: AgentCardCategory;
  transcript?: string;
  output?: string;
  imageUrl?: string;
  summary?: string;
  remoteId?: string;
  error?: string;
  office?: AgentOfficeState;
  updatedAt: number;
};

const INDEX_PATH = `${FileSystem.documentDirectory}agent-cards.json`;
const BACKUP_PATH = `${FileSystem.documentDirectory}agent-cards.backup.json`;
let mutationQueue: Promise<void> = Promise.resolve();

export async function syncLocalAgentCards(knownFiles?: LocalAudioFile[]): Promise<LocalAgentCard[]> {
  const [files, saved] = await Promise.all([knownFiles ?? listLocalAudioFiles(), readCards()]);
  const shortFiles = files.filter((file) => file.category === 'agent' || Boolean(saved[file.id]));
  const cards = await Promise.all(shortFiles.map(async (file) => {
    const existing = saved[file.id];
    if (!existing) return createPendingCard(file);
    // Keep completed demo payload, but always refresh playable uri/duration from disk.
    return {
      ...existing,
      id: file.id,
      fileUri: file.uri,
      fileName: file.name,
      durationMs: file.durationMs || existing.durationMs,
      modifiedAt: file.modifiedAt || existing.modifiedAt
    };
  }));

  // Existing results are user data. A change in routing must never erase their index.
  const onDiskNames = new Set(files.map((file) => file.name));
  for (const card of Object.values(saved)) {
    if (cards.some((item) => item.id === card.id)) continue;
    if (!onDiskNames.has(card.fileName) && card.status !== 'completed' && !card.office) continue;
    cards.push(card);
  }

  const latestSaved = await readCards();
  for (const card of cards) {
    const live = latestSaved[card.id];
    if (live && (live.updatedAt || 0) >= (card.updatedAt || 0)) {
      Object.assign(card, live, {
        fileUri: card.fileUri,
        fileName: card.fileName,
        durationMs: card.durationMs,
        modifiedAt: card.modifiedAt
      });
    }
  }

  return sortCards(cards);
}

export async function getLocalAgentCard(id: string): Promise<LocalAgentCard | null> {
  await mutationQueue;
  const cards = await readCards();
  return cards[id] ?? null;
}

export async function processAgentCard(card: LocalAgentCard): Promise<LocalAgentCard> {
  const processing = { ...card, status: 'processing' as const, error: undefined, updatedAt: Date.now() };
  await saveCard(processing);

  try {
    const result = await processAudioWithAi({ uri: card.fileUri, name: card.fileName, taskType: 'agent_command' });
    const output = result.agent.output.trim();
    const imageUrl = await cacheGeneratedImage(card.id, result.agent.imageUrl);
    const completed: LocalAgentCard = {
      ...processing,
      status: 'completed',
      title: deriveTitle(output, result.transcript),
      category: inferCategory(result.transcript, output),
      transcript: result.transcript,
      output,
      imageUrl,
      summary: summarize(output || result.transcript),
      remoteId: result.id,
      updatedAt: Date.now()
    };
    await saveCard(completed);
    if (!isDemoAudioName(completed.fileName) && YanqiangVoiceNative.isAvailable) {
      void YanqiangVoiceNative.showRingStatusNotification(
        'process',
        'Your process is ready in Spur Ring'
      ).catch((error) => console.warn('[ringStatus] notification failed', error));
    }
    return completed;
  } catch (error) {
    const failed: LocalAgentCard = {
      ...processing,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now()
    };
    await saveCard(failed);
    throw error;
  }
}

export async function toggleAgentCardFavorite(card: LocalAgentCard): Promise<LocalAgentCard> {
  const updated = { ...card, favorite: !card.favorite, updatedAt: Date.now() };
  await saveCard(updated);
  return updated;
}

export async function updateAgentCardResult(
  card: LocalAgentCard,
  patch: { output: string; imageUrl?: string }
): Promise<LocalAgentCard> {
  const output = patch.output.trim();
  const imageUrl =
    patch.imageUrl === undefined
      ? card.imageUrl
      : patch.imageUrl
        ? await cacheGeneratedImage(card.id, patch.imageUrl)
        : undefined;
  const updated: LocalAgentCard = {
    ...card,
    status: 'completed',
    title: deriveTitle(output, card.transcript || ''),
    category: inferCategory(card.transcript || '', output),
    output,
    imageUrl,
    summary: summarize(output || card.transcript || ''),
    error: undefined,
    updatedAt: Date.now()
  };
  await saveCard(updated);
  return updated;
}

export async function saveAgentCard(card: LocalAgentCard) {
  await saveCard(card);
}

export async function deleteAgentCard(card: LocalAgentCard) {
  const { cancelOfficeJob } = await import('@/services/officeJob');
  await cancelOfficeJob(card.id).catch(() => undefined);
  await deleteLocalAudioFile(card.fileUri);
  if (card.imageUrl?.startsWith('file')) {
    await FileSystem.deleteAsync(card.imageUrl, { idempotent: true }).catch(() => undefined);
  }
  await mutateCards((cards) => { delete cards[card.id]; });
}

async function cacheGeneratedImage(cardId: string, remoteUrl?: string): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  try {
    const dir = `${FileSystem.documentDirectory}agent-images/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = remoteUrl.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'png';
    const dest = `${dir}${cardId}.${ext}`;
    const downloaded = await FileSystem.downloadAsync(remoteUrl, dest);
    if (downloaded.status !== 200) return remoteUrl;
    return downloaded.uri;
  } catch {
    return remoteUrl;
  }
}

async function createPendingCard(file: LocalAudioFile): Promise<LocalAgentCard> {
  let transcript = '';
  if (file.name.startsWith('command-') && file.name.endsWith('.wav')) {
    try {
      const metadata = JSON.parse(await FileSystem.readAsStringAsync(`${file.uri}.json`));
      if (typeof metadata.transcript === 'string') transcript = metadata.transcript.trim();
    } catch {
      // The audio can still be processed without the optional local transcript.
    }
  }
  return {
    id: file.id,
    fileUri: file.uri,
    fileName: file.name,
    durationMs: file.durationMs,
    modifiedAt: file.modifiedAt,
    status: 'pending',
    favorite: false,
    title: transcript ? deriveTitle('', transcript) : `Voice Command ${formatClock(file.modifiedAt)}`,
    category: 'action',
    transcript: transcript || undefined,
    updatedAt: Date.now()
  };
}

async function readCards(): Promise<Record<string, LocalAgentCard>> {
  for (const path of [INDEX_PATH, BACKUP_PATH]) {
    try {
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(path));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* Try the backup after a partial write. */ }
  }
  return {};
}

async function saveCard(card: LocalAgentCard) {
  await mutateCards((cards) => { cards[card.id] = card; });
}

async function mutateCards(change: (cards: Record<string, LocalAgentCard>) => void): Promise<void> {
  const operation = mutationQueue.then(async () => {
    const original = await readCards();
    const cards = { ...original };
    change(cards);
    await FileSystem.writeAsStringAsync(BACKUP_PATH, JSON.stringify(original)).catch((error) =>
      console.warn('[agentCards] backup failed', error));
    await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(cards));
  });
  mutationQueue = operation.catch(() => undefined);
  await operation;
}

function sortCards(cards: LocalAgentCard[]) {
  return [...cards].sort((a, b) =>
    compareDemoFirst(a.fileName, b.fileName, b.modifiedAt - a.modifiedAt)
  );
}

function deriveTitle(output: string, transcript: string) {
  const first = (output || transcript)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*#+\s*/, '').replace(/[*_`]/g, '').trim())
    .find(Boolean);
  if (!first) return 'Voice Note';
  return first.length > 42 ? `${first.slice(0, 42)}…` : first;
}

function summarize(value: string) {
  const clean = value.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}…` : clean;
}

function inferCategory(transcript: string, output: string): AgentCardCategory {
  const value = `${transcript} ${output}`.toLowerCase();
  if (/report|报告|总结/.test(value)) return 'report';
  if (/remind|todo|action|提醒|待办|任务/.test(value)) return 'action';
  if (/idea|想法|灵感|创意/.test(value)) return 'idea';
  return 'note';
}

function formatClock(timestamp: number) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
