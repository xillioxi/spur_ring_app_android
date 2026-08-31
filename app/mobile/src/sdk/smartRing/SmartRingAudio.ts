import { SmartRingAdpcmDecoder } from './SmartRingAdpcm';
import { SMART_RING_AUDIO_FORMAT } from './SmartRingProtocol';
import { encodeWavFromPcm16 } from './SmartRingWav';
import type { SmartRingAudioMeta, SmartRingAudioNotify, SmartRingPcmPacket, SmartRingRecordingStats } from './types';

export class SmartRingAudioBuffer {
  private chunks: Uint8Array[] = [];
  private adpcmChunks: Uint8Array[] = [];
  private pcmChunks: Int16Array[] = [];
  private decoder = new SmartRingAdpcmDecoder();
  private meta: SmartRingAudioMeta | undefined;
  private stats: SmartRingRecordingStats = {
    packetCount: 0,
    pcmBytes: 0,
    adpcmBytes: 0,
    pcmSamples: 0,
    lostPackets: 0
  };

  start(meta?: SmartRingAudioMeta) {
    this.chunks = [];
    this.adpcmChunks = [];
    this.pcmChunks = [];
    this.decoder.reset();
    this.meta = meta;
    this.stats = {
      packetCount: 0,
      pcmBytes: 0,
      adpcmBytes: 0,
      pcmSamples: 0,
      lostPackets: 0,
      startedAt: Date.now()
    };
  }

  append(packet: SmartRingPcmPacket) {
    this.chunks.push(packet.payload);
    this.stats.packetCount += 1;
    this.stats.pcmBytes += packet.payloadLength;
  }

  appendAdpcm(packet: SmartRingAudioNotify) {
    if (packet.type !== 'adpcm_data') {
      return;
    }

    const expectedSeq = this.stats.lastSeq === undefined ? packet.seq : this.stats.lastSeq + 1;
    if (packet.seq !== expectedSeq) {
      const gap = packet.seq > expectedSeq ? packet.seq - expectedSeq : 1;
      this.stats.lostPackets = (this.stats.lostPackets ?? 0) + gap;
    }

    const pcm = this.decoder.decode(packet.payload);
    this.adpcmChunks.push(packet.payload);
    this.pcmChunks.push(pcm);

    this.stats.packetCount += 1;
    this.stats.adpcmBytes = (this.stats.adpcmBytes ?? 0) + packet.payloadLength;
    this.stats.pcmSamples = (this.stats.pcmSamples ?? 0) + pcm.length;
    this.stats.pcmBytes = (this.stats.pcmSamples ?? 0) * 2;
    this.stats.lastSeq = packet.seq;
  }

  stop() {
    this.stats.stoppedAt = Date.now();
  }

  setWavPath(wavPath: string) {
    this.stats.wavPath = wavPath;
  }

  getStats(): SmartRingRecordingStats {
    return { ...this.stats };
  }

  getPcmBytes(): Uint8Array {
    if (this.pcmChunks.length > 0) {
      const pcm = this.getPcmSamples();
      const bytes = new Uint8Array(pcm.length * 2);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < pcm.length; i += 1) {
        view.setInt16(i * 2, pcm[i], true);
      }
      return bytes;
    }

    const total = this.stats.pcmBytes;
    const merged = new Uint8Array(total);
    let offset = 0;

    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  getPcmSamples(): Int16Array {
    const total = this.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(total);
    let offset = 0;

    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  buildWav(): Uint8Array {
    const pcm = this.getPcmSamples();
    const sampleRate = this.meta?.sampleRate || SMART_RING_AUDIO_FORMAT.sampleRateHz;
    const channels = this.meta?.channels || SMART_RING_AUDIO_FORMAT.channels;
    const bitsPerSample = (this.meta?.bitsPerSample || SMART_RING_AUDIO_FORMAT.bitsPerSample) as 16;

    return encodeWavFromPcm16(pcm, {
      sampleRate,
      channels,
      bitsPerSample
    });
  }
}
