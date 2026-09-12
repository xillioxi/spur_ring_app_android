import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { NativeModules, Platform } from 'react-native';

import { AUDIO_AGENT_BASE_URL, assertAudioAgentHttpsForRelease } from '@/config/api';

const { SpurFilePreview } = NativeModules as {
  SpurFilePreview?: { preview: (uri: string, fileName: string) => Promise<void> };
};

export type OfficeKind = 'pdf' | 'pptx';

export type OfficeCreateResult = {
  ok: boolean;
  kind: OfficeKind;
  url: string;
  bytes: number;
  fileName: string;
};

const OFFICE_DIR = `${FileSystem.documentDirectory}office/`;
const OFFICE_TIMEOUT_MS = 300_000;

function postOfficeJson(
  url: string,
  payload: unknown,
  onXhr?: (xhr: XMLHttpRequest) => void
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr?.(xhr);
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = OFFICE_TIMEOUT_MS;
    xhr.onload = () => resolve({ status: xhr.status, text: String(xhr.responseText || '') });
    xhr.onerror = () => reject(new Error('网络错误，请稍后重试'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.ontimeout = () => reject(new Error('生成超时，请稍后重试'));
    xhr.send(JSON.stringify(payload));
  });
}

export async function createOfficeDocument(
  prompt: string,
  kind: OfficeKind,
  options?: { onXhr?: (xhr: XMLHttpRequest) => void }
): Promise<OfficeCreateResult> {
  assertAudioAgentHttpsForRelease();
  const { status, text } = await postOfficeJson(
    `${AUDIO_AGENT_BASE_URL}/api/office`,
    { prompt, kind },
    options?.onXhr
  );
  let body: OfficeCreateResult & { error?: string };
  try {
    body = JSON.parse(text) as OfficeCreateResult & { error?: string };
  } catch {
    throw new Error(text || `HTTP ${status}`);
  }
  if (status < 200 || status >= 300 || !body.ok || !body.url) {
    throw new Error(body.error || `HTTP ${status}`);
  }
  return body;
}

export async function saveOfficeDocument(result: OfficeCreateResult): Promise<string> {
  await FileSystem.makeDirectoryAsync(OFFICE_DIR, { intermediates: true });
  const dest = `${OFFICE_DIR}${result.fileName}`;
  const downloaded = await FileSystem.downloadAsync(result.url, dest);
  return downloaded.uri;
}

export async function openLocalOfficeFile(localUri: string, fileName: string): Promise<void> {
  if (Platform.OS === 'ios' && SpurFilePreview?.preview) {
    await SpurFilePreview.preview(localUri, fileName);
    return;
  }
  const mime = fileName.endsWith('.pptx')
    ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : 'application/pdf';
  const uti = fileName.endsWith('.pptx')
    ? 'org.openxmlformats.presentationml.presentation'
    : 'com.adobe.pdf';
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available');
  }
  await Sharing.shareAsync(localUri, { mimeType: mime, UTI: uti, dialogTitle: fileName });
}
