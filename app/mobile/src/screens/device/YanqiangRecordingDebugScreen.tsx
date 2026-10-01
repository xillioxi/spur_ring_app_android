import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { ArrowLeft, FileAudio, Pause, Play, RefreshCw, Trash2, UploadCloud } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { AudioAiPanel } from '@/components/AudioAiPanel';
import { clearLocalAudioFiles, deleteLocalAudioFile, isDeletedAudioName, purgeReimportedDeletedAudio } from '@/services/localAudioLibrary';
import {
  YanqiangVoiceEventNames,
  YanqiangVoiceEvents,
  YanqiangVoiceNative,
  type NativeFile,
  type RecordingSummary
} from '@/native/YanqiangVoiceNative';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RootStackParamList } from '@/types/navigation';
import { getRingUiSession } from '@/services/ringConnectionSession';
import { formatRingDisplayName } from '@/utils/ringDisplayName';

type Props = NativeStackScreenProps<RootStackParamList, 'YanqiangRecordingDebug'>;
type SyncPhase = 'idle' | 'starting' | 'receiving' | 'converting' | 'finished' | 'failed';

export function YanqiangRecordingDebugScreen({ navigation, route }: Props) {
  const [summary, setSummary] = useState<RecordingSummary | null>(null);
  const [files, setFiles] = useState<NativeFile[]>([]);
  const [querying, setQuerying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState(t.sync.notSynced);
  const [logs, setLogs] = useState<string[]>([]);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [workingState, setWorkingState] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const syncingRef = useRef(false);

  const pushLog = useCallback((text: string) => {
    console.log('[YanqiangRecordingDebug]', text);
    setLogs((current) => [`${new Date().toLocaleTimeString()} ${text}`, ...current].slice(0, 80));
  }, []);

  const querySummary = useCallback(async () => {
    setQuerying(true);
    try {
      const result = await YanqiangVoiceNative.queryVoiceRecordingSummary();
      setSummary(result);
      setFiles(result.files || []);
      pushLog(
        `summary: code=${String(result.code)} supported=${result.supported} count=${result.fileCount} bytes=${result.totalBytes} local=${result.files?.length ?? 0}`
      );
    } catch (error) {
      pushLog(`summary: FAILED ${errorMessage(error)}`);
    } finally {
      setQuerying(false);
    }
  }, [pushLog]);

  async function syncRecordings() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncPhase('starting');
    setProgress(0);
    setProgressText(t.sync.requesting);
    pushLog('sync: request');
    try {
      const result = await YanqiangVoiceNative.syncVoiceRecordings();
      await purgeReimportedDeletedAudio();
      const visible: NativeFile[] = [];
      for (const file of result.files || []) {
        if (file?.name && (await isDeletedAudioName(file.name))) continue;
        visible.push(file);
      }
      setFiles(visible);
      setSyncPhase('finished');
      setProgress(100);
      setProgressText(t.sync.completed(visible.length));
      pushLog(`sync: resolved local=${visible.length}`);
      await querySummary();
    } catch (error) {
      setSyncPhase('failed');
      setProgressText(errorMessage(error));
      pushLog(`sync: FAILED ${errorMessage(error)}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });
    void querySummary();
    if (!YanqiangVoiceEvents) return;

    const subscriptions = [
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.syncState, (event) => {
        const phase = event?.phase === 'finish' ? 'finished' : 'starting';
        setSyncPhase(phase);
        setProgressText(event?.message || phase);
        pushLog(`sync: ${event?.phase} code=${event?.code} message=${event?.message || ''}`);
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.syncProgress, (event) => {
        setSyncPhase('receiving');
        setProgress(Number(event?.progress || 0));
        setProgressText(
          `${event?.fileName || t.common.file} · ${event?.currentFile || 0}/${event?.totalFiles || 0} · ${event?.progress || 0}%`
        );
        pushLog(
          `sync: progress file=${event?.fileName || ''} index=${event?.currentFile || 0}/${event?.totalFiles || 0} progress=${event?.progress || 0}`
        );
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.fileReady, (event) => {
        setSyncPhase('converting');
        const name = String(event?.name || '');
        void (async () => {
          if (name && (await isDeletedAudioName(name))) {
            await purgeReimportedDeletedAudio();
            pushLog(`save: skipped deleted name=${name}`);
            return;
          }
          setFiles((current) => upsertFile(current, event as NativeFile));
          pushLog(`save: success name=${event?.name} bytes=${event?.size} uri=${event?.uri}`);
        })();
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.error, (event) => {
        setSyncPhase('failed');
        pushLog(`sync: ERROR ${JSON.stringify(event)}`);
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.connection, (event) => {
        if (event?.status === 'disconnected' || event?.status === 'error') {
          setSyncPhase('failed');
          setSyncing(false);
          syncingRef.current = false;
          pushLog(`connection lost: ${JSON.stringify(event)}`);
        }
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.status, (event) => {
        setWorkingState(Number(event?.state));
        pushLog(`workingState: state=${event?.state} status=${event?.status} remaining=${event?.remainingTime}`);
      })
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void sound.unloadAsync();
    };
  }, [pushLog, querySummary]);

  function onPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if (status.error) pushLog(`player: ERROR ${status.error}`);
      return;
    }
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis || 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }

  async function togglePlayback(file: NativeFile) {
    try {
      if (soundRef.current && playingUri === file.uri) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) await soundRef.current.pauseAsync();
        else await soundRef.current.playAsync();
        return;
      }

      if (soundRef.current) await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlayingUri(file.uri);
      setPositionMs(0);
      setDurationMs(0);
      pushLog(`player: loading ${file.name}`);
      const created = await Audio.Sound.createAsync(
        { uri: file.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        onPlaybackStatus
      );
      soundRef.current = created.sound;
      pushLog(`player: playing ${file.name}`);
    } catch (error) {
      setIsPlaying(false);
      pushLog(`player: FAILED ${errorMessage(error)}`);
    }
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingUri(null);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }

  async function removeLocalFile(file: NativeFile) {
    if (playingUri === file.uri) await stopPlayback();
    await deleteLocalAudioFile(file.uri);
    setFiles((current) => current.filter((item) => item.uri !== file.uri));
    pushLog(`local: deleted ${file.name}`);
  }

  async function clearAllLocalFiles() {
    await stopPlayback();
    await clearLocalAudioFiles();
    setFiles([]);
    pushLog('local: deleted all OGG files');
  }

  function confirmDeleteLocalFile(file: NativeFile) {
    Alert.alert(t.sync.deleteOneTitle, file.name, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void removeLocalFile(file) }
    ]);
  }

  function confirmClearLocalFiles() {
    Alert.alert(t.sync.deleteAllTitle, t.sync.deleteAllMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.deleteAll, style: 'destructive', onPress: () => void clearAllLocalFiles() }
    ]);
  }

  const sessionDevice = getRingUiSession().devices[route.params.macAddress];
  const ringLabel = formatRingDisplayName(sessionDevice?.name ?? 'AIZO', route.params.macAddress);

  return (
    <AppScreen tone="plain" bottomInset={50}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft color={colors.text} size={20} />
        <Text style={styles.backText}>{t.sync.back}</Text>
      </Pressable>

      <Text style={styles.title}>{t.sync.title}</Text>
      <Text style={styles.subtitle}>{ringLabel}</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t.sync.ringSummary}</Text>
          <Pressable style={styles.iconButton} disabled={querying || syncing} onPress={querySummary}>
            <RefreshCw color={colors.text} size={18} />
          </Pressable>
        </View>
        <View style={styles.metrics}>
          <Metric label={t.sync.ringFiles} value={String(summary?.fileCount ?? '--')} />
          <Metric label={t.sync.ringData} value={summary ? formatBytes(summary.totalBytes) : '--'} />
          <Metric label={t.sync.localOgg} value={String(files.length)} />
        </View>
        {!!summary?.message && <Text style={styles.detailText}>{summary.message}</Text>}
        <Text style={styles.detailText}>
          {t.sync.workingState}: {workingState === null ? t.sync.waitingState : workingStateLabel(workingState)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.sync.syncStatus}: {phaseLabel(syncPhase)}</Text>
        <Text style={styles.progressText}>{t.sync.autoSyncHint}</Text>
        <Text style={styles.progressText}>{progressText}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
        </View>
        <Pressable
          style={[styles.syncButton, (syncing || querying || !canSyncInWorkingState(workingState)) && styles.disabled]}
          disabled={syncing || querying || !canSyncInWorkingState(workingState)}
          onPress={syncRecordings}
        >
          <UploadCloud color="#fff" size={18} />
          <Text style={styles.syncButtonText}>{syncing ? t.sync.syncing : t.sync.syncAgain}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t.sync.localFiles}</Text>
        <Pressable
          style={[styles.clearLocalButton, files.length === 0 && styles.disabled]}
          disabled={files.length === 0}
          onPress={confirmClearLocalFiles}
        >
          <Trash2 color={colors.danger} size={15} />
          <Text style={styles.clearLocalText}>{t.common.deleteAll}</Text>
        </Pressable>
      </View>
      {files.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>{t.sync.empty}</Text></View>
      ) : files.map((file) => {
        const active = playingUri === file.uri;
        return (
          <View key={file.uri} style={styles.fileCard}>
            <View style={styles.fileIcon}><FileAudio color={colors.text} size={20} /></View>
            <View style={styles.fileContent}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{formatBytes(file.size)} · {formatTimestamp(file.timestamp)}</Text>
              {active && <Text style={styles.playerTime}>{formatTime(positionMs)} / {formatTime(durationMs)}</Text>}
            </View>
            <Pressable style={styles.playButton} onPress={() => togglePlayback(file)}>
              {active && isPlaying ? <Pause color="#fff" size={17} /> : <Play color="#fff" size={17} />}
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => confirmDeleteLocalFile(file)}>
              <Trash2 color={colors.danger} size={17} />
            </Pressable>
            <AudioAiPanel file={file} onLog={pushLog} />
          </View>
        );
      })}

      {__DEV__ ? (
        <>
          <Text style={styles.sectionTitle}>{t.sync.rawLogs}</Text>
          <View style={styles.logBox}>
            {logs.length === 0 ? <Text style={styles.logEmpty}>{t.common.noLogs}</Text> : logs.map((log, index) => (
              <Text key={`${index}-${log}`} style={styles.logLine}>{log}</Text>
            ))}
          </View>
        </>
      ) : null}
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function upsertFile(files: NativeFile[], file: NativeFile) {
  return [file, ...files.filter((current) => current.uri !== file.uri)];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTimestamp(timestamp: number) {
  if (!timestamp || timestamp < 946684800000) return `raw ${timestamp || 0}`;
  return new Date(timestamp).toLocaleString();
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function phaseLabel(phase: SyncPhase) {
  const labels: Record<SyncPhase, string> = {
    idle: t.sync.phase.idle,
    starting: t.sync.phase.starting,
    receiving: t.sync.phase.receiving,
    converting: t.sync.phase.converting,
    finished: t.sync.phase.finished,
    failed: t.sync.phase.failed
  };
  return labels[phase];
}

function workingStateLabel(state: number) {
  if (state === 1) return t.sync.state.idle;
  if (state === 2) return t.sync.state.recording;
  if (state === 3) return t.sync.state.paused;
  if (state === 4) return t.sync.state.ready;
  if (state === 5) return t.sync.state.syncing;
  return t.sync.state.unknown;
}

function canSyncInWorkingState(state: number | null) {
  return state === null || state === 1 || state === 4;
}

const styles = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 5, marginBottom: 15 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  iconButton: { padding: 7, backgroundColor: colors.cardSoft, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metric: { flex: 1, backgroundColor: colors.cardSoft, borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  metricValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  metricLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  detailText: { color: colors.textSecondary, fontSize: 11, marginTop: 10 },
  progressText: { color: colors.textSecondary, fontSize: 12, marginTop: 9 },
  progressTrack: { height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginVertical: 12 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  syncButton: { backgroundColor: colors.primary, borderRadius: 13, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  syncButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  clearLocalButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#3b2429', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  clearLocalText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  fileCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, backgroundColor: colors.card, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  fileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  fileContent: { flex: 1 },
  fileName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  fileMeta: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  playerTime: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 4 },
  playButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3b2429', alignItems: 'center', justifyContent: 'center' },
  logBox: { backgroundColor: colors.card, borderRadius: 16, padding: 13, minHeight: 180, gap: 5, borderWidth: 1, borderColor: colors.border },
  logEmpty: { color: colors.textTertiary },
  logLine: { color: colors.textSecondary, fontSize: 10, lineHeight: 16 }
});
