import type { RingDevice, RingRecordingFile, RingSyncProgress, RingTransport } from './types';

const mockDevice: RingDevice = {
  id: 'ring-dev-kit-001',
  name: 'Recording Ring DevKit',
  rssi: -48,
  battery: 82,
  firmwareVersion: '0.1.0',
  connectionState: 'connected'
};

const mockFiles: RingRecordingFile[] = [
  {
    id: 'ring-file-06241130',
    name: 'RING_0624_1130.pcm',
    startedAt: '2026-06-24T11:30:00+08:00',
    durationSeconds: 22,
    sizeBytes: 352000,
    format: 'pcm_s16le_8k_mono',
    syncedBytes: 352000
  },
  {
    id: 'ring-file-06231130',
    name: 'RING_0623_1130.pcm',
    startedAt: '2026-06-23T11:30:00+08:00',
    durationSeconds: 22,
    sizeBytes: 352000,
    format: 'pcm_s16le_8k_mono',
    syncedBytes: 0
  }
];

export class MockRingTransport implements RingTransport {
  async scan(): Promise<RingDevice[]> {
    await delay(500);
    return [{ ...mockDevice, connectionState: 'idle' }];
  }

  async connect(deviceId: string): Promise<RingDevice> {
    await delay(450);
    return { ...mockDevice, id: deviceId, connectionState: 'connected' };
  }

  async disconnect(): Promise<void> {
    await delay(150);
  }

  async getBattery(): Promise<number> {
    await delay(150);
    return mockDevice.battery ?? 0;
  }

  async listFiles(): Promise<RingRecordingFile[]> {
    await delay(350);
    return mockFiles;
  }

  async syncFile(fileId: string, onProgress?: (progress: RingSyncProgress) => void): Promise<string> {
    const file = mockFiles.find((item) => item.id === fileId) ?? mockFiles[0];
    const chunks = 5;

    for (let index = 1; index <= chunks; index += 1) {
      await delay(180);
      const transferredBytes = Math.round((file.sizeBytes / chunks) * index);
      onProgress?.({
        fileId,
        transferredBytes,
        totalBytes: file.sizeBytes,
        percent: Math.min(100, Math.round((transferredBytes / file.sizeBytes) * 100))
      });
    }

    return `file:///recording-ring/${file.name}`;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
