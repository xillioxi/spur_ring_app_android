import { DeviceEventEmitter } from 'react-native';

import {
  getLocalAgentCard,
  saveAgentCard,
  type AgentOfficeState,
  type LocalAgentCard
} from '@/services/localAgentCards';
import {
  createOfficeDocument,
  openLocalOfficeFile,
  saveOfficeDocument,
  type OfficeKind
} from '@/services/officeApi';

export const OFFICE_JOB_EVENT = 'spur-office-job';

type Job = {
  aborted: boolean;
  xhr: XMLHttpRequest | null;
};

const jobs = new Map<string, Job>();

export function isOfficeJobRunning(cardId: string): boolean {
  return jobs.has(cardId);
}

export function inferOfficeKind(text: string): OfficeKind | null {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return null;
  if (/pptx|\bppt\b|powerpoint|幻灯|演示文稿|生成ppt|做ppt|做一份ppt/.test(value)) return 'pptx';
  if (/pdf|做成.*pdf|生成.*pdf|导出.*pdf|写成.*pdf|做一份.*pdf/.test(value)) return 'pdf';
  return null;
}

async function emitCard(card: LocalAgentCard) {
  await saveAgentCard(card);
  DeviceEventEmitter.emit(OFFICE_JOB_EVENT, card);
  return card;
}

async function patchOffice(cardId: string, office: AgentOfficeState): Promise<LocalAgentCard | null> {
  const card = await getLocalAgentCard(cardId);
  if (!card) return null;
  return emitCard({ ...card, office, updatedAt: Date.now() });
}

export async function startOfficeJob(card: LocalAgentCard, kind: OfficeKind, prompt: string): Promise<void> {
  if (jobs.has(card.id)) return;
  const job: Job = { aborted: false, xhr: null };
  jobs.set(card.id, job);
  const startedAt = Date.now();
  await patchOffice(card.id, {
    kind,
    status: 'generating',
    trajectory: [`已听懂：做成 ${kind === 'pptx' ? 'PPT' : 'PDF'}`],
    prompt,
    startedAt
  });
  void runOfficeJob(card.id, kind, prompt, job, startedAt);
}

async function runOfficeJob(
  cardId: string,
  kind: OfficeKind,
  prompt: string,
  job: Job,
  startedAt: number
): Promise<void> {
  const trajectory: string[] = [`已听懂：做成 ${kind === 'pptx' ? 'PPT' : 'PDF'}`];
  const push = async (line: string) => {
    if (job.aborted) return;
    trajectory.push(line);
    await patchOffice(cardId, {
      kind,
      status: 'generating',
      trajectory: [...trajectory],
      prompt,
      startedAt
    });
  };

  try {
    await push('正在写文案…');
    const result = await createOfficeDocument(prompt, kind, {
      onXhr: (xhr) => {
        job.xhr = xhr;
      }
    });
    if (job.aborted) return;
    await push('正在保存到本机…');
    const localUri = await saveOfficeDocument(result);
    if (job.aborted) return;
    await push('已保存到本机');
    const latest = await getLocalAgentCard(cardId);
    if (!latest) return;
    await emitCard({
      ...latest,
      office: {
        kind,
        status: 'ready',
        trajectory: [...trajectory],
        prompt,
        fileName: result.fileName,
        localUri,
        remoteUrl: result.url,
        startedAt
      },
      updatedAt: Date.now()
    });
  } catch (error) {
    if (job.aborted) return;
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'cancelled') return;
    const latest = await getLocalAgentCard(cardId);
    if (!latest) return;
    await emitCard({
      ...latest,
      office: {
        kind,
        status: 'failed',
        trajectory: [...trajectory, `失败：${message}`],
        prompt,
        error: message,
        startedAt
      },
      updatedAt: Date.now()
    });
  } finally {
    jobs.delete(cardId);
  }
}

export async function cancelOfficeJob(cardId: string): Promise<void> {
  const job = jobs.get(cardId);
  if (job) {
    job.aborted = true;
    try {
      job.xhr?.abort();
    } catch {
      // ignore
    }
  }
  const card = await getLocalAgentCard(cardId);
  if (!card?.office) return;
  await emitCard({
    ...card,
    office: {
      ...card.office,
      status: 'cancelled',
      trajectory: [...(card.office.trajectory ?? []), '已取消'],
      error: undefined
    },
    updatedAt: Date.now()
  });
  jobs.delete(cardId);
}

export async function markStaleOfficeJobs(cards: LocalAgentCard[]): Promise<LocalAgentCard[]> {
  let changed = false;
  const next = cards.map((card) => {
    if (card.office?.status !== 'generating' || isOfficeJobRunning(card.id)) return card;
    changed = true;
    return {
      ...card,
      office: {
        ...card.office,
        status: 'failed' as const,
        error: '生成已中断',
        trajectory: [...(card.office.trajectory ?? []), '生成已中断，请重试']
      },
      updatedAt: Date.now()
    };
  });
  if (changed) {
    for (const card of next) {
      if (card.office?.status === 'failed' && card.office.error === '生成已中断') {
        await saveAgentCard(card);
      }
    }
  }
  return next;
}

export async function openCardOffice(card: LocalAgentCard): Promise<void> {
  const office = card.office;
  if (!office?.localUri || !office.fileName) throw new Error('还没有可打开的文件');
  await openLocalOfficeFile(office.localUri, office.fileName);
}
