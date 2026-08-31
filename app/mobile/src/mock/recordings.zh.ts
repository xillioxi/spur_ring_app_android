import type {
  AssistantPrompt,
  RecordingDetail,
  RecordingGroup,
  RecordingMeta,
  ReminderCard,
  Speaker
} from '@/types';

export const speakers: Speaker[] = [
  { id: 'sales', name: '超哥', role: '销售部', color: '#ff6b35' },
  { id: 'market', name: '佳怡', role: '市场部', color: '#1b72e8' },
  { id: 'product', name: '若鹏', role: '产品部', color: '#05a66b' }
];

const summarySections = [
  {
    title: '交流对象',
    bullets: ['来自苏州的芯片方案供应商团队，主要沟通硬件技术对接、芯片选型和量产配合节奏。']
  },
  {
    title: '目的与背景',
    bullets: [
      '本次交流为硬件技术对接会，我方与供应商就电容压感方案、PPG 生物检测芯片性能、测试方案、产品选型及定制化需求展开深入沟通。',
      '会议目标是验证方案可行性，并为后续产品开发筛选合适的元器件与技术方案。'
    ]
  },
  {
    title: '关键信息',
    bullets: [
      '供应商已完成多轮样机验证，可提供基础 SDK、硬件参考设计与联合调试支持。',
      '双方确认下一步补齐功耗、抗干扰、结构空间和量产成本四类数据。'
    ]
  }
];

const transcript = [
  {
    id: 'seg-1',
    speakerId: 'sales' as const,
    time: '00:00',
    text: 'OK，大家听一下，我们这次开会，主要是同步录音戒指的硬件选型和供应商对接进展，先把今天要定的事项过一遍。'
  },
  {
    id: 'seg-2',
    speakerId: 'market' as const,
    time: '00:09',
    text: 'OK，大家听一下，我们这次开会，主要是确认用户侧场景和第一版卖点表达，内容会影响后续页面和物料节奏。'
  },
  {
    id: 'seg-3',
    speakerId: 'product' as const,
    time: '00:16',
    text: 'OK，大家听一下，我们这次开会，主要是内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容。',
    highlight: '内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容',
    edited: true
  }
];

const details: RecordingDetail[] = [
  {
    id: 'rec-06241130',
    title: '新录音06241130',
    date: '06-24 11:30',
    dayLabel: '今天 6月24日 周三',
    duration: '00:22',
    source: '戒指',
    location: '地址地址',
    unread: true,
    syncState: 'synced',
    tags: ['电容压感', '电容传感', '电容底座'],
    speakers,
    summarySections,
    transcript
  },
  {
    id: 'rec-06241030',
    title: '新录音06241030',
    date: '06-24 10:30',
    dayLabel: '今天 6月24日 周三',
    duration: '00:22',
    source: 'APP',
    location: '地址地址',
    unread: true,
    syncState: 'local',
    tags: ['需求同步', '竞品调研'],
    speakers,
    summarySections,
    transcript
  },
  {
    id: 'rec-06231130',
    title: '录音06231130',
    date: '06-23 11:30',
    dayLabel: '昨天 6月23日 周二',
    duration: '00:22',
    source: '戒指',
    location: '地址地址',
    syncState: 'synced',
    tags: ['供应商', '报价'],
    speakers,
    summarySections,
    transcript
  },
  {
    id: 'rec-06231030-a',
    title: '录音06231030',
    date: '06-23 10:30',
    dayLabel: '昨天 6月23日 周二',
    duration: '00:22',
    source: 'APP',
    location: '地址地址',
    syncState: 'local',
    tags: ['产品策略'],
    speakers,
    summarySections,
    transcript
  },
  {
    id: 'rec-06231030-b',
    title: '录音06231030',
    date: '06-23 10:30',
    dayLabel: '昨天 6月23日 周二',
    duration: '00:22',
    source: '戒指',
    location: '地址地址',
    syncState: 'failed',
    tags: ['周会纪要'],
    speakers,
    summarySections,
    transcript
  }
];

export const recordingGroups: RecordingGroup[] = [
  {
    key: 'today',
    title: '今天 6月24日 周三',
    records: details.slice(0, 2).map(toMeta)
  },
  {
    key: 'yesterday',
    title: '昨天 6月23日 周二',
    records: details.slice(2).map(toMeta)
  }
];

export const assistantPrompts: AssistantPrompt[] = [
  { id: 'three-days', label: '整理3天的录音文件', query: '整理3天的录音文件' },
  { id: 'seven-days', label: '整理7天的录音文件', query: '整理7天的录音文件' },
  { id: 'two-weeks', label: '整理两周的录音文件', query: '整理两周的录音文件' }
];

export const reminderCards: ReminderCard[] = [
  {
    id: 'reminder-1',
    title: '跟进供应商芯片功耗数据',
    bullets: ['补齐功耗、抗干扰、结构空间和量产成本四类数据。', '下次会议前确认 SDK 联调排期。'],
    duration: '00:22',
    date: '06-24 11:30',
    location: '地址地址'
  },
  {
    id: 'reminder-2',
    title: '整理用户侧卖点表达',
    bullets: ['将戒指录音、AI 纪要、硬件同步能力整理成首版首页卖点。'],
    duration: '00:22',
    date: '06-24 10:30',
    location: '地址地址'
  },
  {
    id: 'reminder-3',
    title: '确认 BLE 文件同步协议',
    bullets: ['需要服务 UUID、特征 UUID、分片大小、ACK、CRC、断点续传策略。'],
    duration: '00:22',
    date: '06-23 11:30',
    location: '地址地址'
  },
  {
    id: 'reminder-4',
    title: '记录可穿戴 AI 产品想法',
    bullets: ['建立轻量语音优先流程，把随手想法转化为结构化任务。'],
    duration: '00:11',
    date: '06-23 09:42',
    location: '移动场景'
  },
  {
    id: 'reminder-5',
    title: '撰写本周进展报告',
    bullets: ['总结已经完成的集成工作。', '列出当前风险和下一阶段里程碑。'],
    duration: '08:46',
    date: '06-22 18:20',
    location: '办公室'
  },
  {
    id: 'reminder-6',
    title: '提取今天的待办事项',
    bullets: ['从最新会议录音中生成负责人和截止时间。'],
    duration: '16:08',
    date: '06-22 16:05',
    location: '会议室'
  }
];

export function getRecordingById(id: string) {
  return details.find((record) => record.id === id) ?? details[0];
}

function toMeta(record: RecordingDetail): RecordingMeta {
  const { id, title, date, dayLabel, duration, source, location, unread, syncState } = record;
  return { id, title, date, dayLabel, duration, source, location, unread, syncState };
}
