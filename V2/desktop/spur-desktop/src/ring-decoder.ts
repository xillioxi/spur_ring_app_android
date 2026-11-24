import type { RingAudioMessage, SpurAPI } from './types';

type PacketBatch = Extract<RingAudioMessage, { kind: 'data' }>;
type DecoderBridge = Pick<SpurAPI, 'onRingAudio' | 'sendRingPCM' | 'finishRingDecoder'>;

/** Mix Opus output to mono, then area-average to 16 kHz across packet boundaries. */
class SpeechPCM {
  private buffer = new Int16Array(1600);
  private count = 0;
  private weight = 0;
  private sum = 0;
  private rate = 0;
  constructor(private emit: (pcm: Uint8Array) => void) {}

  append(frame: AudioData): void {
    if (frame.numberOfChannels < 1 || frame.numberOfChannels > 2 ||
        frame.numberOfFrames > 5760 || !frame.sampleRate || (this.rate && frame.sampleRate !== this.rate)) {
      throw new Error('Unexpected decoded audio format.');
    }
    this.rate = frame.sampleRate;
    const mono = new Float32Array(frame.numberOfFrames);
    frame.copyTo(mono, { planeIndex: 0, format: 'f32-planar' });
    if (frame.numberOfChannels === 2) {
      const right = new Float32Array(frame.numberOfFrames);
      frame.copyTo(right, { planeIndex: 1, format: 'f32-planar' });
      for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] + right[i]) / 2;
    }
    for (const sample of mono) {
      let available = 16000;
      while (available > 0) {
        const used = Math.min(available, this.rate - this.weight);
        this.sum += used * sample;
        this.weight += used;
        available -= used;
        if (this.weight === this.rate) {
          const value = Math.max(-1, Math.min(1, this.sum / this.weight));
          this.buffer[this.count++] = Math.round(value * (value < 0 ? 32768 : 32767));
          this.weight = this.sum = 0;
          if (this.count === this.buffer.length) this.flush();
        }
      }
    }
  }

  flush(): void {
    if (this.count) this.emit(new Uint8Array(this.buffer.buffer.slice(0, this.count * 2)));
    this.count = 0;
  }
}

class RingDecoder {
  private decoder?: AudioDecoder;
  private format?: Pick<PacketBatch, 'sampleRate' | 'channels' | 'frameDurationMs' | 'frameSize'>;
  private tail: Uint8Array = new Uint8Array(0);
  private timestamp = 0;
  private finishing = false;
  private closed = false;
  private pcm: SpeechPCM;
  constructor(readonly id: number, private bridge: DecoderBridge) {
    this.pcm = new SpeechPCM(chunk => bridge.sendRingPCM(id, chunk));
  }

  append(batch: PacketBatch): void {
    if (this.closed || this.finishing) return;
    const { sampleRate, channels, frameDurationMs, frameSize, data } = batch;
    if ((channels !== 1 && channels !== 2) || !Number.isInteger(sampleRate) || sampleRate <= 0 ||
        ![2.5, 5, 10, 20, 40, 60, 80, 100, 120].includes(frameDurationMs) ||
        !Number.isInteger(frameSize) || frameSize < 1 || frameSize > 65024 ||
        !(data instanceof Uint8Array) || data.length > 262144) {
      this.end('Invalid audio packet from the ring.');
      return;
    }
    const previous = this.format;
    if (previous && (sampleRate !== previous.sampleRate || channels !== previous.channels ||
        frameDurationMs !== previous.frameDurationMs || frameSize !== previous.frameSize)) {
      this.end('Ring audio format changed during recording.');
      return;
    }
    try {
      if (!this.decoder) {
        this.format = { sampleRate, channels, frameDurationMs, frameSize };
        this.decoder = new AudioDecoder({
          output: frame => {
            try { if (!this.closed) this.pcm.append(frame); }
            catch { this.end('Could not convert ring audio to speech samples.'); }
            finally { frame.close(); }
          },
          error: () => this.end('Could not decode the ring’s Opus audio.'),
        });
        // AIZO sends raw Opus packets; a container header would enable unwanted Ogg pre-skip.
        this.decoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: channels });
      }
      let bytes = data;
      if (this.tail.length) {
        bytes = new Uint8Array(this.tail.length + data.length);
        bytes.set(this.tail);
        bytes.set(data, this.tail.length);
      }
      let offset = 0;
      const duration = frameDurationMs * 1000;
      const queueLimit = Math.min(256, Math.ceil(5000 / frameDurationMs), Math.floor(2097152 / frameSize));
      while (offset + frameSize <= bytes.length) {
        if (this.decoder.decodeQueueSize >= queueLimit) {
          this.end('Ring audio arrived faster than it could be decoded.');
          return;
        }
        this.decoder.decode(new EncodedAudioChunk({
          type: 'key', timestamp: this.timestamp, duration, data: bytes.subarray(offset, offset + frameSize),
        }));
        this.timestamp += duration;
        offset += frameSize;
      }
      this.tail = bytes.slice(offset);
    } catch { this.end('Could not decode the ring’s Opus audio.'); }
  }

  async finish(): Promise<void> {
    if (this.closed || this.finishing) return;
    this.finishing = true;
    if (!this.decoder || !this.timestamp) { this.end('No complete audio packets arrived from the ring.'); return; }
    try {
      await this.decoder.flush();
      if (this.closed) return;
      this.pcm.flush();
      this.end(this.tail.length ? 'The ring audio ended in an incomplete packet.' : undefined);
    } catch { this.end('Could not finish decoding ring audio.'); }
  }

  cancel(): void {
    this.closed = true;
    if (this.decoder && this.decoder.state !== 'closed') this.decoder.close();
    this.tail = new Uint8Array(0);
  }

  private end(error?: string): void {
    if (this.closed) return;
    this.cancel();
    this.bridge.finishRingDecoder(this.id, error);
  }
}

export function installRingDecoder(bridge: DecoderBridge): () => void {
  let active: RingDecoder | undefined;
  const unsubscribe = bridge.onRingAudio(message => {
    if (message.kind === 'start') {
      active?.cancel();
      active = new RingDecoder(message.id, bridge);
    } else if (active?.id === message.id) {
      if (message.kind === 'data') active.append(message);
      else if (message.kind === 'finish') void active.finish();
      else { active.cancel(); active = undefined; }
    }
  });
  return () => { unsubscribe(); active?.cancel(); };
}
