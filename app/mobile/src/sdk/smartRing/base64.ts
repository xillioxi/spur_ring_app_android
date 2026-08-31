const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    output += alphabet[bytes[i] >> 2];
    output += alphabet[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    output += alphabet[((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6)];
    output += alphabet[bytes[i + 2] & 0x3f];
  }

  if (i < bytes.length) {
    output += alphabet[bytes[i] >> 2];

    if (i + 1 < bytes.length) {
      output += alphabet[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
      output += alphabet[(bytes[i + 1] & 0x0f) << 2];
      output += '=';
    } else {
      output += alphabet[(bytes[i] & 0x03) << 4];
      output += '==';
    }
  }

  return output;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${hex}`);
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }

  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
