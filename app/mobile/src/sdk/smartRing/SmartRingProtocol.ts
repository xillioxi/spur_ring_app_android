import { hexToBytes } from './base64';
import type { SmartRingAudioMeta, SmartRingAudioNotify, SmartRingPcmPacket } from './types';

export const SMART_RING_UUID_SETS = [
  {
    label: 'primary',
    serviceUuid: 'bae80001-4f05-4503-8e65-3af1f7329d1f',
    writeCharacteristicUuid: 'bae80010-4f05-4503-8e65-3af1f7329d1f',
    notifyCharacteristicUuid: 'bae80011-4f05-4503-8e65-3af1f7329d1f'
  },
  {
    label: 'legacy',
    serviceUuid: '00001000-0000-1000-8000-00805f9b34fb',
    writeCharacteristicUuid: '00001001-0000-1000-8000-00805f9b34fb',
    notifyCharacteristicUuid: '00001002-0000-1000-8000-00805f9b34fb'
  }
] as const;

export const SMART_RING_AUDIO_FORMAT = {
  encoding: 'ADPCM',
  sampleRateHz: 8000,
  channels: 1,
  bitsPerSample: 16,
  endian: 'little'
} as const;

export const SMART_RING_PAYLOAD_OFFSET = 10;
export const SMART_RING_CMD_AUDIO = 0x71;
export const SMART_RING_SUBCMD_ADPCM_DATA = 0x01;
export const SMART_RING_SUBCMD_RECORD_BEGIN = 0x10;
export const SMART_RING_SUBCMD_RECORD_END = 0x11;

export class SmartRingProtocol {
  static buildStartRecordingCommand(): Uint8Array {
    return hexToBytes('00 09 71 00 01');
  }

  static buildStopRecordingCommand(): Uint8Array {
    return hexToBytes('00 09 71 00 00');
  }

  static parsePcmNotify(raw: Uint8Array): SmartRingPcmPacket | null {
    if (raw.length < SMART_RING_PAYLOAD_OFFSET + 2) {
      return null;
    }

    if (raw[2] !== 0x71) {
      return null;
    }

    const payloadLength = raw[4] | (raw[5] << 8);
    const available = raw.length - SMART_RING_PAYLOAD_OFFSET;

    if (payloadLength <= 0) {
      return null;
    }

    if (payloadLength > available) {
      return null;
    }

    if (payloadLength % 2 !== 0) {
      return null;
    }

    const payload = raw.slice(SMART_RING_PAYLOAD_OFFSET, SMART_RING_PAYLOAD_OFFSET + payloadLength);

    return {
      payload,
      payloadLength,
      raw,
      receivedAt: Date.now()
    };
  }

  static parseAudioNotify(raw: Uint8Array): SmartRingAudioNotify | null {
    if (raw.length < SMART_RING_PAYLOAD_OFFSET) {
      return null;
    }

    const cmd = raw[2];
    if (cmd !== SMART_RING_CMD_AUDIO) {
      return null;
    }

    const subcmd = raw[3];
    const payloadLength = raw[4] | (raw[5] << 8);
    const seq = raw[6] | (raw[7] << 8) | (raw[8] << 16) | (raw[9] << 24);
    const available = raw.length - SMART_RING_PAYLOAD_OFFSET;

    if (payloadLength < 0 || payloadLength > available) {
      return null;
    }

    const payload = raw.slice(SMART_RING_PAYLOAD_OFFSET, SMART_RING_PAYLOAD_OFFSET + payloadLength);
    const base = {
      cmd,
      subcmd,
      payloadLength,
      seq: seq >>> 0,
      payload,
      raw,
      receivedAt: Date.now()
    };

    if (subcmd === SMART_RING_SUBCMD_RECORD_BEGIN) {
      return {
        ...base,
        type: 'record_begin',
        meta: SmartRingProtocol.parseAudioMeta(payload)
      };
    }

    if (subcmd === SMART_RING_SUBCMD_ADPCM_DATA) {
      return {
        ...base,
        type: 'adpcm_data'
      };
    }

    if (subcmd === SMART_RING_SUBCMD_RECORD_END) {
      return {
        ...base,
        type: 'record_end',
        meta: SmartRingProtocol.parseAudioMeta(payload)
      };
    }

    return {
      ...base,
      type: 'unknown'
    };
  }

  private static parseAudioMeta(payload: Uint8Array): SmartRingAudioMeta | undefined {
    if (payload.length < 14) {
      return undefined;
    }

    return {
      version: payload[0],
      codec: payload[1],
      sampleRate: payload[2] | (payload[3] << 8),
      channels: payload[4],
      bitsPerSample: payload[5],
      value: payload[6] | (payload[7] << 8) | (payload[8] << 16) | (payload[9] << 24),
      durationMs: payload[10] | (payload[11] << 8) | (payload[12] << 16) | (payload[13] << 24)
    };
  }
}
