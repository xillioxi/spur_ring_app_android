import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ArrowRight,
  BatteryMedium,
  Bot,
  ChevronRight,
  Mic2,
  RefreshCw,
  Settings2,
  Sparkles
} from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { HomeLeadingActions } from '@/components/HomeLeadingActions';
import { listLocalAudioFiles, type LocalAudioFile } from '@/services/localAudioLibrary';
import { listRecordingAnalyses, type LocalRecordingAnalysis } from '@/services/localRecordingAnalysis';
import { syncLocalAgentCards, type LocalAgentCard } from '@/services/localAgentCards';
import { getRingUiSession } from '@/services/ringConnectionSession';
import { colors } from '@/theme/colors';
import { titleFromMeetingNotes } from '@/utils/meetingNotesTitle';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const [recordings, setRecordings] = useState<LocalAudioFile[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, LocalRecordingAnalysis>>({});
  const [assistants, setAssistants] = useState<LocalAgentCard[]>([]);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    const [audio, savedAnalyses, agentCards] = await Promise.all([
      listLocalAudioFiles(),
      listRecordingAnalyses(),
      syncLocalAgentCards()
    ]);
    setRecordings(audio.filter((file) => file.category === 'recording'));
    setAnalyses(savedAnalyses);
    setAssistants(agentCards);
    setConnected(getRingUiSession().connectionState === 'connected');
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const readyCount = recordings.filter((recording) => analyses[recording.id]?.status === 'completed').length;
  const recent = recordings.slice(0, 3);

  return (
    <AppScreen tone="plain" bottomInset={112}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.wordmark}>SPUR</Text>
          <Text style={styles.greeting}>Your memory, made useful.</Text>
        </View>
        <Pressable style={styles.newUiButton} onPress={() => navigation.navigate('ReferenceUI')}>
          <Text style={styles.newUiText}>New UI</Text>
        </Pressable>
        <HomeLeadingActions />
      </View>

      <Pressable style={styles.hero} onPress={() => navigation.navigate('Sync')}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroHeader}>
          <View style={styles.connectionPill}>
            <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
            <Text style={styles.connectionText}>{connected ? 'Ring connected' : 'Ring ready to connect'}</Text>
          </View>
          <BatteryMedium color="#eef3ff" size={23} strokeWidth={1.7} />
        </View>
        <View style={styles.ringMark}>
          <View style={styles.ringInner} />
          <View style={styles.ringButton} />
        </View>
        <Text style={styles.heroTitle}>{connected ? 'Capture is ready' : 'Connect your Spur Ring'}</Text>
        <Text style={styles.heroText}>Record naturally. Spur syncs, transcribes, and turns it into something useful.</Text>
        <View style={styles.heroAction}>
          <Text style={styles.heroActionText}>Open Sync</Text>
          <ArrowRight color="#08101d" size={16} />
        </View>
      </Pressable>

      <View style={styles.statsRow}>
        <Pressable style={styles.statCard} onPress={() => navigation.navigate('Records')}>
          <Mic2 color="#3f6df6" size={20} />
          <Text style={styles.statNumber}>{recordings.length}</Text>
          <Text style={styles.statLabel}>Recordings</Text>
        </Pressable>
        <Pressable style={styles.statCard} onPress={() => navigation.navigate('Assistants')}>
          <Sparkles color="#9a65f7" size={20} />
          <Text style={styles.statNumber}>{readyCount}</Text>
          <Text style={styles.statLabel}>AI notes ready</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>CONTINUE</Text>
          <Text style={styles.sectionTitle}>Recent recordings</Text>
        </View>
        <Pressable style={styles.seeAll} onPress={() => navigation.navigate('Records')}>
          <Text style={styles.seeAllText}>See all</Text>
          <ChevronRight color={colors.textSecondary} size={16} />
        </Pressable>
      </View>

      <View style={styles.activityCard}>
        {recent.length === 0 ? (
          <View style={styles.emptyState}>
            <Mic2 color={colors.textTertiary} size={25} />
            <View style={styles.flex}>
              <Text style={styles.activityTitle}>No recordings yet</Text>
              <Text style={styles.activityMeta}>Connect the ring and your captures will appear here.</Text>
            </View>
          </View>
        ) : recent.map((recording, index) => {
          const analysis = analyses[recording.id];
          const title = analysis?.status === 'completed'
            ? titleFromMeetingNotes(analysis.meetingNotes, 44)
            : '';
          return (
            <Pressable
              key={recording.id}
              style={[styles.activityRow, index > 0 && styles.activityDivider]}
              onPress={() => analysis?.status === 'completed'
                ? navigation.navigate('RecordingSummary', { id: recording.id })
                : navigation.navigate('Records')}
            >
              <View style={styles.activityIcon}><Mic2 color="#3f6df6" size={18} /></View>
              <View style={styles.flex}>
                <Text style={styles.activityTitle} numberOfLines={1}>{title || friendlyName(recording.name)}</Text>
                <Text style={styles.activityMeta}>{analysis?.status === 'completed' ? 'Transcript and notes ready' : 'Ready to transcribe'}</Text>
              </View>
              <ChevronRight color={colors.textTertiary} size={17} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>AUTOMATE</Text>
          <Text style={styles.sectionTitle}>AI assistants</Text>
        </View>
      </View>
      <Pressable style={styles.assistantCard} onPress={() => navigation.navigate('Assistants')}>
        <View style={styles.assistantIcon}><Bot color="#ffffff" size={22} /></View>
        <View style={styles.flex}>
          <Text style={styles.assistantTitle}>Turn voice into action</Text>
          <Text style={styles.assistantText}>{assistants.length} captures available for ideas, reports, reminders, and documents.</Text>
        </View>
        <Settings2 color="#a8b4cd" size={19} />
      </Pressable>
    </AppScreen>
  );
}

function friendlyName(name: string) {
  return name.replace(/\.(ogg|m4a)$/i, '').replace(/[_-]+/g, ' ');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, marginBottom: 20 },
  newUiButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: '#111827' },
  newUiText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  wordmark: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 3.2 },
  greeting: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  hero: { minHeight: 310, borderRadius: 30, padding: 22, overflow: 'hidden', backgroundColor: '#07111f', marginBottom: 14 },
  heroGlowOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#164e8b', opacity: 0.55, right: -80, top: -90 },
  heroGlowTwo: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#3f265f', opacity: 0.52, left: -80, bottom: -120 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectionPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fc8a42' },
  statusDotConnected: { backgroundColor: '#53d39b' },
  connectionText: { color: '#edf3ff', fontSize: 11, fontWeight: '700' },
  ringMark: { width: 102, height: 102, borderRadius: 51, borderWidth: 13, borderColor: '#e8eff9', alignSelf: 'center', marginTop: 24, marginBottom: 16, transform: [{ rotate: '-18deg' }] },
  ringInner: { position: 'absolute', width: 54, height: 54, borderRadius: 27, top: 11, left: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  ringButton: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff7a28', right: -16, top: -6, borderWidth: 4, borderColor: '#07111f' },
  heroTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroText: { color: '#aebbd0', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 290 },
  heroAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#f4f7fb' },
  heroActionText: { color: '#08101d', fontSize: 12, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: { flex: 1, minHeight: 122, borderRadius: 22, padding: 16, backgroundColor: '#f5f7fb', borderWidth: 1, borderColor: '#e7eaf0' },
  statNumber: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 12 },
  statLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 11 },
  sectionEyebrow: { color: '#7e8da5', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 3 },
  seeAll: { flexDirection: 'row', alignItems: 'center', paddingBottom: 2 },
  seeAllText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  activityCard: { borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, marginBottom: 28 },
  activityRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  activityIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf2ff' },
  activityTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  activityMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  emptyState: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12 },
  assistantCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 22, backgroundColor: '#111827', padding: 17 },
  assistantIcon: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d4cf5' },
  assistantTitle: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  assistantText: { color: '#a8b4cd', fontSize: 11, lineHeight: 16, marginTop: 3 }
});
