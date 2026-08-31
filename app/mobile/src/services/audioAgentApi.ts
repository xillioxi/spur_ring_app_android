import { assertAudioAgentHttpsForRelease, AUDIO_AGENT_BASE_URL } from '@/config/api';

export type AudioAgentResult = {
  id: string;
  transcript: string;
  agent: {
    output: string;
    exitCode: number;
    imageUrl?: string;
  };
};

export type AudioTaskType = 'recording_summary' | 'agent_command' | 'agent_image';

export async function processAudioWithAi(input: {
  uri: string;
  name: string;
  taskType?: AudioTaskType;
}): Promise<AudioAgentResult> {
  const name = input.name || 'recording.ogg';
  const body = new FormData();
  body.append('audio', {
    uri: input.uri,
    name,
    type: mimeTypeForAudioName(name)
  } as unknown as Blob);
  body.append('taskType', input.taskType ?? 'agent_command');

  assertAudioAgentHttpsForRelease();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(`${AUDIO_AGENT_BASE_URL}/api/audio-task`, {
      method: 'POST',
      body,
      signal: controller.signal
    });
    const text = await response.text();
    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Cloud returned invalid JSON (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(readErrorMessage(payload) || `Cloud request failed (${response.status})`);
    }

    if (!isAudioAgentResult(payload)) {
      throw new Error('Cloud response is missing transcript or AI result');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Cloud processing timed out after 5 minutes');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mimeTypeForAudioName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4') || lower.endsWith('.aac')) {
    return 'audio/mp4';
  }
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  return 'audio/ogg';
}

function isAudioAgentResult(value: unknown): value is AudioAgentResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AudioAgentResult>;
  return (
    typeof result.id === 'string' &&
    typeof result.transcript === 'string' &&
    !!result.agent &&
    typeof result.agent.output === 'string' &&
    typeof result.agent.exitCode === 'number' &&
    (result.agent.imageUrl === undefined || typeof result.agent.imageUrl === 'string')
  );
}

function readErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}
