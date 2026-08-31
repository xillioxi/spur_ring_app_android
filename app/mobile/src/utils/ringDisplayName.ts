/** BLE display helpers: map vendor AIZO* names to Spur Ring for UI only. */

export function isAizoBleName(name?: string | null): boolean {
  return /aizo/i.test(name ?? '');
}

export function shortMacSuffix(macAddress?: string | null): string {
  const cleaned = (macAddress ?? '').replace(/[^0-9A-Fa-f]/g, '');
  const tail = (cleaned.slice(-4) || '----').toUpperCase();
  return `…${tail}`;
}

/** UI-only label. Does not change BLE/SDK bind identity. */
export function formatRingDisplayName(name?: string | null, macAddress?: string | null): string {
  if (isAizoBleName(name)) {
    return `Spur Ring · ${shortMacSuffix(macAddress)}`;
  }
  const base = (name ?? '').trim();
  return base || 'Ring';
}
