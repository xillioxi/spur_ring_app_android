import type { RingAudioMessage } from '../src/types';
import { RealtimeTranscriber, textGap } from './transcription';

export interface RingOpusPacket {
  timestamp: number;
  frameSize: number;
  frameDurationMs: number;
  sampleRate: number;
  channels: number;
  data: string;
}

/** Stream one physical recording and track which speech ElevenLabs has finalized. */
export class RingLiveTake {
  private timestamp?: number;
  private ended = false;
  private decoded = false;
  private endNotice?: () => void;
  private decoderNotice?: () => void;
  private socket?: RealtimeTranscriber;
  private opening?: Promise<void>;
  private ready = false;
  private audioQueue: Uint8Array[] = [];
  private queuedBytes = 0;
  private words = '';
  private partial = '';
  private cancelled = false;
  private broken = false;
  constructor(readonly id: number, private options: {
    send(message: RingAudioMessage): void;
    key: string;
    language: string;
    partial(text: string): void;
    committed(text: string): void;
    failed(message: string): void;
  }) {}

  get phase(): 'waiting' | 'streaming' | 'unavailable' {
    return this.broken ? 'unavailable' : this.socket ? 'streaming' : 'waiting';
  }
  get recordingTimestamp(): number | undefined { return this.timestamp; }
  get confirmedText(): string { return this.words; }

  packet(packet: RingOpusPacket): void {
    if (this.cancelled || this.broken || this.ended) return;
    if (typeof packet.data !== 'string' || !packet.data.length || packet.data.length > 180000 ||
        !Number.isInteger(packet.timestamp) || !Number.isInteger(packet.frameSize) || packet.frameSize <= 0) {
      this.fail('Invalid live audio packet from the ring.');
      return;
    }
    if (this.timestamp === undefined) {
      this.timestamp = packet.timestamp;
      this.options.send({ kind: 'start', id: this.id });
    }
    if (this.timestamp !== packet.timestamp) return;
    const data = Buffer.from(packet.data, 'base64');
    if (!data.length || data.length % packet.frameSize) { this.fail('Incomplete live audio packet from the ring.'); return; }
    this.options.send({ kind: 'data', id: this.id, data, frameSize: packet.frameSize,
      frameDurationMs: packet.frameDurationMs, channels: packet.channels, sampleRate: packet.sampleRate });
  }

  end(timestamp: number): void {
    if (this.timestamp === undefined || timestamp !== this.timestamp || this.ended || this.cancelled || this.broken) return;
    this.ended = true;
    this.options.send({ kind: 'finish', id: this.id });
    this.endNotice?.();
  }

  pcm(bytes: Uint8Array): void {
    if (this.cancelled || this.broken || this.decoded || this.timestamp === undefined) return;
    try {
      if (!this.socket) {
        const socket = this.socket = new RealtimeTranscriber(this.options.key, this.options.language, {
          partial: text => { this.partial = text; this.options.partial(text); },
          committed: text => {
            this.words += textGap(this.words, text) + text; this.partial = '';
            this.options.committed(text);
          },
          error: reason => this.fail(reason),
        });
        this.opening = socket.start().then(() => {
          if (this.cancelled || this.broken) return;
          this.ready = true;
          for (const chunk of this.audioQueue) socket.send(chunk);
          this.audioQueue = []; this.queuedBytes = 0;
        }).catch(error => this.fail(error instanceof Error ? error.message : 'Could not start live ring transcription.'));
      }
      if (this.ready) this.socket.send(bytes);
      else {
        if (this.queuedBytes + bytes.byteLength > 256000) throw new Error('ElevenLabs could not keep up with the ring audio.');
        this.audioQueue.push(Uint8Array.from(bytes)); this.queuedBytes += bytes.byteLength;
      }
    } catch (error) { this.fail(error instanceof Error ? error.message : 'Live ring audio failed.'); }
  }

  decoderDone(error?: string): void {
    if (this.cancelled || this.broken) return;
    if (error) { this.fail(error); return; }
    this.decoded = true;
    this.decoderNotice?.();
  }

  async finish(): Promise<string> {
    if (this.timestamp === undefined || this.broken || this.cancelled) return '';
    // The recording-state edge can precede the last Bluetooth packets.
    if (!this.ended) await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 5000);
      this.endNotice = () => { clearTimeout(timer); resolve(); };
    });
    if (!this.ended || this.broken || this.cancelled) return '';
    if (!this.decoded) await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 2500);
      this.decoderNotice = () => { clearTimeout(timer); resolve(); };
    });
    if (!this.decoded || this.broken || this.cancelled) return '';
    await this.opening;
    if (!this.ready || this.broken || this.cancelled) return '';
    await this.socket?.stop();
    return this.broken || this.cancelled || this.partial.trim() ? '' : this.words;
  }

  fail(message: string, timestamp?: number): void {
    if (this.broken || this.cancelled || (timestamp !== undefined && this.timestamp !== undefined && timestamp !== this.timestamp)) return;
    this.broken = true;
    this.cancel();
    this.options.failed(message);
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.endNotice?.(); this.decoderNotice?.();
    if (this.timestamp !== undefined && !this.decoded) this.options.send({ kind: 'cancel', id: this.id });
    this.socket?.cancel();
    this.audioQueue = []; this.queuedBytes = 0;
  }
}
