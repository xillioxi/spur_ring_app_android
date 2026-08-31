import { AUDIO_AGENT_BASE_URL } from '@/config/api';

const MOCK_DELAY_MS = 250;

export const apiConfig = {
  baseUrl: AUDIO_AGENT_BASE_URL,
  useMock: true
};

export function setApiBaseUrl(baseUrl: string) {
  apiConfig.baseUrl = baseUrl.replace(/\/$/, '');
}

export function setUseMock(useMock: boolean) {
  apiConfig.useMock = useMock;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await apiFetchOnce<T>(path, init);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiHttpError && [502, 503, 504].includes(error.status);
      if (!retryable || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function apiFetchOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiConfig.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      signal: controller.signal
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[apiFetch] ${url} failed: ${detail}`);
    throw new Error(`Cannot reach AI service: ${detail}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[apiFetch] ${url} HTTP ${response.status}: ${body}`);
    throw new ApiHttpError(response.status, body);
  }

  return response.json() as Promise<T>;
}

class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    body: string
  ) {
    super(`AI service returned HTTP ${status}${body ? `: ${body}` : ''}`);
  }
}

export function waitForMock<T>(value: T, delay = MOCK_DELAY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delay);
  });
}
