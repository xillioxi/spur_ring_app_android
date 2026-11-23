import type { RingDevice } from '../src/types';

export async function discoverRings(scan: () => Promise<RingDevice[]>, onRetry: () => void): Promise<RingDevice[]> {
  const devices = await scan();
  if (devices.length) return devices;
  onRetry();
  return scan();
}
