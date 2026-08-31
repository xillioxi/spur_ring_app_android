import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, type Subscription } from 'react-native-ble-plx';

import { base64ToBytes, bytesToBase64 } from './base64';
import { SMART_RING_UUID_SETS } from './SmartRingProtocol';
import type { SmartRingConnection, SmartRingDevice, SmartRingScanOptions } from './types';

export class SmartRingBleTransport {
  private manager = new BleManager();
  private device: Device | null = null;
  private connection: SmartRingConnection | null = null;
  private notifySubscription: Subscription | null = null;

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      ]);

      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  async scan(options: SmartRingScanOptions = {}): Promise<SmartRingDevice[]> {
    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('蓝牙权限未授权，无法扫描设备');
    }

    const timeoutMs = options.timeoutMs ?? 10000;
    const namePrefixes = options.namePrefixes ?? ['BCL603', 'SmartRing', 'Recording', 'Ring'];
    const serviceUuids: string[] = SMART_RING_UUID_SETS.map((item) => item.serviceUuid);

    return new Promise((resolve, reject) => {
      const devices = new Map<string, SmartRingDevice>();
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        this.manager.stopDeviceScan();
        resolve([...devices.values()]);
      };

      const timeout = setTimeout(finish, timeoutMs);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }

        if (!device) return;

        const name = device.name ?? device.localName ?? '';
        const advertisedServices = (device.serviceUUIDs ?? []).map((uuid) => uuid.toLowerCase());
        const hasTargetService = advertisedServices.some((uuid) => serviceUuids.includes(uuid));
        const hasTargetName = namePrefixes.some((prefix) => name.toLowerCase().startsWith(prefix.toLowerCase()));

        if (!hasTargetService && !hasTargetName) return;

        const nextDevice: SmartRingDevice = {
          id: device.id,
          name: name || 'Smart Ring',
          rssi: device.rssi ?? undefined,
          serviceUUIDs: device.serviceUUIDs ?? undefined
        };

        devices.set(device.id, nextDevice);
        options.onDeviceFound?.(nextDevice);
      });
    });
  }

  async connect(deviceId: string): Promise<SmartRingConnection> {
    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('蓝牙权限未授权，无法连接设备');
    }

    const connected = await this.manager.connectToDevice(deviceId, { autoConnect: false });
    this.device = await connected.discoverAllServicesAndCharacteristics();

    const services = await this.device.services();
    const serviceIds = services.map((service) => service.uuid.toLowerCase());
    const uuidSet = SMART_RING_UUID_SETS.find((item) => serviceIds.includes(item.serviceUuid));

    if (!uuidSet) {
      throw new Error(`未发现 SmartRing 录音服务，当前服务：${serviceIds.join(', ')}`);
    }

    this.connection = {
      device: {
        id: this.device.id,
        name: this.device.name ?? this.device.localName ?? 'Smart Ring',
        rssi: this.device.rssi ?? undefined
      },
      serviceUuid: uuidSet.serviceUuid,
      writeCharacteristicUuid: uuidSet.writeCharacteristicUuid,
      notifyCharacteristicUuid: uuidSet.notifyCharacteristicUuid
    };

    return this.connection;
  }

  async writeWithoutResponse(bytes: Uint8Array): Promise<void> {
    if (!this.device || !this.connection) {
      throw new Error('设备未连接，无法写入命令');
    }

    await this.device.writeCharacteristicWithoutResponseForService(
      this.connection.serviceUuid,
      this.connection.writeCharacteristicUuid,
      bytesToBase64(bytes)
    );
  }

  monitorNotify(onData: (data: Uint8Array) => void, onError?: (error: Error) => void): void {
    if (!this.device || !this.connection) {
      throw new Error('设备未连接，无法订阅 Notify');
    }

    this.notifySubscription?.remove();
    this.notifySubscription = this.device.monitorCharacteristicForService(
      this.connection.serviceUuid,
      this.connection.notifyCharacteristicUuid,
      (error, characteristic) => {
        if (error) {
          onError?.(error);
          return;
        }

        if (!characteristic?.value) return;
        onData(base64ToBytes(characteristic.value));
      }
    );
  }

  stopNotify(): void {
    this.notifySubscription?.remove();
    this.notifySubscription = null;
  }

  async disconnect(): Promise<void> {
    this.stopNotify();

    if (this.device) {
      await this.manager.cancelDeviceConnection(this.device.id);
    }

    this.device = null;
    this.connection = null;
  }

  destroy(): void {
    this.stopNotify();
    this.manager.destroy();
  }
}
