import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, Sparkles } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { AssistantModeSwitch } from '@/components/AssistantModeSwitch';
import { ChatComposer } from '@/components/ChatComposer';
import { DeviceEntryButton } from '@/components/DeviceEntryButton';
import { LoadingState } from '@/components/LoadingState';
import { recordingApi } from '@/services/api/recordingService';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { AssistantMessage, AssistantPrompt } from '@/types';

export function AssistantChatScreen() {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<AssistantPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    recordingApi
      .listAssistantPrompts()
      .then(setPrompts)
      .catch(() => setPrompts([]))
      .finally(() => setPromptsLoading(false));
  }, []);

  function handleSubmit(query: string) {
    const userMessage = createUserMessage(query);
    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    recordingApi
      .askAssistant(query)
      .then((nextMessages) => {
        const assistantMessage = nextMessages.find((message) => message.role === 'assistant');
        if (assistantMessage) setMessages((current) => [...current, assistantMessage]);
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        setMessages((current) => [...current, createAssistantErrorMessage(detail)]);
      })
      .finally(() => {
        setLoading(false);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      });
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <AppScreen tone="soft" scroll={false} bottomInset={16}>
        <View style={styles.deviceEntry}><DeviceEntryButton /></View>
        <AssistantModeSwitch
          value="model"
          onChange={(value) => {
            if (value === 'agent') navigation.goBack();
          }}
        />
        <View style={[styles.card, isEmpty && styles.cardEmpty]}>
          {isEmpty ? (
            <EmptyState prompts={prompts} loading={promptsLoading} onSubmit={handleSubmit} />
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.thread}
                contentContainerStyle={styles.threadContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((message) =>
                  message.role === 'user' ? <UserBubble key={message.id} text={message.text} /> : <AssistantBubble key={message.id} message={message} />
                )}
                {loading && <Text style={styles.typing}>{t.assistant.working}</Text>}
              </ScrollView>
              <ChatComposer onSubmit={handleSubmit} />
            </>
          )}
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function EmptyState({
  prompts,
  loading,
  onSubmit
}: {
  prompts: AssistantPrompt[];
  loading: boolean;
  onSubmit: (value: string) => void;
}) {
  return (
    <>
      <View style={styles.emptyContent}>
        <View style={styles.botMark}>
          <Bot color={colors.primary} size={34} />
          <Sparkles color={colors.primary} size={15} fill={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{t.assistant.greeting}</Text>
        <Text style={styles.emptyDesc}>{t.assistant.description}</Text>
        <Text style={styles.promptLabel}>{t.assistant.suggestions}</Text>
        {loading ? (
          <LoadingState label={t.assistant.loadingPrompts} />
        ) : (
          <View style={styles.promptRow}>
            {prompts.map((prompt) => (
              <Pressable key={prompt.id} style={styles.promptButton} onPress={() => onSubmit(prompt.query)}>
                <Text style={styles.promptButtonText}>{prompt.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ChatComposer onSubmit={onSubmit} />
    </>
  );
}

function createUserMessage(text: string): AssistantMessage {
  return { id: `user-${Date.now()}`, role: 'user', text };
}

function createAssistantErrorMessage(detail?: string): AssistantMessage {
  return {
    id: `assistant-error-${Date.now()}`,
    role: 'assistant',
    text: detail ? `${t.assistant.requestFailed}\n${detail}` : t.assistant.requestFailed
  };
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{text}</Text>
    </View>
  );
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
  return (
    <View style={styles.assistantBubble}>
      <Text style={styles.assistantText}>{stripMarkdown(message.text)}</Text>
      {message.relatedRecords?.map((record) => (
        <View style={styles.relatedRecord} key={record.title}>
          <Text style={styles.relatedTitle}>{record.title}</Text>
          {record.bullets.map((bullet) => (
            <Text style={styles.relatedBullet} key={bullet}>
              • {bullet}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1')
    .replace(/^\s*[*+-]\s+/gm, '• ')
    .replace(/`{1,3}/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  deviceEntry: {
    alignItems: 'flex-start',
    marginBottom: 12
  },
  card: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: colors.cardSoft,
    padding: 14
  },
  cardEmpty: {
    justifyContent: 'space-between'
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 46
  },
  botMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  },
  emptyDesc: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10
  },
  promptLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 24,
    marginBottom: 10
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8
  },
  promptButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  promptButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  thread: {
    flex: 1
  },
  threadContent: {
    gap: 12,
    paddingBottom: 14
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    padding: 14,
    backgroundColor: colors.card
  },
  assistantText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23
  },
  relatedRecord: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 10
  },
  relatedTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: 5
  },
  relatedBullet: {
    color: colors.textSecondary,
    lineHeight: 20
  },
  typing: {
    color: colors.textTertiary,
    fontSize: 13
  }
});
