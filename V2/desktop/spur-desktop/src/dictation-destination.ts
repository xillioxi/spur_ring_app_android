import type { AppState } from './types';

export function insertsAtCursor(state: Pick<AppState, 'destination' | 'settings'>): boolean {
  if (state.destination === 'project') return true;
  if (state.destination === 'claude' || state.destination === 'codex') return false;
  return state.settings.insertAtCursor;
}
