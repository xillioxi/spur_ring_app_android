export type SummaryGenerationMode = 'auto' | 'custom';
export type SummaryLanguage = 'auto' | 'en' | 'zh';
export type TemplateCategory =
  | 'General'
  | 'Meeting'
  | 'Sales'
  | 'Interview'
  | 'Learning'
  | 'Creator'
  | 'Freelance'
  | 'Legal'
  | 'Court';

export type MeetingNoteTemplate = {
  id: string;
  category: TemplateCategory;
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  sections: string[];
  instructions?: string[];
};

export type MeetingNoteSummary = {
  id: string;
  templateId: string;
  title: string;
  content: string;
  mode: SummaryGenerationMode;
  language: SummaryLanguage;
  speakerLabels: boolean;
  createdAt: number;
  updatedAt: number;
};

export type GenerateMeetingNoteOptions = {
  mode: SummaryGenerationMode;
  templateId?: string;
  customPrompt?: string;
  language: SummaryLanguage;
  speakerLabels: boolean;
};

export const MEETING_NOTE_TEMPLATES: MeetingNoteTemplate[] = [
  {
    id: 'adaptive-summary',
    category: 'General',
    title: { en: 'Adaptive Summary', zh: '智能摘要' },
    description: { en: 'Automatically chooses the clearest structure for this recording.', zh: '根据录音内容自动选择最清晰的结构。' },
    sections: ['Choose the most useful sections based on the conversation type and content.']
  },
  {
    id: 'meeting-highlights',
    category: 'Meeting',
    title: { en: 'Meeting Highlights', zh: '会议重点' },
    description: { en: 'Key topics, decisions, risks, and next steps at a glance.', zh: '快速整理议题、决策、风险和下一步。' },
    sections: ['Overview', 'Key highlights', 'Decisions', 'Risks and blockers', 'Next steps']
  },
  {
    id: 'meeting-minutes',
    category: 'Meeting',
    title: { en: 'Meeting Minutes', zh: '详细会议纪要' },
    description: { en: 'A detailed chronological record with decisions and follow-ups.', zh: '按议题详细记录讨论、决策和跟进事项。' },
    sections: ['Purpose', 'Participants explicitly identified', 'Agenda', 'Discussion by topic', 'Decisions and rationale', 'Follow-ups']
  },
  {
    id: 'action-items',
    category: 'Meeting',
    title: { en: 'Action Items', zh: '行动事项' },
    description: { en: 'Tasks with owners, deadlines, dependencies, and evidence.', zh: '提取任务、负责人、截止时间、依赖项和依据。' },
    sections: ['Desired outcome', 'Action items with owner and deadline', 'Dependencies', 'Risks', 'Open questions']
  },
  {
    id: 'quantitative-data',
    category: 'General',
    title: { en: 'Key Quantitative Data', zh: '关键量化数据' },
    description: { en: 'Extracts dates, amounts, metrics, targets, and comparisons.', zh: '提取日期、金额、指标、目标和对比数据。' },
    sections: ['Key figures', 'Dates and deadlines', 'Targets and actuals', 'Comparisons', 'Data requiring verification']
  },
  {
    id: 'intent-analysis',
    category: 'General',
    title: { en: 'Intent Analysis', zh: '意图分析' },
    description: { en: 'Surfaces goals, concerns, positions, and unresolved intent.', zh: '识别目标、顾虑、立场和未解决的意图。' },
    sections: ['Primary intent', 'Goals by speaker', 'Concerns and objections', 'Areas of agreement', 'Unresolved intent']
  },
  {
    id: 'sales-call',
    category: 'Sales',
    title: { en: 'Sales Call', zh: '销售通话' },
    description: { en: 'Needs, objections, buying signals, and commercial next steps.', zh: '整理客户需求、异议、购买信号和商务下一步。' },
    sections: ['Customer context', 'Needs and pain points', 'Requirements', 'Objections', 'Buying signals', 'Commercial next steps']
  },
  {
    id: 'project-update',
    category: 'Meeting',
    title: { en: 'Project Update', zh: '项目进展' },
    description: { en: 'Progress, milestones, blockers, ownership, and upcoming work.', zh: '整理进度、里程碑、阻塞、负责人和后续工作。' },
    sections: ['Status overview', 'Completed work', 'Milestones', 'Blockers and risks', 'Ownership', 'Upcoming work']
  },
  {
    id: 'interview-notes',
    category: 'Interview',
    title: { en: 'Interview Notes', zh: '访谈笔记' },
    description: { en: 'Questions, answers, evidence, strengths, and follow-ups.', zh: '按问题整理回答、证据、优势和跟进事项。' },
    sections: ['Interview context', 'Questions and answers', 'Evidence and examples', 'Strengths', 'Concerns', 'Follow-up questions']
  },
  {
    id: 'lecture-notes',
    category: 'Learning',
    title: { en: 'Lecture Notes', zh: '课程笔记' },
    description: { en: 'Concepts, explanations, examples, and revision points.', zh: '整理核心概念、解释、示例和复习要点。' },
    sections: ['Topic overview', 'Core concepts', 'Explanations', 'Examples', 'Key terms', 'Revision questions']
  },
  {
    id: 'creator-idea',
    category: 'Creator',
    title: { en: 'Creator Idea Capture', zh: '创作者灵感整理' },
    description: { en: 'Turns a spoken brainstorm into angles, hooks, and next steps.', zh: '将口述灵感整理成选题角度、开场钩子和下一步。' },
    sections: ['Core idea', 'Audience', 'Angles and hooks', 'Key talking points', 'Assets or research needed', 'Next production steps']
  },
  {
    id: 'content-production-brief',
    category: 'Creator',
    title: { en: 'Content Production Brief', zh: '内容制作简报' },
    description: { en: 'A production-ready brief for video, podcast, or social content.', zh: '适用于视频、播客或社交内容的制作简报。' },
    sections: ['Working title', 'Objective', 'Target audience', 'Format and channels', 'Story outline', 'Shots or assets', 'Call to action', 'Publishing tasks']
  },
  {
    id: 'podcast-interview',
    category: 'Creator',
    title: { en: 'Podcast / Creator Interview', zh: '播客／创作者访谈' },
    description: { en: 'Organizes stories, quotable moments, themes, and edit markers.', zh: '整理故事、精彩观点、主题和剪辑标记。' },
    sections: ['Guest and topic', 'Story arc', 'Key insights', 'Notable moments with timestamps', 'Potential clips', 'Follow-up questions', 'Editing notes']
  },
  {
    id: 'client-discovery',
    category: 'Freelance',
    title: { en: 'Freelance Client Discovery', zh: '自由职业客户需求访谈' },
    description: { en: 'Captures client goals, scope, constraints, budget, and approval flow.', zh: '提取客户目标、范围、限制、预算和审批流程。' },
    sections: ['Client context', 'Goals and success criteria', 'Audience or users', 'Requested scope', 'Constraints', 'Budget and timing', 'Stakeholders and approvals', 'Open questions']
  },
  {
    id: 'scope-deliverables',
    category: 'Freelance',
    title: { en: 'Scope & Deliverables', zh: '工作范围与交付物' },
    description: { en: 'Converts a client call into a draft scope and delivery checklist.', zh: '将客户通话整理为工作范围草案和交付清单。' },
    sections: ['Project objective', 'In-scope work', 'Out-of-scope items explicitly discussed', 'Deliverables', 'Milestones', 'Client inputs', 'Review rounds', 'Risks and assumptions', 'Next actions'],
    instructions: ['Treat this as a working summary, not a binding contract. Do not infer commercial terms that were not stated.']
  },
  {
    id: 'client-feedback',
    category: 'Freelance',
    title: { en: 'Client Feedback & Revisions', zh: '客户反馈与修改' },
    description: { en: 'Separates requested revisions, preferences, approvals, and questions.', zh: '区分修改要求、偏好、已确认事项和待澄清问题。' },
    sections: ['Feedback overview', 'Approved elements', 'Requested revisions', 'Priority and owner', 'References mentioned', 'Questions to clarify', 'Next review point']
  },
  {
    id: 'legal-client-intake',
    category: 'Legal',
    title: { en: 'Legal Client Intake', zh: '法律客户接洽记录' },
    description: { en: 'A neutral intake record of parties, chronology, issues, and documents.', zh: '中立整理当事人、时间线、争议事项和相关文件。' },
    sections: ['Matter overview', 'People and entities', 'Client-stated facts', 'Chronology', 'Issues raised', 'Documents or evidence mentioned', 'Deadlines mentioned', 'Questions for follow-up'],
    instructions: ['Clearly attribute claims to the speaker. Separate allegations, opinions, and confirmed facts. Do not provide legal advice or predict outcomes.']
  },
  {
    id: 'legal-consultation',
    category: 'Legal',
    title: { en: 'Legal Consultation Notes', zh: '法律咨询纪要' },
    description: { en: 'Tracks the discussion, client questions, options mentioned, and follow-ups.', zh: '整理咨询内容、客户问题、谈及的方案和跟进事项。' },
    sections: ['Consultation purpose', 'Background provided', 'Questions asked', 'Options discussed', 'Risks or uncertainties mentioned', 'Information requested', 'Follow-up actions'],
    instructions: ['Report only what participants said. Do not independently interpret law, recommend a course of action, or create an attorney-client conclusion.']
  },
  {
    id: 'witness-deposition',
    category: 'Legal',
    title: { en: 'Witness / Deposition Digest', zh: '证人／证言摘要' },
    description: { en: 'Organizes testimony by topic with careful attribution and timestamps.', zh: '按主题整理证言，并保留说话人归属和时间点。' },
    sections: ['Participants and roles as stated', 'Background', 'Testimony by topic', 'Key admissions or denials', 'Dates, locations, and persons mentioned', 'Exhibits mentioned', 'Inconsistencies requiring review', 'Follow-up questions'],
    instructions: ['Use neutral language and precise attribution. Flag possible inconsistencies without resolving credibility. This is an unofficial digest, not a verbatim or certified transcript.']
  },
  {
    id: 'mediation-settlement',
    category: 'Legal',
    title: { en: 'Mediation / Settlement Session', zh: '调解／和解会议' },
    description: { en: 'Separates positions, proposals, disputed points, and conditional terms.', zh: '区分各方立场、提议、争议点和附条件条款。' },
    sections: ['Participants', 'Issues in dispute', 'Positions by party', 'Proposals discussed', 'Areas of agreement', 'Unresolved points', 'Conditions and deadlines stated', 'Next steps'],
    instructions: ['Attribute every position or proposal to its speaker or party. Do not characterize a tentative proposal as an agreement.']
  },
  {
    id: 'court-hearing-record',
    category: 'Court',
    title: { en: 'Court Hearing Record', zh: '庭审记录摘要' },
    description: { en: 'An unofficial chronological digest of appearances, arguments, and rulings.', zh: '按时间整理出庭人员、陈述、争点和裁定的非官方摘要。' },
    sections: ['Unofficial record notice', 'Court, matter, and date if stated', 'Appearances and roles', 'Proceedings in chronological order', 'Applications or motions', 'Arguments by party', 'Evidence or exhibits mentioned', 'Orders or rulings explicitly stated', 'Deadlines and next hearing'],
    instructions: ['Begin with “Unofficial AI-generated summary — not an official court transcript or legal record.” Preserve neutral attribution. Never infer a ruling, legal finding, or procedural status that was not explicitly spoken.']
  },
  {
    id: 'court-case-conference',
    category: 'Court',
    title: { en: 'Case Conference / Directions', zh: '案件管理／程序指示会议' },
    description: { en: 'Captures procedural directions, deadlines, disclosures, and the next listing.', zh: '提取程序指示、期限、披露事项和下次开庭安排。' },
    sections: ['Unofficial record notice', 'Matter and participants', 'Procedural status explicitly stated', 'Directions or orders', 'Disclosure or filing requirements', 'Deadlines', 'Issues reserved', 'Next listing or hearing'],
    instructions: ['Begin with “Unofficial AI-generated summary — verify against the court record.” Do not infer orders or deadlines; include only those expressly stated.']
  },
  {
    id: 'evidence-exhibit-log',
    category: 'Court',
    title: { en: 'Evidence & Exhibit Log', zh: '证据与展品记录' },
    description: { en: 'Extracts evidence references, exhibit identifiers, objections, and status.', zh: '提取证据引用、展品编号、异议和处理状态。' },
    sections: ['Unofficial record notice', 'Evidence or exhibit identifier', 'Description as stated', 'Introduced or referenced by', 'Purpose stated', 'Objections and grounds stated', 'Ruling or status explicitly stated', 'Timestamp'],
    instructions: ['Do not decide admissibility or evidentiary weight. If an identifier or status is unclear, mark it for verification.']
  }
];

export function getMeetingNoteTemplate(id?: string) {
  return MEETING_NOTE_TEMPLATES.find((template) => template.id === id) ?? MEETING_NOTE_TEMPLATES[0];
}

export function templateText(value: { en: string; zh: string }, language: 'en' | 'zh') {
  return value[language];
}

export function buildMeetingNotePrompt(
  template: MeetingNoteTemplate,
  options: GenerateMeetingNoteOptions
) {
  const languageInstruction = options.language === 'en'
    ? 'Write the result in English.'
    : options.language === 'zh'
      ? 'Write the result in Simplified Chinese.'
      : 'Write in the dominant language used in the transcript.';
  const speakerInstruction = options.speakerLabels
    ? 'Retain speaker names or labels when attribution adds useful context.'
    : 'Do not organize the output around speaker labels.';
  const structure = options.customPrompt?.trim()
    ? options.customPrompt.trim()
    : template.sections.map((section) => `- ${section}`).join('\n');

  return [
    'Generate a professional structured note from the supplied transcript.',
    languageInstruction,
    speakerInstruction,
    'Use only information supported by the transcript. Never invent names, decisions, numbers, owners, or deadlines.',
    'If an expected detail is absent, omit it or state that it was not specified.',
    ...(template.instructions ?? []),
    options.mode === 'auto'
      ? 'Adapt the headings and level of detail to the actual conversation. Do not include empty or irrelevant sections.'
      : 'Follow the requested framework while omitting sections that have no supported content.',
    '',
    'Requested framework:',
    structure
  ].join('\n');
}
