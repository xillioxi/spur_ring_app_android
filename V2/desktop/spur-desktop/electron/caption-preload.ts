import { ipcRenderer } from 'electron';
import type { CaptionView } from './caption-overlay';
import { textGap } from '../src/transcript-text';

window.addEventListener('DOMContentLoaded', () => {
  const label = document.getElementById('label')!;
  const transcript = document.getElementById('transcript')!;
  const committed = document.getElementById('committed')!;
  const partial = document.getElementById('partial')!;
  ipcRenderer.on('spur:caption', (_event, view: CaptionView | null) => {
    const text = view?.committed ?? '';
    const interim = view?.partial ?? '';
    const gap = textGap(text, interim);
    label.textContent = view?.label ?? '';
    committed.textContent = text;
    partial.textContent = gap + interim;
    transcript.hidden = !text && !interim;
    transcript.scrollTop = transcript.scrollHeight;
  });
});
