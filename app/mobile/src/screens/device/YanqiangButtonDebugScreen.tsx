import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Radio, Trash2 } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import {
  YanqiangVoiceEventNames,
  YanqiangVoiceEvents,
  YanqiangVoiceNative
} from '@/native/YanqiangVoiceNative';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'YanqiangButtonDebug'>;

export function YanqiangButtonDebugScreen({ navigation, route }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [workingState, setWorkingState] = useState<number | null>(null);

  const pushLog = useCallback((text: string) => {
    console.log('[YanqiangButtonDebug]', text);
    setLogs((current) => [`${new Date().toLocaleTimeString()} ${text}`, ...current].slice(0, 120));
  }, []);

  const setReport = useCallback(async (enabled: boolean) => {
    try {
      const result = await YanqiangVoiceNative.setTouchEventReporting(enabled);
      setReporting(enabled && result.result === 1);
      pushLog(`reporting: enabled=${enabled} result=${result.result}`);
    } catch (error) {
      setReporting(false);
      pushLog(`reporting: FAILED ${errorMessage(error)}`);
    }
  }, [pushLog]);

  useEffect(() => {
    if (!YanqiangVoiceEvents) return;
    const subscriptions = [
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.touch, (event) => {
        pushLog(`touch: action=${event?.action} code=${event?.event} deviceTime=${event?.timestamp}`);
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.status, (event) => {
        setWorkingState(Number(event?.state));
        pushLog(`state: ${event?.state} ${event?.status} remaining=${event?.remainingTime}`);
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.connection, (event) => {
        pushLog(`connection: ${JSON.stringify(event)}`);
      })
    ];
    void setReport(true);
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [pushLog, setReport]);

  return (
    <AppScreen tone="plain" bottomInset={50}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft color={colors.text} size={20} />
        <Text style={styles.backText}>{t.sync.back}</Text>
      </Pressable>

      <Text style={styles.title}>{t.buttonDebug.title}</Text>
      <Text style={styles.subtitle}>{t.common.device} {route.params.macAddress}</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Radio color={reporting ? colors.success : colors.textTertiary} size={22} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{t.buttonDebug.reporting}: {reporting ? t.buttonDebug.enabled : t.buttonDebug.disabled}</Text>
            <Text style={styles.detail}>{t.buttonDebug.workingState}: {workingState ?? '--'}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={() => void setReport(true)}>
            <Text style={styles.primaryText}>{t.buttonDebug.enable}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void setReport(false)}>
            <Text style={styles.secondaryText}>{t.buttonDebug.disable}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.hintCard}>
        <Text style={styles.hintTitle}>{t.buttonDebug.testOrder}</Text>
        <Text style={styles.hint}>{t.buttonDebug.single}</Text>
        <Text style={styles.hint}>{t.buttonDebug.double}</Text>
        <Text style={styles.hint}>{t.buttonDebug.hold}</Text>
        <Text style={styles.hint}>{t.buttonDebug.observe}</Text>
      </View>

      <View style={styles.logHeader}>
        <Text style={styles.sectionTitle}>{t.buttonDebug.rawEvents}</Text>
        <Pressable style={styles.clearButton} onPress={() => setLogs([])}>
          <Trash2 color={colors.textSecondary} size={16} />
          <Text style={styles.clearText}>{t.common.clear}</Text>
        </Pressable>
      </View>
      <View style={styles.logBox}>
        {logs.length === 0 ? <Text style={styles.logEmpty}>{t.buttonDebug.waiting}</Text> : logs.map((log, index) => (
          <Text key={`${index}-${log}`} style={styles.logLine}>{log}</Text>
        ))}
      </View>
    </AppScreen>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 5, marginBottom: 15 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  detail: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  primaryButton: { flex: 1, backgroundColor: colors.text, borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: colors.card },
  secondaryText: { color: colors.text, fontWeight: '800' },
  hintCard: { backgroundColor: colors.card, borderRadius: 16, padding: 15, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  hintTitle: { color: colors.text, fontWeight: '800', marginBottom: 7 },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  clearText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  logBox: { backgroundColor: colors.card, borderRadius: 16, padding: 13, minHeight: 280, gap: 5, marginTop: 9, borderWidth: 1, borderColor: colors.border },
  logEmpty: { color: colors.textTertiary },
  logLine: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: 'monospace' }
});
