import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen } from '@/components/AppScreen';
import { ChatComposer } from '@/components/ChatComposer';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { recordingApi } from '@/services/api/recordingService';
import { getRecordingAnalysis, type LocalRecordingAnalysis } from '@/services/localRecordingAnalysis';
import { colors } from '@/theme/colors';
import { t, APP_LANGUAGE } from '@/locales';
import { titleFromMeetingNotes } from '@/utils/meetingNotesTitle';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordingSummary'>;
type ResultTab = 'transcript' | 'notes';

type NoteChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export function LocalRecordingResultScreen({ route }: Props) {
  const [record, setRecord] = useState<LocalRecordingAnalysis | null | undefined>(undefined);
  const [tab, setTab] = useState<ResultTab>('notes');
  const [messages, setMessages] = useState<NoteChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getRecordingAnalysis(route.params.id).then(setRecord);
  }, [route.params.id]);

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
        meetingNotes: record.meetingNotes
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
                  <Text style={styles.resultText}>{record.transcript || t.recordings.resultUnavailable}</Text>
                </View>
              </ScrollView>
            ) : (
              <>
                <ScrollView
                  ref={scrollRef}
                  style={styles.flex}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.resultCard}>
                    <Text style={styles.sectionTitle}>{t.recordings.notesTab}</Text>
                    <Text style={styles.resultText}>
                      {stripMarkdown(record.meetingNotes || '') || t.recordings.resultUnavailable}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1 },
  headerCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  tabs: { flexDirection: 'row', padding: 4, marginTop: 16, borderRadius: 14, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: colors.text },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#fff' },
  scrollContent: { paddingBottom: 18 },
  resultCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: 14 },
  resultText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  askCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, gap: 10, borderWidth: 1, borderColor: colors.border },
  askTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  askHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: colors.text,
    borderRadius: 16,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: '#f3f3f3',
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
  emptyCard: { marginTop: 20, padding: 24, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textSecondary, textAlign: 'center' }
});
