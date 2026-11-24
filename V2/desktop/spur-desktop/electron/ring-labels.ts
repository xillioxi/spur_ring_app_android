export function ringLabelEntry(id: unknown, label: unknown): [string, string] {
  if (typeof id !== 'string' || !/^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(id)) throw new Error('Select a ring to name.');
  if (typeof label !== 'string') throw new Error('Enter a name for this ring.');
  const name = label.trim();
  if (name.length > 64 || /[\p{Cc}\u2028\u2029]/u.test(name)) throw new Error('Use a single line of up to 64 characters for the ring name.');
  return [id.toUpperCase(), name];
}

export function readRingLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved ring names.');
  const labels: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    const [address, name] = ringLabelEntry(key, text);
    if (name) labels[address] = name;
  }
  return labels;
}
