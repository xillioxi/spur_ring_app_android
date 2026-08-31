import type {
  AssistantPrompt,
  RecordingDetail,
  RecordingGroup,
  RecordingMeta,
  ReminderCard,
  Speaker
} from '@/types';

export const speakers: Speaker[] = [
  { id: 'sales', name: 'Alex', role: 'Sales', color: '#ff6b35' },
  { id: 'market', name: 'Jamie', role: 'Marketing', color: '#1b72e8' },
  { id: 'product', name: 'Ryan', role: 'Product', color: '#05a66b' }
];

const summarySections = [
  {
    title: 'Participants',
    bullets: ['A chip solution provider team discussing hardware integration, chip selection, and production planning.']
  },
  {
    title: 'Purpose and Background',
    bullets: [
      'The teams reviewed pressure sensing, PPG chip performance, test plans, product selection, and customization needs.',
      'The goal was to validate feasibility and shortlist components and technical solutions.'
    ]
  },
  {
    title: 'Key Information',
    bullets: [
      'The supplier has completed several prototype rounds and can provide an SDK, reference design, and joint debugging support.',
      'Both teams will complete power, interference, mechanical space, and production cost data next.'
    ]
  }
];

const transcript = [
  {
    id: 'seg-1',
    speakerId: 'sales' as const,
    time: '00:00',
    text: 'Let’s review the recording ring hardware selection and supplier integration progress, then confirm today’s decisions.'
  },
  {
    id: 'seg-2',
    speakerId: 'market' as const,
    time: '00:09',
    text: 'We also need to confirm user scenarios and the first version of the product messaging.'
  },
  {
    id: 'seg-3',
    speakerId: 'product' as const,
    time: '00:16',
    text: 'The next step is to align the product plan, technical validation, and launch materials.',
    highlight: 'Align the product plan, technical validation, and launch materials.',
    edited: true
  }
];

const details: RecordingDetail[] = [
  makeDetail('rec-06241130', 'New Recording 06241130', 'Today · Wed, Jun 24', 'Ring', 'Hardware Lab', 'synced', ['Pressure sensing', 'Sensors', 'Charging case'], true),
  makeDetail('rec-06241030', 'New Recording 06241030', 'Today · Wed, Jun 24', 'App', 'Meeting Room', 'local', ['Requirements', 'Competitor research'], true),
  makeDetail('rec-06231130', 'Recording 06231130', 'Yesterday · Tue, Jun 23', 'Ring', 'Hardware Lab', 'synced', ['Supplier', 'Pricing']),
  makeDetail('rec-06231030-a', 'Recording 06231030', 'Yesterday · Tue, Jun 23', 'App', 'Meeting Room', 'local', ['Product strategy']),
  makeDetail('rec-06231030-b', 'Recording 06231030', 'Yesterday · Tue, Jun 23', 'Ring', 'Hardware Lab', 'failed', ['Weekly summary'])
];

export const recordingGroups: RecordingGroup[] = [
  { key: 'today', title: 'Today · Wed, Jun 24', records: details.slice(0, 2).map(toMeta) },
  { key: 'yesterday', title: 'Yesterday · Tue, Jun 23', records: details.slice(2).map(toMeta) }
];

export const assistantPrompts: AssistantPrompt[] = [
  { id: 'three-days', label: 'Summarize the last 3 days', query: 'Summarize recordings from the last 3 days' },
  { id: 'seven-days', label: 'Summarize the last 7 days', query: 'Summarize recordings from the last 7 days' },
  { id: 'two-weeks', label: 'Summarize the last 2 weeks', query: 'Summarize recordings from the last 2 weeks' }
];

export const reminderCards: ReminderCard[] = [
  {
    id: 'reminder-1',
    title: 'Follow up on chip power data',
    bullets: ['Complete power, interference, mechanical space, and production cost data.', 'Confirm the SDK integration schedule.'],
    duration: '00:22',
    date: '06-24 11:30',
    location: 'Hardware Lab'
  },
  {
    id: 'reminder-2',
    title: 'Refine product messaging',
    bullets: ['Turn ring recording, AI summaries, and hardware sync into the first homepage value proposition.'],
    duration: '00:22',
    date: '06-24 10:30',
    location: 'Meeting Room'
  },
  {
    id: 'reminder-3',
    title: 'Confirm the BLE file sync protocol',
    bullets: ['Confirm service UUIDs, characteristic UUIDs, chunk size, ACK, CRC, and resume strategy.'],
    duration: '00:22',
    date: '06-23 11:30',
    location: 'Hardware Lab'
  },
  {
    id: 'reminder-4',
    title: 'Capture the wearable AI idea',
    bullets: ['Build a lightweight voice-first flow that turns quick thoughts into structured tasks.'],
    duration: '00:11',
    date: '06-23 09:42',
    location: 'On the go'
  },
  {
    id: 'reminder-5',
    title: 'Draft the weekly progress report',
    bullets: ['Summarize completed integration work.', 'List current risks and next milestones.'],
    duration: '08:46',
    date: '06-22 18:20',
    location: 'Office'
  },
  {
    id: 'reminder-6',
    title: 'Extract today’s action items',
    bullets: ['Create owners and deadlines from the latest meeting recording.'],
    duration: '16:08',
    date: '06-22 16:05',
    location: 'Meeting Room'
  }
];

export function getRecordingById(id: string) {
  return details.find((record) => record.id === id) ?? details[0];
}

function makeDetail(
  id: string,
  title: string,
  dayLabel: string,
  source: string,
  location: string,
  syncState: RecordingDetail['syncState'],
  tags: string[],
  unread?: boolean
): RecordingDetail {
  return {
    id,
    title,
    date: id.includes('0624') ? '06-24 11:30' : '06-23 11:30',
    dayLabel,
    duration: '00:22',
    source,
    location,
    unread,
    syncState,
    tags,
    speakers,
    summarySections,
    transcript
  };
}

function toMeta(record: RecordingDetail): RecordingMeta {
  const { id, title, date, dayLabel, duration, source, location, unread, syncState } = record;
  return { id, title, date, dayLabel, duration, source, location, unread, syncState };
}
