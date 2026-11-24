import type { AppState } from '../src/types';
import type { CaptionView } from './caption-overlay';

/** Present only the current utterance, even though the Dictation page retains earlier ones. */
export class CaptionSession {
  private baseline?: number;
  private hideTimer?: NodeJS.Timeout;
  constructor(private show: (view: CaptionView | null) => void) {}

  update(state: AppState, ringPhase?: 'waiting' | 'streaming' | 'unavailable'): void {
    const { status, source } = state.dictation;
    const ringAudio = source === 'ring-recording';
    if (status === 'listening' && this.baseline === undefined) {
      clearTimeout(this.hideTimer);
      this.baseline = state.transcript.committed.length;
    }
    if (this.baseline === undefined) return;
    const committed = state.transcript.committed.slice(this.baseline).trimStart();
    const partial = state.transcript.partial;
    if (status === 'listening' || status === 'stopping') {
      let label = ringAudio ? 'Ring microphone' : 'Computer microphone';
      if (status === 'stopping') label = 'Finishing transcript';
      else if (ringAudio && ringPhase === 'waiting') label = 'Recording · Waiting for ring audio';
      else if (ringAudio && ringPhase === 'unavailable') label = 'Recording · Transcript after sync';
      if (state.dictation.cursorNotice) label += ' · ' + state.dictation.cursorNotice;
      this.show({ label, committed, partial });
      return;
    }
    this.baseline = undefined;
    if (status === 'error' || committed) {
      this.show({ label: status === 'error' ? 'Transcription interrupted' : 'Transcript', committed, partial: status === 'error' ? state.dictation.error || '' : '' });
      this.hideTimer = setTimeout(() => this.show(null), 4500);
    } else this.show(null);
  }

  dispose(): void { clearTimeout(this.hideTimer); }
}
