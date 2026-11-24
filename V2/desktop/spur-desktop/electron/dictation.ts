import type { AppState, Recording, RingAudioMessage } from '../src/types';
import { insertsAtCursor } from '../src/dictation-destination';
import { RealtimeTranscriber, textGap } from './transcription';
import { RingLiveTake } from './ring-live-take';
export { textGap } from './transcription';

export function freshRingRecording(files: Recording[], baseline: Set<string>, start: number, end: number, ringTimestamp?: number): Recording | undefined {
  const candidates = files.filter(file => !baseline.has(file.path) && Number.isFinite(file.timestamp) &&
    (ringTimestamp === undefined ? file.timestamp >= start - 2 && file.timestamp <= end + 2 : file.timestamp === ringTimestamp));
  return candidates.length === 1 ? candidates[0] : undefined;
}

// A saved-file transcript can vary in casing or punctuation from the live one.
// Only append speech after an identifiable prefix; never edit text already typed.
export function ringTranscriptRemainder(confirmed: string, full: string): string | undefined {
  if (!confirmed) return full;
  if (full === confirmed) return '';
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  const words = (s: string) => Array.from(segmenter.segment(s)).filter(part => part.isWordLike);
  const live = words(confirmed);
  const saved = words(full);
  if (!live.length || live.some((word, i) => word.segment.normalize('NFKC').toLowerCase() !== saved[i]?.segment.normalize('NFKC').toLowerCase())) return undefined;
  const last = saved[live.length - 1];
  const suffix = full.slice(last.index + last.segment.length);
  return /[\p{P}]$/u.test(confirmed) ? suffix.replace(/^[\p{P}]+/u, '').trimStart() : suffix.trimStart();
}

interface CursorDestination {
  target?: Record<string, unknown>;
  ready?: Promise<void>;
  retryCapture: boolean;
  pending: string;
  lastInserted: string;
}

interface Ports {
  state: AppState;
  changed(): void;
  log(message: string, error?: boolean): void;
  request<T = any>(method: string, params?: Record<string, unknown>, timeout?: number): Promise<T>;
  key(): string;
  excludedPids(): number[];
  sync(): Promise<void>;
  transcribe(file: Recording, signal?: AbortSignal): Promise<string>;
  decodeRingAudio?(message: RingAudioMessage): void;
  saveLiveTranscript?(file: Recording, text: string): Promise<void>;
  prepareSession?(): Promise<void>;
}

/** A manual session can span several takes; a standby press owns one take. */
export class Dictation {
  private enabled = false;
  private singleTake = false;
  private generation = 0;
  private voiceStart = 0;
  private socket?: RealtimeTranscriber;
  private cursor?: CursorDestination;
  private startPromise?: Promise<void>;
  private armPromise?: Promise<unknown>;
  private finishPromise?: Promise<void>;
  private stopPromise?: Promise<void>;
  private cancelCountdown?: () => void;
  private insertion = Promise.resolve();
  private queuedAudio: Uint8Array[] = [];
  private queuedBytes = 0;
  private socketReady = false;
  private baseline = new Set<string>();
  private recordingStart?: number;
  private transcriptBeforeTake = '';
  private recordingFiles: Recording[] = [];
  private fileAbort?: AbortController;
  private cycleBusy = false;
  private takeSequence = 0;
  private take?: RingLiveTake;
  get liveRingTake(): RingLiveTake | undefined { return this.take; }
  private suppressedUntil = 0;
  constructor(private ports: Ports) {}
  get active(): boolean { return this.enabled || Boolean(this.stopPromise); }
  private patch(values: Partial<AppState['dictation']>): void {
    const { state } = this.ports;
    if (values.status === 'listening') {
      state.dictation.utteranceStart = state.transcript.committed.length;
      state.transcript.partial = '';
    }
    Object.assign(state.dictation, values);
    this.ports.changed();
  }

  private beginSession(singleTake: boolean): number {
    const { state } = this.ports;
    const hostDuringSync = singleTake && state.settings.source === 'ring' &&
      (!state.busy || state.busy === 'syncing recordings') && !state.disconnecting;
    if (state.busy && !hostDuringSync) throw new Error(`Wait until ${state.busy} finishes before starting dictation.`);
    if (!state.service.ready) throw new Error('The native ring service is not ready.');
    if (!this.ports.key()) throw new Error('Add your ElevenLabs API key in Settings first.');
    if (state.settings.source !== 'microphone' && (state.disconnecting || (state.connection !== 'connected' &&
        !(hostDuringSync && state.connection === 'syncing')))) throw new Error('Connect your ring before arming ring dictation.');
    this.enabled = true;
    this.singleTake = singleTake;
    const generation = ++this.generation;
    this.baseline = new Set(state.recordings.map(file => file.path));
    const destination = state.destination;
    const assistant = destination === 'codex' || destination === 'claude';
    if (assistant) {
      this.voiceStart = state.transcript.committed.length;
      (state.voiceDrafts ??= {})[destination] = { session: generation, text: '' };
    }
    this.patch({ source: state.settings.source, insertAtCursor: insertsAtCursor(state), error: undefined, cursorNotice: undefined, level: 0, utteranceStart: undefined });
    return generation;
  }

  /** The native listener is already armed. Install the take before its next BLE event. */
  async startFromRingPress(): Promise<void> {
    if (this.active || this.startPromise || this.finishPromise || this.cycleBusy ||
        this.ports.state.settings.source === 'microphone' || Date.now() < this.suppressedUntil) return;
    this.beginSession(true);
    await this.trigger('start');
  }

  async start(delay = 3000): Promise<void> {
    if (this.stopPromise) await this.stopPromise;
    if (this.enabled) return;
    if (this.finishPromise) await this.finishPromise;
    if (this.startPromise) await this.startPromise.catch(() => {});
    if (this.enabled) return;
    const { state } = this.ports;
    this.suppressedUntil = 0;
    const generation = this.beginSession(false);
    try {
      this.patch({ status: 'starting', targetLabel: 'Preparing dictation…' });
      if (this.ports.prepareSession) await this.ports.prepareSession();
      if (!this.enabled || generation !== this.generation) return;
      if (state.settings.source !== 'microphone') {
        this.patch({ status: 'starting', targetLabel: 'Enabling ring controls…' });
        this.armPromise = this.ports.request('armDictation', this.ports.decodeRingAudio && state.settings.source === 'ring-recording' ? { liveRingAudio: true } : {});
        try { await this.armPromise; } finally { this.armPromise = undefined; }
        if (!this.enabled || generation !== this.generation) return;
        // A press can be delivered ahead of the native arm reply.
        if (state.dictation.status === 'starting' && !this.startPromise && !this.take) {
          this.patch({ status: 'armed', targetLabel: state.settings.source === 'ring' ? 'Press your ring to dictate with the computer microphone' : 'Ready for a ring recording' });
        }
        this.ports.log(state.settings.source === 'ring' ? 'Ring controls armed for the computer microphone.' : 'Ring microphone armed for transcription.');
      } else await this.beginMicrophone(delay);
    } catch (error) { if (generation === this.generation) { await this.fail(error); throw error; } }
  }

  private async captureTarget(allowRingRetry = false): Promise<void> {
    this.cursor = undefined;
    if (!this.ports.state.dictation.insertAtCursor) {
      const destination = this.ports.state.destination;
      this.patch({ targetLabel: destination === 'claude' ? 'Claude instruction draft' : destination === 'codex' ? 'Codex instruction draft' : 'Transcript preview only', cursorNotice: undefined });
      return;
    }
    const cursor: CursorDestination = { retryCapture: false, pending: '', lastInserted: '' };
    this.cursor = cursor;
    cursor.ready = this.resolveCursor(cursor, allowRingRetry);
    await cursor.ready;
  }

  private async resolveCursor(cursor: CursorDestination, allowRingRetry: boolean): Promise<void> {
    cursor.retryCapture = false;
    try {
      const target = await this.ports.request('captureTarget', { excludedProcessIds: this.ports.excludedPids() });
      if (this.cursor !== cursor || !this.enabled) return;
      cursor.target = target;
      this.patch({ targetLabel: String(target.label || 'Selected text field'), cursorNotice: undefined });
      if (!allowRingRetry && cursor.pending) this.queueInsertion('');
    } catch (error) {
      if (this.cursor !== cursor || !this.enabled) return;
      const message = error instanceof Error ? error.message : 'Could not select a text field.';
      cursor.retryCapture = allowRingRetry && /text field in another application/i.test(message);
      if (!cursor.retryCapture) this.cursor = undefined;
      if (allowRingRetry) {
        this.patch({ cursorNotice: cursor.retryCapture ? 'Click the text field where you want these words to go.' : message });
      } else {
        this.patch({ targetLabel: 'Live transcript in Spur', cursorNotice: message + ' Live captions continue in Spur.' });
      }
    }
  }

  private retryRingCursor(): void {
    const cursor = this.cursor;
    if (cursor?.retryCapture) cursor.ready = this.resolveCursor(cursor, true);
  }

  private async beginMicrophone(delay = 0): Promise<void> {
    if (!this.enabled || this.startPromise || this.socket) return;
    const generation = this.generation;
    this.startPromise = (async () => {
      this.patch({ status: 'starting', targetLabel: delay ? 'Click your destination text field within 3 seconds…' : 'Starting computer microphone…' });
      if (delay) await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, delay);
        this.cancelCountdown = () => { clearTimeout(timer); resolve(); };
      });
      this.cancelCountdown = undefined;
      if (!this.enabled || generation !== this.generation) return;
      // Cursor lookup can be slow or fail while Spur has focus. Start audio independently.
      void this.captureTarget();
      const socket = this.socket = new RealtimeTranscriber(this.ports.key(), this.ports.state.settings.language, {
        partial: text => { if (generation === this.generation) { this.ports.state.transcript.partial = text; this.ports.changed(); } },
        committed: text => { if (generation === this.generation) this.commit(text); },
        error: message => { if (generation === this.generation) void this.fail(new Error(message)); },
      });
      this.socketReady = false; this.queuedAudio = []; this.queuedBytes = 0;
      // Capture during the socket handshake, retaining a bounded pre-roll so first words are not lost.
      this.patch({ status: 'listening' });
      await socket.start();
      if (!this.enabled || generation !== this.generation) { socket.cancel(); return; }
      this.socketReady = true;
      for (const chunk of this.queuedAudio) socket.send(chunk);
      this.queuedAudio = []; this.queuedBytes = 0;
      this.ports.log('Live transcription connected to ElevenLabs.');
    })();
    try { await this.startPromise; } finally { this.startPromise = undefined; }
  }

  audio(pcm: Uint8Array): void {
    if (!this.enabled || this.ports.state.dictation.status !== 'listening' || !this.socket) return;
    try {
      if (this.socketReady) this.socket.send(pcm);
      else {
        if (this.queuedBytes + pcm.length > 160000) throw new Error('The live service took too long to connect. Audio capture was stopped.');
        this.queuedAudio.push(Uint8Array.from(pcm)); this.queuedBytes += pcm.length;
      }
      let energy = 0;
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let i = 0; i < pcm.byteLength; i += 2) energy += (view.getInt16(i, true) / 32768) ** 2;
      this.patch({ level: Math.min(1, Math.sqrt(energy / (pcm.length / 2)) * 5) });
    } catch (error) { void this.fail(error); }
  }

  private updateVoiceDraft(): void {
    const { destination, transcript, voiceDrafts } = this.ports.state;
    if (destination !== 'claude' && destination !== 'codex') return;
    const draft = voiceDrafts?.[destination];
    if (draft) draft.text = transcript.committed.slice(this.voiceStart).trim();
  }

  private commit(text: string): void {
    const { transcript } = this.ports.state;
    transcript.committed += textGap(transcript.committed, text) + text;
    this.updateVoiceDraft();
    transcript.partial = ''; this.ports.changed();
    this.queueInsertion(text);
  }

  private queueInsertion(text: string): void {
    const cursor = this.cursor;
    if (!cursor) return;
    if (!cursor.target && this.ports.state.dictation.source !== 'ring-recording') {
      // Wait for this take's initial target without making stop wait for the OS lookup.
      cursor.pending += textGap(cursor.pending, text) + text;
      return;
    }
    this.insertion = this.insertion.then(async () => {
      if (cursor !== this.cursor || !this.enabled) return;
      cursor.pending += textGap(cursor.pending, text) + text;
      await cursor.ready;
      if (cursor !== this.cursor || !this.enabled || !cursor.pending) return;
      if (cursor.retryCapture && this.recordingStart !== undefined) {
        this.retryRingCursor();
        await cursor.ready;
      }
      if (cursor !== this.cursor || !this.enabled || !cursor.target) return;
      const value = textGap(cursor.lastInserted, cursor.pending) + cursor.pending;
      cursor.pending = ''; // A failed native write may have inserted some characters.
      try {
        const result = await this.ports.request('insertText', { target: cursor.target, text: value });
        if (cursor !== this.cursor || !this.enabled) return;
        if (!result.inserted) {
          throw new Error(result.reason || 'Windows could not type in the selected field.');
        }
        cursor.lastInserted += value;
      } catch (error) {
        if (cursor !== this.cursor || !this.enabled) return;
        this.cursor = undefined;
        const reason = error instanceof Error ? error.message : 'Windows could not type in the selected field.';
        this.patch({ targetLabel: 'Insertion paused', cursorNotice: reason });
        this.ports.log(reason, true);
      }
    });
  }

  async trigger(action: 'start' | 'stop'): Promise<void> {
    if (!this.enabled || this.ports.state.dictation.source === 'microphone') return;
    if (action === 'start' && Date.now() < this.suppressedUntil) return;
    const generation = this.generation;
    try {
      if (this.ports.state.dictation.source === 'ring') {
        if (action === 'start' && !this.finishPromise) await this.beginMicrophone();
        else if (action === 'stop') await this.finishSegment();
      } else if (action === 'start' && !this.recordingStart && !this.cycleBusy) {
        this.recordingStart = Date.now() / 1000;
        this.transcriptBeforeTake = this.ports.state.transcript.committed;
        this.recordingFiles = [];
        this.ports.state.transcript.partial = '';
        if (this.ports.decodeRingAudio) {
          const take = new RingLiveTake(++this.takeSequence, {
            send: this.ports.decodeRingAudio, key: this.ports.key(), language: this.ports.state.settings.language,
            partial: text => {
              if (this.take !== take) return;
              this.ports.state.transcript.partial = text;
              this.ports.changed();
            },
            committed: text => { if (this.take === take) this.commit(text); },
            failed: message => {
              if (this.take !== take) return;
              this.ports.state.transcript.partial = '';
              this.ports.log(`Live captions interrupted. Spur will use the saved ring recording. ${message}`, true);
            },
          });
          this.take = take;
        }
        this.patch({ status: 'listening', targetLabel: 'Recording on the ring', cursorNotice: undefined });
        await this.captureTarget(true);
      } else if (action === 'stop' && this.recordingStart && !this.cycleBusy) {
        const start = this.recordingStart;
        // Sample focus at release if the user started in Spur and then selected their editor.
        this.retryRingCursor();
        this.recordingStart = undefined;
        this.queueInsertion('');
        await this.transcribeRingCycle(start, Date.now() / 1000);
        if (this.enabled && generation === this.generation) this.finishTake();
      }
    } catch (error) { if (generation === this.generation) await this.fail(error); }
  }

  file(file: Recording): void {
    if ((this.cycleBusy || this.recordingStart !== undefined) && !this.recordingFiles.some(existing => existing.path === file.path)) this.recordingFiles.push(file);
  }
  private clearRingTake(): void {
    this.take?.cancel();
    this.take = undefined;
    this.ports.state.transcript.partial = '';
  }
  ringTouch(action: string): void {
    if (action !== 'double_click' || this.ports.state.settings.source === 'microphone') return;
    this.suppressedUntil = Date.now() + 900;
    if (!this.enabled) return;
    this.recordingStart = undefined;
    if (this.ports.state.dictation.source === 'ring-recording') {
      if (this.cycleBusy) return;
      this.clearRingTake();
      this.cursor = undefined;
    }
    if (this.ports.state.dictation.source === 'ring') {
      // Android cancels a double-click segment instead of inserting accidental speech.
      this.generation++; this.socket?.cancel(); this.socket = undefined;
      this.socketReady = false; this.queuedAudio = []; this.queuedBytes = 0;
      this.cursor = undefined; this.ports.state.transcript.partial = '';
    }
    this.finishTake();
  }

  private async transcribeRingCycle(start: number, end: number): Promise<void> {
    this.cycleBusy = true;
    const generation = this.generation;
    const take = this.take;
    this.patch({ status: 'stopping', level: 0 });
    try {
      const liveText = await take?.finish();
      if (!this.enabled || generation !== this.generation) return;
      this.clearRingTake();
      const confirmed = take?.confirmedText || '';
      const findFile = () => freshRingRecording(this.recordingFiles, this.baseline, start, end, take?.recordingTimestamp);
      if (!findFile()) {
        // Let the ring finish writing before requesting the saved file.
        await new Promise(resolve => setTimeout(resolve, 450));
        if (!this.enabled || generation !== this.generation) return;
        if (!findFile()) {
          try { await this.ports.sync(); }
          catch (error) {
            if (!liveText) throw error;
            this.ports.log('Live transcript retained. The recording file could not be synced.', true);
          }
        }
      }
      if (!this.enabled || generation !== this.generation) return;
      const file = findFile();
      for (const seen of this.recordingFiles) this.baseline.add(seen.path);
      if (liveText) {
        if (file) await this.ports.saveLiveTranscript?.(file, liveText).catch(() => this.ports.log('The live transcript is in Dictation. Saving it beside the recording failed.', true));
        await this.insertion;
        return;
      }
      if (!file) {
        this.ports.log('Could not identify exactly one fresh ring recording. Select the recording in the library to transcribe it manually.', true);
        return;
      }
      this.fileAbort = new AbortController();
      const text = await this.ports.transcribe(file, this.fileAbort.signal);
      if (this.enabled && generation === this.generation && text) {
        const suffix = ringTranscriptRemainder(confirmed, text);
        if (suffix === undefined) {
          const previous = this.transcriptBeforeTake;
          this.ports.state.transcript.committed = previous + textGap(previous, text) + text;
          this.updateVoiceDraft();
          this.patch({ cursorNotice: 'The saved transcript differs from the live wording. The full text is in Dictation.' });
        } else if (suffix) this.commit(suffix);
        await this.insertion;
      }
    } finally {
      this.fileAbort = undefined; this.cycleBusy = false;
      if (take && this.take === take) this.clearRingTake();
    }
  }

  private finishTake(): void {
    if (this.singleTake) {
      this.singleTake = false;
      this.enabled = false;
      this.generation++;
      this.cursor = undefined;
      this.patch({ status: 'idle', level: 0, targetLabel: '' });
    } else {
      this.patch({ status: this.ports.state.dictation.source === 'microphone' ? 'idle' : 'armed', level: 0 });
    }
  }

  private async finishSegment(): Promise<void> {
    if (this.finishPromise) return this.finishPromise;
    if (!this.socket && !this.startPromise) return;
    const generation = this.generation;
    this.finishPromise = (async () => {
      if (!this.cursor?.target) this.cursor = undefined;
      this.patch({ status: 'stopping', level: 0 });
      try { await this.startPromise; } catch {}
      if (generation !== this.generation) return;
      const socket = this.socket;
      if (socket) await socket.stop();
      const { transcript } = this.ports.state;
      if (socket && this.socket === socket && this.enabled && transcript.partial.trim()) {
        // Keep an unconfirmed final preview locally if the service never finalizes it.
        const preview = transcript.partial.trim();
        transcript.committed += textGap(transcript.committed, preview) + preview;
        transcript.partial = '';
        this.updateVoiceDraft();
        this.patch({ cursorNotice: 'The last words were saved in Spur as heard. Review them in Dictation.' });
      }
      await this.insertion;
      if (generation !== this.generation) return;
      this.cursor = undefined;
      this.socket = undefined; this.socketReady = false; this.queuedAudio = []; this.queuedBytes = 0;
      if (this.enabled) this.finishTake();
    })();
    try { await this.finishPromise; } finally { this.finishPromise = undefined; }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.stopCurrent();
    try { await this.stopPromise; } finally { this.stopPromise = undefined; }
  }
  private async stopCurrent(): Promise<void> {
    if (!this.enabled) return;
    if (this.ports.state.dictation.source === 'ring-recording') {
      this.cursor = undefined;
      this.clearRingTake();
      this.recordingStart = undefined;
    }
    if (!this.socketReady && (this.startPromise || this.armPromise)) {
      // A cancelled countdown/arm must never acquire a target or open a microphone.
      this.enabled = false; this.generation++;
      this.cancelCountdown?.();
      this.socket?.cancel(); this.socket = undefined;
      this.queuedAudio = []; this.queuedBytes = 0;
      this.patch({ status: 'stopping', level: 0 });
      await Promise.allSettled([this.startPromise, this.armPromise].filter(Boolean));
      if (this.ports.state.dictation.source !== 'microphone') await this.ports.request('disarmDictation').catch(error => this.ports.log(String(error), true));
      this.patch({ status: 'idle', level: 0, targetLabel: '' });
      return;
    }
    this.fileAbort?.abort();
    await this.finishSegment();
    this.enabled = false; this.generation++;
    this.recordingStart = undefined; this.cursor = undefined;
    if (this.ports.state.dictation.source !== 'microphone') await this.ports.request('disarmDictation').catch(error => this.ports.log(String(error), true));
    this.patch({ status: 'idle', level: 0, targetLabel: '' });
  }
  async fail(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Dictation failed.';
    this.fileAbort?.abort(); this.socket?.cancel(); this.socket = undefined;
    this.cursor = undefined; this.recordingStart = undefined;
    this.clearRingTake();
    this.enabled = false; this.generation++;
    this.queuedAudio = []; this.queuedBytes = 0;
    this.ports.state.transcript.partial = '';
    if (this.ports.state.dictation.source !== 'microphone') void this.ports.request('disarmDictation').catch(() => {});
    this.patch({ status: 'error', error: message, level: 0 });
    this.ports.log(message, true);
  }
}
