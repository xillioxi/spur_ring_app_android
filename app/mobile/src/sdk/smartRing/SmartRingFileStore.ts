import * as FileSystem from 'expo-file-system';

import { bytesToBase64 } from './base64';

const RECORDING_DIR = `${FileSystem.documentDirectory ?? ''}xring_recordings/`;

export async function saveSmartRingWav(wavBytes: Uint8Array, filename = `recording_${Date.now()}.wav`): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error('当前环境不支持 documentDirectory，无法保存 WAV');
  }

  const dirInfo = await FileSystem.getInfoAsync(RECORDING_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });
  }

  const uri = `${RECORDING_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(wavBytes), {
    encoding: FileSystem.EncodingType.Base64
  });

  return uri;
}
