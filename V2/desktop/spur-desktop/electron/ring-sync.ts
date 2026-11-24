import type { AppState, RingDevice } from '../src/types';

interface SyncContext {
  state: Pick<AppState, 'busy' | 'lastSync' | 'recordings' | 'ringName' | 'ringAddress' | 'syncRetryAddress' | 'progress'>;
  request(method: 'syncRecordings' | 'connectAndSync', params: { address?: string; storedOnlyIfReported?: boolean }, timeout: null): Promise<{ received: number; notice?: string; inventoryOnly?: boolean }>;
  refreshLibrary(): Promise<void>;
  log(message: string): void;
  changed(): void;
}

export async function syncRingRecordings({ state, request, refreshLibrary, log, changed }: SyncContext, selected?: RingDevice, signal?: AbortSignal, checkInventory = false): Promise<number | undefined> {
  if (state.busy) throw new Error(`Wait until ${state.busy} finishes.`);
  state.busy = 'syncing recordings';
  if (!checkInventory) state.lastSync = undefined;
  state.syncRetryAddress = undefined;
  state.progress = 0;
  if (selected) {
    state.ringName = selected.name;
    state.ringAddress = selected.id;
  }
  changed();
  try {
    await refreshLibrary();
    if (signal?.aborted) return;
    const before = new Set(state.recordings.map(file => file.id));
    // Native bounds each connection, write and idle period, including its reconnect.
    // An active transfer may take longer than any one of those deadlines.
    const { received, notice, inventoryOnly } = selected
      ? await request('connectAndSync', { address: selected.id }, null)
      : await request('syncRecordings', checkInventory ? { storedOnlyIfReported: true } : {}, null);
    if (inventoryOnly) return received;
    await refreshLibrary();
    if (signal?.aborted) return;
    const added = state.recordings.filter(file => !before.has(file.id)).length;
    state.lastSync = received === 0
      ? notice || 'Both recording queues on this ring reported empty.'
      : `Received ${received} recording${received === 1 ? '' : 's'} from the ring. ${added} new in your library.`;
    log(state.lastSync);
    return received;
  } catch (error) {
    // Files completed before a disconnect remain available even if the native job fails.
    await refreshLibrary().catch(() => {});
    if (!signal?.aborted) throw error;
  } finally {
    if (!signal?.aborted) {
      state.busy = null;
      state.syncRetryAddress = undefined;
      changed();
    }
  }
}
