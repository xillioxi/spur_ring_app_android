import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, Laptop } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { fetchBuddyStatus, postBuddyTask, type BuddyTaskResult } from '@/services/spurBuddyApi';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

const DEMO_NOTE = 'phone-debug.md';

export function ConnectLaptopScreen() {
  const navigation = useNavigation();
  const [host, setHost] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [workFolder, setWorkFolder] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BuddyTaskResult | null>(null);
  const [instruction, setInstruction] = useState('写一份本周工作纪要大纲');

  async function run(action: () => Promise<void>, markOfflineOnError = true) {
    setBusy(true);
    setLastResult(null);
    try {
      await action();
    } catch (error) {
      if (markOfflineOnError) setOnline(false);
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
        <Text style={styles.topTitle}>{t.laptop.title}</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.pageSubtitle}>{t.laptop.subtitle}</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Laptop color={online ? colors.success : colors.text} size={18} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>{online ? t.laptop.online : t.laptop.offline}</Text>
          <Text style={styles.statusText}>{workFolder ?? t.laptop.offlineHint}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{t.laptop.hostLabel}</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          placeholder="192.168.1.12"
          placeholderTextColor={colors.textTertiary}
          value={host}
          onChangeText={setHost}
        />
        <Text style={styles.fieldLabel}>{t.laptop.pairingLabel}</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={colors.textTertiary}
          value={pairingCode}
          onChangeText={setPairingCode}
        />
        <Pressable
          style={[styles.primaryButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const status = await fetchBuddyStatus(host, pairingCode);
              setOnline(true);
              setWorkFolder(status.workFolder);
              setPendingDelete(null);
              setLastResult(t.laptop.connectedOk);
            })
          }
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t.laptop.connect}</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t.laptop.sendTask}</Text>
        <Text style={styles.hint}>{t.laptop.sendTaskHint}</Text>
        <TextInput
          style={[styles.input, styles.taskInput]}
          multiline
          textAlignVertical="top"
          placeholder={t.laptop.taskPlaceholder}
          placeholderTextColor={colors.textTertiary}
          value={instruction}
          onChangeText={setInstruction}
          editable={!busy}
        />
        <Pressable
          style={[styles.primaryButton, (busy || !online) && styles.disabled]}
          disabled={busy || !online}
          onPress={() =>
            void run(async () => {
              const text = instruction.trim();
              if (!text) {
                throw new Error(t.laptop.taskRequired);
              }
              const result = await postBuddyTask(host, pairingCode, {
                type: 'instruct',
                title: text,
                payload: { content: text }
              });
              const files = result.artifacts?.length ? `\n${result.artifacts.join('\n')}` : '';
              const preview = result.preview ? `\n${result.preview}` : '';
              setLastResult(`${result.status}: ${result.message}${files}${preview}`);
            }, false)
          }
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{t.laptop.sendTaskAction}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t.laptop.debugTasks}</Text>
        <Pressable
          style={[styles.rowButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const result = await postBuddyTask(host, pairingCode, {
                type: 'write_note',
                title: 'Phone debug note',
                payload: {
                  filename: DEMO_NOTE,
                  content: '# Phone debug\n\nWritten from Spur App Connect to laptop.\n'
                }
              });
              setLastResult(`${result.status}: ${result.message}`);
            }, false)
          }
        >
          <Text style={styles.rowButtonText}>{t.laptop.writeNote}</Text>
        </Pressable>
        <Pressable
          style={[styles.rowButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const result = await postBuddyTask(host, pairingCode, {
                type: 'list_files',
                title: 'List sandbox'
              });
              setLastResult(`${result.status}: ${result.message}\n${result.preview ?? ''}`);
            }, false)
          }
        >
          <Text style={styles.rowButtonText}>{t.laptop.listFiles}</Text>
        </Pressable>
        <Pressable
          style={[styles.rowButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const result = await postBuddyTask(host, pairingCode, {
                type: 'delete',
                title: 'Delete debug note',
                confirmed: false,
                payload: { path: DEMO_NOTE, filename: DEMO_NOTE }
              });
              setPendingDelete(result.status === 'needs_confirm' ? result : null);
              setLastResult(`${result.status}: ${result.message}`);
            }, false)
          }
        >
          <Text style={styles.rowButtonText}>{t.laptop.deleteUnconfirmed}</Text>
        </Pressable>
        {pendingDelete ? (
          <Pressable
            style={[styles.confirmButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const result = await postBuddyTask(host, pairingCode, {
                  id: pendingDelete.id,
                  type: 'delete',
                  title: 'Delete debug note',
                  confirmed: true,
                  payload: { path: DEMO_NOTE, filename: DEMO_NOTE }
                });
                setPendingDelete(null);
                setLastResult(`${result.status}: ${result.message}`);
              }, false)
            }
          >
            <Text style={styles.confirmButtonText}>{t.laptop.confirmDelete}</Text>
          </Pressable>
        ) : null}
      </View>

      {lastResult ? (
        <View style={styles.logCard}>
          <Text style={styles.logTitle}>{t.laptop.lastResult}</Text>
          <Text style={styles.logBody}>{lastResult}</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  statusTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3
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
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  rowButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  rowButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  confirmButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800'
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
  disabled: { opacity: 0.5 }
});
