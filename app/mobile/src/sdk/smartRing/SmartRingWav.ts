export interface SmartRingWavOptions {
  sampleRate: number;
  channels: number;
  bitsPerSample: 16;
}

export function encodeWavFromPcm16(pcm: Int16Array, options: SmartRingWavOptions): Uint8Array {
  const bytesPerSample = options.bitsPerSample / 8;
  const dataSize = pcm.length * bytesPerSample;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  writeAscii(wav, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(wav, 8, 'WAVE');
  writeAscii(wav, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, options.channels, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * options.channels * bytesPerSample, true);
  view.setUint16(32, options.channels * bytesPerSample, true);
  view.setUint16(34, options.bitsPerSample, true);
  writeAscii(wav, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }

  return wav;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    bytes[offset + i] = value.charCodeAt(i);
  }
}
