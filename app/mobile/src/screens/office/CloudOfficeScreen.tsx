import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { createOfficeDocument, openLocalOfficeFile, saveOfficeDocument, type OfficeKind } from '@/services/officeApi';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

export function CloudOfficeScreen() {
  const navigation = useNavigation();
  const [prompt, setPrompt] = useState(t.office.promptPlaceholder);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function run(kind: OfficeKind) {
    const text = prompt.trim();
    if (!text) {
      setLastResult(t.office.promptRequired);
      return;
    }
    setBusy(true);
    setLastResult(null);
    setLocalUri(null);
    setFileName(null);
    try {
      const result = await createOfficeDocument(text, kind);
      setLastResult(result.url);
      setFileName(result.fileName);
      const uri = await saveOfficeDocument(result);
      setLocalUri(uri);
      setBusy(false);
      await openLocalOfficeFile(uri, result.fileName);
    } catch (error) {
      setLastResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen tone="plain" bottomInset={32}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.text} size={22} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.topTitle}>{t.office.title}</Text>
        <View style={styles.backButton} />
      </View>
      <Text style={styles.pageSubtitle}>{t.office.subtitle}</Text>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{t.office.promptLabel}</Text>
        <TextInput
          style={[styles.input, styles.taskInput]}
          multiline
          textAlignVertical="top"
          placeholder={t.office.promptPlaceholder}
          placeholderTextColor={colors.textTertiary}
          value={prompt}
          onChangeText={setPrompt}
          editable={!busy}
        />
        <Pressable
          style={[styles.primaryButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void run('pdf')}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t.office.makePdf}</Text>}
        </Pressable>
        {busy ? <Text style={styles.copyHint}>{t.office.generating}</Text> : null}
        <Pressable
          style={[styles.secondaryButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void run('pptx')}
        >
          <Text style={styles.secondaryButtonText}>{t.office.makePptx}</Text>
        </Pressable>
      </View>

      {lastResult ? (
        <View style={styles.logCard}>
          <Text style={styles.logTitle}>{t.office.lastResult}</Text>
          <Text style={styles.copyHint}>{t.office.copyHint}</Text>
          <Text style={styles.logBody} selectable>
            {lastResult}
          </Text>
          {localUri && fileName ? (
            <Pressable
              style={[styles.secondaryButton, busy && styles.disabled, styles.openButton]}
              disabled={busy}
              onPress={() => void openLocalOfficeFile(localUri, fileName)}
            >
              <Text style={styles.secondaryButtonText}>{t.office.openLocal}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 14
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12
  },
  fieldLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: colors.text,
    fontSize: 16
  },
  taskInput: {
    minHeight: 88,
    paddingTop: 10
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  logCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  logTitle: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  logBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  copyHint: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 6
  },
  openButton: {
    marginTop: 12
  },
  disabled: { opacity: 0.5 }
});
