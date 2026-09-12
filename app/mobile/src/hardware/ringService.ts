import { MockRingTransport } from './mockRingTransport';
import type { RingSyncProgress, RingTransport } from './types';

class RingService {
  private transport: RingTransport = new MockRingTransport();

  setTransport(transport: RingTransport) {
    this.transport = transport;
  }

  scan() {
    return this.transport.scan();
  }

  connect(deviceId: string) {
    return this.transport.connect(deviceId);
  }

  disconnect() {
    return this.transport.disconnect();
  }

  getBattery() {
    return this.transport.getBattery();
  }

  listFiles() {
    return this.transport.listFiles();
  }

  syncFile(fileId: string, onProgress?: (progress: RingSyncProgress) => void) {
    return this.transport.syncFile(fileId, onProgress);
  }
}

export const ringService = new RingService();
