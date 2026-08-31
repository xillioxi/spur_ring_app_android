const BUDDY_PORT = 17891;

export type BuddyTaskType = 'write_note' | 'write_outline' | 'list_files' | 'delete' | 'instruct';

export type BuddyTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_confirm'
  | 'discarded';

export type BuddyStatus = {
  ok: boolean;
  service: string;
  workFolder: string;
  port: number;
};

export type BuddyTaskResult = {
  id: string;
  status: BuddyTaskStatus;
  message: string;
  preview?: string | null;
  artifacts: string[];
};

export function normalizeBuddyHost(input: string): string {
  return input.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

export function buddyBaseUrl(host: string): string {
  const normalized = normalizeBuddyHost(host);
  if (!normalized) {
    throw new Error('Mac IP is empty');
  }
  if (normalized.includes(':')) {
    return `http://${normalized}`;
  }
  return `http://${normalized}:${BUDDY_PORT}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(text || `HTTP ${response.status}`);
  }
}

export async function fetchBuddyStatus(host: string, pairingCode: string): Promise<BuddyStatus> {
  const response = await fetch(`${buddyBaseUrl(host)}/v1/status`, {
    headers: { 'X-Spur-Pairing': pairingCode.trim() }
  });
  const body = (await parseJson(response)) as BuddyStatus & { error?: string };
  if (!response.ok || !body.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

export async function postBuddyTask(
  host: string,
  pairingCode: string,
  task: {
    id?: string;
    type: BuddyTaskType;
    title?: string;
    confirmed?: boolean;
    payload?: { filename?: string; content?: string; path?: string };
  }
): Promise<BuddyTaskResult> {
  const controller = new AbortController();
  const timeoutMs = task.type === 'instruct' ? 180_000 : 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${buddyBaseUrl(host)}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Spur-Pairing': pairingCode.trim()
      },
      body: JSON.stringify({
        id: task.id ?? `phone-${Date.now()}`,
        type: task.type,
        title: task.title,
        confirmed: task.confirmed ?? false,
        payload: task.payload
      }),
      signal: controller.signal
    });
    const body = (await parseJson(response)) as BuddyTaskResult & { error?: string };
    if (!body.status && body.error) {
      throw new Error(body.error);
    }
    if (!body.status) {
      throw new Error(`HTTP ${response.status}`);
    }
    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Buddy timed out waiting for the Mac cloud task');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
