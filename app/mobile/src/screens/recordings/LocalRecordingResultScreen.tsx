import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Plus, Sparkles, X } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { ChatComposer } from '@/components/ChatComposer';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { recordingApi } from '@/services/api/recordingService';
import {
  generateMeetingNoteSummary,
  getMeetingNoteSummaries,
  getRecordingAnalysis,
  type LocalRecordingAnalysis
} from '@/services/localRecordingAnalysis';
import {
  MEETING_NOTE_TEMPLATES,
  templateText,
  type SummaryGenerationMode,
  type SummaryLanguage,
  type TemplateCategory
} from '@/services/meetingNoteTemplates';
import { colors } from '@/theme/colors';
import { t, APP_LANGUAGE } from '@/locales';
import { titleFromMeetingNotes } from '@/utils/meetingNotesTitle';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordingSummary'>;
type ResultTab = 'transcript' | 'notes';
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'General',
  'Meeting',
  'Creator',
  'Freelance',
  'Sales',
  'Interview',
  'Learning',
  'Legal',
  'Court'
];

type NoteChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export function LocalRecordingResultScreen({ route }: Props) {
  const [record, setRecord] = useState<LocalRecordingAnalysis | null | undefined>(undefined);
  const [tab, setTab] = useState<ResultTab>(route.params.tab || 'notes');
  const [messages, setMessages] = useState<NoteChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [activeSummaryId, setActiveSummaryId] = useState('original-meeting-notes');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<SummaryGenerationMode>('auto');
  const [selectedTemplateId, setSelectedTemplateId] = useState('meeting-highlights');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'All'>('All');
  const [summaryLanguage, setSummaryLanguage] = useState<SummaryLanguage>('auto');
  const [speakerLabels, setSpeakerLabels] = useState(true);
  const [useCustomInstructions, setUseCustomInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getRecordingAnalysis(route.params.id).then((value) => {
      setRecord(value);
      const firstSummary = value ? getMeetingNoteSummaries(value)[0] : undefined;
      if (firstSummary) setActiveSummaryId(firstSummary.id);
    });
  }, [route.params.id]);

  const summaries = record ? getMeetingNoteSummaries(record) : [];
  const activeSummary = summaries.find((summary) => summary.id === activeSummaryId) ?? summaries[0];
  const visibleTemplates = selectedCategory === 'All'
    ? MEETING_NOTE_TEMPLATES.filter((template) => template.id !== 'adaptive-summary')
    : MEETING_NOTE_TEMPLATES.filter((template) => template.category === selectedCategory && template.id !== 'adaptive-summary');

  async function askAboutNotes(question: string) {
    if (!record || asking) return;

    const userMessage: NoteChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question
    };
    setMessages((current) => [...current, userMessage]);
    setAsking(true);

    try {
      const replies = await recordingApi.askAssistant(question, {
        transcript: record.transcript,
        meetingNotes: activeSummary?.content || record.meetingNotes
      });
      const answer = replies.find((item) => item.role === 'assistant')?.text;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: answer ? stripMarkdown(answer) : t.recordings.askFailed
        }
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: `${t.recordings.askFailed}\n${detail}`
        }
      ]);
    } finally {
      setAsking(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  async function generateSummary() {
    if (!record || generating) return;
    if (generationMode === 'custom' && useCustomInstructions && !customInstructions.trim()) {
      setGenerationError(t.recordings.customInstructionsPlaceholder);
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateMeetingNoteSummary(record.id, {
        mode: generationMode,
        templateId: selectedTemplateId,
        customPrompt: generationMode === 'custom' && useCustomInstructions ? customInstructions : undefined,
        language: summaryLanguage,
        speakerLabels
      });
      setRecord(result.record);
      setActiveSummaryId(result.summary.id);
      setGeneratorOpen(false);
      setCustomInstructions('');
      setUseCustomInstructions(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : t.recordings.generateFailed);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <AppScreen tone="plain" scroll={false} bottomInset={36}>
        <PageHeader />
        {record === undefined ? (
          <LoadingState />
        ) : !record ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t.recordings.resultUnavailable}</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.headerCard}>
              <Text style={styles.title}>
                {titleFromMeetingNotes(record.meetingNotes) || t.recordings.notesTab}
              </Text>
              <Text style={styles.meta}>
                {formatDate(record.modifiedAt)} · {formatDuration(record.durationMs)}
              </Text>
            </View>

            <View style={styles.tabs}>
              <TabButton
                active={tab === 'transcript'}
                label={t.recordings.transcriptTab}
                onPress={() => setTab('transcript')}
              />
              <TabButton
                active={tab === 'notes'}
                label={t.recordings.notesTab}
                onPress={() => setTab('notes')}
              />
            </View>

            {tab === 'transcript' ? (
              <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
                <View style={styles.resultCard}>
                  <Text style={styles.sectionTitle}>{t.recordings.transcriptTab}</Text>
                  {record.transcriptionProvider ? (
                    <Text style={styles.transcriptionMeta}>
                      {[
                        record.transcriptionModel || record.transcriptionProvider,
                        record.transcriptionLanguageCode?.toUpperCase()
                      ].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {record.transcriptSegments?.length ? (
                    <View style={styles.transcriptList}>
                      {record.transcriptSegments.map((segment, index) => (
                        <View style={styles.transcriptSegment} key={`${segment.speakerId}-${segment.start}-${index}`}>
                          <View style={styles.transcriptHeader}>
                            <Text style={[styles.speakerName, { color: speakerColor(segment.speakerId) }]}>
                              {segment.speakerName}
                            </Text>
                            <Text style={styles.segmentTime}>{formatTimestamp(segment.start)}</Text>
                          </View>
                          <Text style={styles.resultText}>{segment.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.resultText}>{record.transcript || t.recordings.resultUnavailable}</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <>
                <View style={styles.summaryTabsRow}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.summaryTabsContent}
                  >
                    {summaries.map((summary) => (
                      <Pressable
                        key={summary.id}
                        style={[styles.summaryTab, activeSummary?.id === summary.id && styles.summaryTabActive]}
                        onPress={() => setActiveSummaryId(summary.id)}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.summaryTabText, activeSummary?.id === summary.id && styles.summaryTabTextActive]}
                        >
                          {summaryTitle(summary)}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityLabel={t.recordings.addSummary}
                      style={styles.addSummaryButton}
                      onPress={() => {
                        setGenerationError(null);
                        setGeneratorOpen(true);
                      }}
                    >
                      <Plus color={colors.text} size={18} strokeWidth={2.5} />
                    </Pressable>
                  </ScrollView>
                </View>
                <ScrollView
                  ref={scrollRef}
                  style={styles.flex}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.resultCard}>
                    <View style={styles.summaryHeader}>
                      <View style={styles.summaryTitleWrap}>
                        <Text style={styles.sectionTitle}>{activeSummary ? summaryTitle(activeSummary) : t.recordings.notesTab}</Text>
                        {activeSummary ? (
                          <Text style={styles.summaryMeta}>
                            {activeSummary.mode === 'auto' ? t.recordings.autoGeneration : t.recordings.customGeneration}
                            {' · '}{t.recordings.summaryModel}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable style={styles.inlineAddButton} onPress={() => setGeneratorOpen(true)}>
                        <Sparkles color={colors.text} size={17} />
                        <Text style={styles.inlineAddText}>{t.recordings.addSummary}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.resultText}>
                      {stripMarkdown(activeSummary?.content || record.meetingNotes || '') || t.recordings.resultUnavailable}
                    </Text>
                  </View>

                  <View style={styles.askCard}>
                    <Text style={styles.askTitle}>{t.recordings.askAboutNotes}</Text>
                    <Text style={styles.askHint}>{t.recordings.askAboutNotesHint}</Text>
                    {messages.map((message) =>
                      message.role === 'user' ? (
                        <View style={styles.userBubble} key={message.id}>
                          <Text style={styles.userText}>{message.text}</Text>
                        </View>
                      ) : (
                        <View style={styles.assistantBubble} key={message.id}>
                          <Text style={styles.assistantText}>{message.text}</Text>
                        </View>
                      )
                    )}
                    {asking ? <Text style={styles.typing}>{t.recordings.asking}</Text> : null}
                  </View>
                </ScrollView>

                <View style={styles.composerWrap}>
                  <ChatComposer
                    placeholder={t.recordings.askPlaceholder}
                    disabled={asking}
                    onSubmit={(value) => void askAboutNotes(value)}
                  />
                </View>
              </>
            )}
          </View>
        )}

        <Modal
          animationType="slide"
          transparent
          visible={generatorOpen}
          onRequestClose={() => !generating && setGeneratorOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              style={styles.modalKeyboard}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.generatorSheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.sheetTitle}>{t.recordings.generateTitle}</Text>
                    <Text style={styles.sheetSubtitle}>{t.recordings.generateSubtitle}</Text>
                  </View>
                  <Pressable
                    disabled={generating}
                    style={styles.closeButton}
                    onPress={() => setGeneratorOpen(false)}
                  >
                    <X color={colors.text} size={21} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modeGrid}>
                    <GenerationModeCard
                      active={generationMode === 'auto'}
                      title={t.recordings.autoGeneration}
                      hint={t.recordings.autoGenerationHint}
                      onPress={() => setGenerationMode('auto')}
                    />
                    <GenerationModeCard
                      active={generationMode === 'custom'}
                      title={t.recordings.customGeneration}
                      hint={t.recordings.customGenerationHint}
                      onPress={() => setGenerationMode('custom')}
                    />
                  </View>

                  {generationMode === 'custom' ? (
                    <>
                      <Text style={styles.controlLabel}>{t.recordings.templates}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                        <FilterChip
                          active={selectedCategory === 'All'}
                          label={t.recordings.allTemplates}
                          onPress={() => setSelectedCategory('All')}
                        />
                        {TEMPLATE_CATEGORIES.map((category) => (
                          <FilterChip
                            key={category}
                            active={selectedCategory === category}
                            label={t.recordings.templateCategories[category]}
                            onPress={() => setSelectedCategory(category)}
                          />
                        ))}
                      </ScrollView>

                      <View style={styles.templateGrid}>
                        {visibleTemplates.map((template) => {
                          const active = selectedTemplateId === template.id && !useCustomInstructions;
                          return (
                            <Pressable
                              key={template.id}
                              style={[styles.templateCard, active && styles.templateCardActive]}
                              onPress={() => {
                                setSelectedTemplateId(template.id);
                                setUseCustomInstructions(false);
                              }}
                            >
                              <View style={styles.templateCardHeader}>
                                <Text style={[styles.templateName, active && styles.templateNameActive]}>
                                  {templateText(template.title, APP_LANGUAGE)}
                                </Text>
                                {active ? <Check color="#fff" size={16} strokeWidth={3} /> : null}
                              </View>
                              <Text style={[styles.templateDescription, active && styles.templateDescriptionActive]}>
                                {templateText(template.description, APP_LANGUAGE)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable
                        style={[styles.customToggle, useCustomInstructions && styles.customToggleActive]}
                        onPress={() => setUseCustomInstructions((value) => !value)}
                      >
                        <View style={[styles.checkbox, useCustomInstructions && styles.checkboxActive]}>
                          {useCustomInstructions ? <Check color="#fff" size={14} strokeWidth={3} /> : null}
                        </View>
                        <Text style={styles.customToggleText}>{t.recordings.useCustomInstructions}</Text>
                      </Pressable>
                      {useCustomInstructions ? (
                        <View style={styles.customInputWrap}>
                          <Text style={styles.controlLabel}>{t.recordings.customInstructions}</Text>
                          <TextInput
                            multiline
                            value={customInstructions}
                            onChangeText={setCustomInstructions}
                            placeholder={t.recordings.customInstructionsPlaceholder}
                            placeholderTextColor={colors.textTertiary}
                            style={styles.customInput}
                          />
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <Text style={styles.controlLabel}>{t.recordings.language}</Text>
                  <View style={styles.languageRow}>
                    <FilterChip active={summaryLanguage === 'auto'} label={t.recordings.languageAuto} onPress={() => setSummaryLanguage('auto')} />
                    <FilterChip active={summaryLanguage === 'en'} label={t.recordings.languageEnglish} onPress={() => setSummaryLanguage('en')} />
                    <FilterChip active={summaryLanguage === 'zh'} label={t.recordings.languageChinese} onPress={() => setSummaryLanguage('zh')} />
                  </View>

                  <Pressable style={styles.speakerControl} onPress={() => setSpeakerLabels((value) => !value)}>
                    <View style={styles.speakerControlText}>
                      <Text style={styles.speakerControlTitle}>{t.recordings.speakerLabels}</Text>
                      <Text style={styles.speakerControlHint}>{t.recordings.speakerLabelsHint}</Text>
                    </View>
                    <View style={[styles.switchTrack, speakerLabels && styles.switchTrackActive]}>
                      <View style={[styles.switchThumb, speakerLabels && styles.switchThumbActive]} />
                    </View>
                  </Pressable>

                  {generationError ? <Text style={styles.generationError}>{generationError}</Text> : null}
                  <View style={styles.sheetBottomSpace} />
                </ScrollView>

                <Pressable
                  disabled={generating}
                  style={[styles.generateButton, generating && styles.generateButtonDisabled]}
                  onPress={() => void generateSummary()}
                >
                  {generating ? <ActivityIndicator color="#fff" size="small" /> : <Sparkles color="#fff" size={18} />}
                  <Text style={styles.generateButtonText}>
                    {generating ? t.recordings.generatingNotes : t.recordings.generateNow}
                  </Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function stripMarkdown(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1')
    .replace(/^\s*[*+-]\s+/gm, '• ')
    .replace(/`{1,3}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(APP_LANGUAGE === 'en' ? 'en-US' : 'zh-CN');
}

function GenerationModeCard({ active, title, hint, onPress }: { active: boolean; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeCard, active && styles.modeCardActive]} onPress={onPress}>
      <View style={styles.modeCardTitleRow}>
        <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>{title}</Text>
        {active ? <Check color="#fff" size={16} strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.modeCardHint, active && styles.modeCardHintActive]}>{hint}</Text>
    </Pressable>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function summaryTitle(summary: { title: string; templateId: string }) {
  if (summary.templateId === 'adaptive-summary' && summary.title === 'Meeting Notes') return t.recordings.notesTab;
  const template = MEETING_NOTE_TEMPLATES.find((item) => item.id === summary.templateId);
  return template ? templateText(template.title, APP_LANGUAGE) : summary.title;
}

function formatTimestamp(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function speakerColor(speakerId: string) {
  const palette = ['#6d5dfc', '#0f8b8d', '#d1495b', '#a15c00', '#1769aa', '#7b2cbf'];
  let hash = 0;
  for (const character of speakerId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1 },
  headerCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  tabs: { flexDirection: 'row', padding: 4, marginTop: 16, borderRadius: 14, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#fff' },
  summaryTabsRow: { marginTop: 12, marginHorizontal: -2 },
  summaryTabsContent: { gap: 7, paddingHorizontal: 2, paddingVertical: 2 },
  summaryTab: { maxWidth: 180, minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  summaryTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  summaryTabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  summaryTabTextActive: { color: '#fff' },
  addSummaryButton: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  scrollContent: { paddingBottom: 18 },
  resultCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: 14 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  summaryTitleWrap: { flex: 1 },
  summaryMeta: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: -8 },
  inlineAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  inlineAddText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  transcriptionMeta: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: -6, marginBottom: 14 },
  transcriptList: { gap: 18 },
  transcriptSegment: { gap: 7 },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speakerName: { fontSize: 14, fontWeight: '800' },
  segmentTime: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  resultText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  askCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, gap: 10, borderWidth: 1, borderColor: colors.border },
  askTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  askHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.cardSoft,
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  assistantText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  typing: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  composerWrap: { paddingTop: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalKeyboard: { maxHeight: '92%' },
  generatorSheet: { maxHeight: '100%', paddingHorizontal: 18, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 28 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#d5d5d7', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  sheetHeaderText: { flex: 1 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSoft },
  modeGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeCard: { flex: 1, minHeight: 112, padding: 14, borderRadius: 16, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  modeCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeCardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  modeCardTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  modeCardTitleActive: { color: '#fff' },
  modeCardHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8 },
  modeCardHintActive: { color: '#d9d9dc' },
  controlLabel: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 10 },
  categoryRow: { gap: 7, paddingBottom: 13 },
  filterChip: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#fff' },
  templateGrid: { gap: 9, marginBottom: 12 },
  templateCard: { padding: 14, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  templateCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  templateCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  templateName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  templateNameActive: { color: '#fff' },
  templateDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  templateDescriptionActive: { color: '#d9d9dc' },
  customToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, marginBottom: 8 },
  customToggleActive: { opacity: 1 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  customToggleText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  customInputWrap: { marginBottom: 16 },
  customInput: { minHeight: 112, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSoft, color: colors.text, fontSize: 13, lineHeight: 19, textAlignVertical: 'top' },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  speakerControl: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  speakerControlText: { flex: 1 },
  speakerControlTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  speakerControlHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  switchTrack: { width: 45, height: 27, padding: 3, justifyContent: 'center', borderRadius: 14, backgroundColor: '#d6d6d9' },
  switchTrackActive: { backgroundColor: colors.primary },
  switchThumb: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff' },
  switchThumbActive: { alignSelf: 'flex-end' },
  generationError: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 },
  sheetBottomSpace: { height: 18 },
  generateButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.primary },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  emptyCard: { marginTop: 20, padding: 24, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textSecondary, textAlign: 'center' }
});
