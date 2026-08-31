import { bytesToHex } from './base64';
import { SmartRingAudioBuffer } from './SmartRingAudio';
import { SmartRingBleTransport } from './SmartRingBleTransport';
import { saveSmartRingWav } from './SmartRingFileStore';
import { SmartRingProtocol } from './SmartRingProtocol';
import type {
  SmartRingAudioNotify,
  SmartRingAudioNotifyListener,
  SmartRingConnection,
  SmartRingDevice,
  SmartRingLogListener,
  SmartRingPcmListener,
  SmartRingRecordingStats,
  SmartRingScanOptions
} from './types';

export class SmartRingBleSdk {
  private transport: SmartRingBleTransport;
  private audioBuffer = new SmartRingAudioBuffer();
  private pcmListeners = new Set<SmartRingPcmListener>();
  private audioNotifyListeners = new Set<SmartRingAudioNotifyListener>();
  private logListeners = new Set<SmartRingLogListener>();
  private connection: SmartRingConnection | null = null;
  private recording = false;

  constructor(transport = new SmartRingBleTransport()) {
    this.transport = transport;
  }

  onPcmData(listener: SmartRingPcmListener): () => void {
    this.pcmListeners.add(listener);
    return () => this.pcmListeners.delete(listener);
  }

  onAudioNotify(listener: SmartRingAudioNotifyListener): () => void {
    this.audioNotifyListeners.add(listener);
    return () => this.audioNotifyListeners.delete(listener);
  }

  onLog(listener: SmartRingLogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  async scan(options: SmartRingScanOptions = {}): Promise<SmartRingDevice[]> {
    this.log('开始扫描 SmartRing 设备');
    const devices = await this.transport.scan(options);
    this.log(`扫描完成，发现 ${devices.length} 个候选设备`);
    return devices;
  }

  async connect(deviceId: string): Promise<SmartRingConnection> {
    this.log(`开始连接设备：${deviceId}`);
    this.connection = await this.transport.connect(deviceId);
    this.log(`连接成功：${this.connection.device.name}`);

    this.transport.monitorNotify(
      (data) => this.handleNotify(data),
      (error) => this.log(`Notify 错误：${error.message}`)
    );
    this.log('Notify 订阅已启动');

    return this.connection;
  }

  async startRecording(): Promise<void> {
    if (!this.connection) {
      throw new Error('设备未连接，无法开始录音');
    }

    this.audioBuffer.start();
    this.recording = true;

    const command = SmartRingProtocol.buildStartRecordingCommand();
    this.log(`发送开始录音命令：${bytesToHex(command)}`);
    await this.transport.writeWithoutResponse(command);
  }

  async stopRecording(): Promise<SmartRingRecordingStats> {
    if (!this.connection) {
      throw new Error('设备未连接，无法停止录音');
    }

    const command = SmartRingProtocol.buildStopRecordingCommand();
    this.log(`发送停止录音命令：${bytesToHex(command)}`);
    await this.transport.writeWithoutResponse(command);

    // 真正的保存动作优先等板端 RECORD_END Notify 触发。
    // 这里只发送停止命令，避免提前截断最后几包 Notify。

    const stats = this.audioBuffer.getStats();
    this.log(`停止命令已发送，等待 RECORD_END：${stats.packetCount} 包，${stats.adpcmBytes ?? 0} bytes ADPCM`);
    return stats;
  }

  getRecordingStats(): SmartRingRecordingStats {
    return this.audioBuffer.getStats();
  }

  getPcmBytes(): Uint8Array {
    return this.audioBuffer.getPcmBytes();
  }

  getPcmSamples(): Int16Array {
    return this.audioBuffer.getPcmSamples();
  }

  async disconnect(): Promise<void> {
    this.recording = false;
    await this.transport.disconnect();
    this.connection = null;
    this.log('设备已断开');
  }

  destroy(): void {
    this.transport.destroy();
    this.pcmListeners.clear();
    this.audioNotifyListeners.clear();
    this.logListeners.clear();
  }

  private async handleNotify(data: Uint8Array) {
    const audioPacket = SmartRingProtocol.parseAudioNotify(data);
    if (!audioPacket) {
      return;
    }

    this.audioNotifyListeners.forEach((listener) => listener(audioPacket));

    if (audioPacket.type === 'record_begin') {
      this.recording = true;
      this.audioBuffer.start(audioPacket.meta);
      this.log(
        `收到 RECORD_BEGIN：${audioPacket.meta?.sampleRate ?? '--'}Hz ${audioPacket.meta?.channels ?? '--'}ch ${audioPacket.meta?.durationMs ?? '--'}ms`
      );
      return;
    }

    if (audioPacket.type === 'adpcm_data') {
      if (!this.recording) {
        this.recording = true;
      }

      this.audioBuffer.appendAdpcm(audioPacket);
      const stats = this.audioBuffer.getStats();

      if (stats.packetCount <= 5 || stats.packetCount % 20 === 0) {
        this.log(
          `收到 ADPCM：seq=${audioPacket.seq} packets=${stats.packetCount} adpcm=${stats.adpcmBytes ?? 0}B pcmSamples=${stats.pcmSamples ?? 0} lost=${
            stats.lostPackets ?? 0
          }`
        );
      }
      return;
    }

    if (audioPacket.type === 'record_end') {
      this.recording = false;
      this.audioBuffer.stop();

      try {
        const wavBytes = this.audioBuffer.buildWav();
        const wavPath = await saveSmartRingWav(wavBytes);
        this.audioBuffer.setWavPath(wavPath);
        this.log(`收到 RECORD_END：WAV 已保存 ${wavPath}`);
      } catch (error) {
        this.log(error instanceof Error ? `保存 WAV 失败：${error.message}` : '保存 WAV 失败');
      }
    }
  }

  private log(message: string) {
    this.logListeners.forEach((listener) => listener(message));
  }
}
