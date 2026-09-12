import { BleManager, Device } from 'react-native-ble-plx';

import type { RingDevice, RingRecordingFile, RingSyncProgress, RingTransport } from './types';

/**
 * 真实 BLE 接入预留实现。
 *
 * 这里先只保留骨架，不硬编码 UUID。拿到戒指硬件协议后，需要补：
 * - service UUID
 * - command / notify / file transfer characteristics
 * - command framing
 * - chunk ACK / CRC / retry / resume
 */
export class BleRingTransport implements RingTransport {
  private manager = new BleManager();
  private device: Device | null = null;

  async scan(): Promise<RingDevice[]> {
    return new Promise((resolve, reject) => {
      const devices = new Map<string, RingDevice>();
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve([...devices.values()]);
      }, 5000);

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }

        if (!device?.name) return;
        const maybeRing = /ring|record/i.test(device.name);
        if (!maybeRing) return;

        devices.set(device.id, {
          id: device.id,
          name: device.name,
          rssi: device.rssi ?? undefined,
          connectionState: 'idle'
        });
      });
    });
  }

  async connect(deviceId: string): Promise<RingDevice> {
    const device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
    this.device = await device.discoverAllServicesAndCharacteristics();

    return {
      id: this.device.id,
      name: this.device.name ?? 'Recording Ring',
      rssi: this.device.rssi ?? undefined,
      connectionState: 'connected'
    };
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;
    await this.manager.cancelDeviceConnection(this.device.id);
    this.device = null;
  }

  async getBattery(): Promise<number> {
    throw new Error('待硬件协议确认后实现 getBattery');
  }

  async listFiles(): Promise<RingRecordingFile[]> {
    throw new Error('待硬件协议确认后实现 listFiles');
  }

  async syncFile(_fileId: string, _onProgress?: (progress: RingSyncProgress) => void): Promise<string> {
    throw new Error('待硬件协议确认后实现 syncFile');
  }
}
