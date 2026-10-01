import { useCallback, useMemo, useState } from 'react';
import {
  Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, ArrowRight, BatteryMedium,
  ChevronRight, FileText, Grid2X2, Home, Menu, Mic2, PenLine,
  Plus, Search, Settings2, Share2, Sparkles
} from 'lucide-react-native';

import { listLocalAudioFiles, type LocalAudioFile } from '@/services/localAudioLibrary';
import { listRecordingAnalyses, processLocalRecording, type LocalRecordingAnalysis } from '@/services/localRecordingAnalysis';
import { processAgentCard, syncLocalAgentCards, type LocalAgentCard } from '@/services/localAgentCards';
import { inferOfficeKind, startOfficeJob } from '@/services/officeJob';
import { getRingUiSession } from '@/services/ringConnectionSession';
import { titleFromMeetingNotes } from '@/utils/meetingNotesTitle';

type Tab = 'home' | 'notes' | 'processes';
type Selected = { kind: 'note'; id: string } | { kind: 'process'; id: string } | null;
type NoteFilter = 'All' | 'Ready' | 'To process';
type ProcessFilter = 'In progress' | 'Finished';

const ink = '#f4f5f4';
const muted = '#a0a7a8';
const panel = '#222628';
const orange = '#ffad12';
const mint = '#59c78a';
const violet = '#b438e8';
const red = '#ed5260';
const hero = require('../../assets/ui-v2/ring-hero.webp');

export function ReferenceUI() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<Selected>(null);
  const [files, setFiles] = useState<LocalAudioFile[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, LocalRecordingAnalysis>>({});
  const [cards, setCards] = useState<LocalAgentCard[]>([]);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('All');
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('In progress');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [audio, saved, agents] = await Promise.all([
        listLocalAudioFiles(), listRecordingAnalyses(), syncLocalAgentCards()
      ]);
      setFiles(audio.filter((item) => item.category === 'recording'));
      setAnalyses(saved);
      setCards(agents);
      setConnected(getRingUiSession().connectionState === 'connected');
    } catch (error) {
      console.warn('[reference-ui] unable to load local content', error);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const readyNotes = files.filter((file) => analyses[file.id]?.status === 'completed');
  const finishedProcesses = cards.filter((card) => card.status === 'completed');
  const shownNotes = useMemo(() => files.filter((file) => {
    const ready = analyses[file.id]?.status === 'completed';
    if (noteFilter === 'Ready' && !ready) return false;
    if (noteFilter === 'To process' && ready) return false;
    return noteTitle(file, analyses[file.id]).toLowerCase().includes(query.toLowerCase());
  }), [files, analyses, noteFilter, query]);
  const shownProcesses = cards.filter((card) => {
    const match = processFilter === 'Finished' ? card.status === 'completed' : card.status !== 'completed';
    return match && card.title.toLowerCase().includes(query.toLowerCase());
  });

  const openNote = (file: LocalAudioFile) => setSelected({ kind: 'note', id: file.id });
  const openProcess = (card: LocalAgentCard) => setSelected({ kind: 'process', id: card.id });
  const processNote = async (file: LocalAudioFile) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await processLocalRecording(file);
      setAnalyses((current) => ({ ...current, [file.id]: result }));
    } catch (error) {
      Alert.alert('Could not process recording', error instanceof Error ? error.message : String(error));
      await refresh();
    } finally { setBusy(false); }
  };
  const processCard = async (card: LocalAgentCard) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await processAgentCard(card);
      setCards((current) => current.map((item) => item.id === result.id ? result : item));
      const kind = inferOfficeKind(result.transcript || '');
      if (kind) void startOfficeJob(result, kind, [result.transcript, result.output].filter(Boolean).join('\n\n'));
    } catch (error) {
      Alert.alert('Could not process capture', error instanceof Error ? error.message : String(error));
      await refresh();
    } finally { setBusy(false); }
  };
  const changeTab = (next: Tab) => { setSelected(null); setTab(next); setQuery(''); setSearching(false); };
  const currentNote = selected?.kind === 'note' ? files.find((file) => file.id === selected.id) : undefined;
  const currentAnalysis = currentNote ? analyses[currentNote.id] : undefined;
  const currentCard = selected?.kind === 'process' ? cards.find((card) => card.id === selected.id) : undefined;

  return (
    <View style={s.root}>
      <StatusBar style="light" backgroundColor="#050909" />
      {selected ? (
        <ScrollView contentContainerStyle={s.detailContent}>
          <View style={s.detailTop}>
            <Pressable onPress={() => setSelected(null)} accessibilityLabel="Back"><ArrowLeft size={20} color={ink} /></Pressable>
            <Text style={s.detailTopTitle} numberOfLines={1}>{currentNote ? noteTitle(currentNote, currentAnalysis) : currentCard?.title || 'Process'}</Text>
            <Pressable onPress={() => currentNote
              ? navigation.navigate('RecordingSummary', { id: currentNote.id })
              : navigation.navigate('MainTabs', { screen: 'Assistants' })} accessibilityLabel="Open full tools">
              <Share2 size={18} color={ink} />
            </Pressable>
          </View>
          <View style={s.overviewCard}>
            <Text style={s.overviewTitle}>Overview</Text>
            <Text style={s.overviewText}>
              {currentAnalysis?.meetingNotes || currentCard?.summary || currentCard?.output || 'This capture is ready for processing.'}
            </Text>
          </View>
          {currentNote ? (
            <>
              <View style={s.sectionRow}><Text style={s.detailSectionTitle}>Capture</Text><Text style={s.hint}>{dateLabel(currentNote.modifiedAt)}</Text></View>
              {currentAnalysis?.status !== 'completed' && <Pressable disabled={busy} style={s.primaryAction} onPress={() => void processNote(currentNote)}><Sparkles color="#121818" size={16} /><Text style={s.primaryActionText}>{busy ? 'Processing…' : 'Process recording'}</Text></Pressable>}
              {currentAnalysis?.status === 'completed' && <>
              <Pressable style={s.detailEntry} onPress={() => navigation.navigate('RecordingSummary', { id: currentNote.id })}>
                <View style={s.entryAccent} /><View style={s.grow}><Text style={s.entryTitle}>Notes and AI tools</Text><Text style={s.entryCaption}>Summaries, templates and questions</Text></View><ChevronRight size={17} color={muted} />
              </Pressable>
              <Pressable style={s.detailEntry} onPress={() => navigation.navigate('Transcript', { id: currentNote.id })}>
                <View style={[s.entryAccent, { backgroundColor: violet }]} /><View style={s.grow}><Text style={s.entryTitle}>Transcript</Text><Text style={s.entryCaption} numberOfLines={1}>{currentAnalysis.transcript || 'Open transcript'}</Text></View><ChevronRight size={17} color={muted} />
              </Pressable>
              </>}
              <Text style={s.detailSectionTitle}>Sequence</Text>
              <View style={s.sequenceCard}>
                <SequenceStep color={orange} title="Captured" description={dateLabel(currentNote.modifiedAt)} />
                {currentAnalysis?.status === 'completed' ? <><SequenceStep color={mint} title="Transcribed" description={currentAnalysis.transcriptionProvider || 'Audio to text'} /><SequenceStep color={mint} title="Notes ready" description="Open the full tools to generate more" last /></> : <SequenceStep color={orange} title="Ready to process" description="Generate transcript and notes" last />}
              </View>
            </>
          ) : currentCard ? (
            <>
              <View style={s.sectionRow}><Text style={s.detailSectionTitle}>Process</Text><Text style={s.hint}>{statusLabel(currentCard.status)}</Text></View>
              {(currentCard.status === 'pending' || currentCard.status === 'failed') && <Pressable disabled={busy} style={s.primaryAction} onPress={() => void processCard(currentCard)}><Sparkles color="#121818" size={16} /><Text style={s.primaryActionText}>{busy ? 'Processing…' : 'Process capture'}</Text></Pressable>}
              <Pressable style={s.detailEntry} onPress={() => navigation.navigate('MainTabs', { screen: 'Assistants' })}>
                <View style={[s.entryAccent, { backgroundColor: processColor(currentCard.status) }]} /><View style={s.grow}><Text style={s.entryTitle}>Open assistant process</Text><Text style={s.entryCaption}>Process, edit, play or export this capture</Text></View><ChevronRight size={17} color={muted} />
              </Pressable>
              <Text style={s.detailSectionTitle}>Sequence</Text>
              <View style={s.sequenceCard}>
                <SequenceStep color={orange} title="Captured" description={dateLabel(currentCard.modifiedAt)} />
                <SequenceStep color={processColor(currentCard.status)} title={statusLabel(currentCard.status)} description={currentCard.category} last />
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.pageContent}>
            {tab === 'home' ? (
              <>
                <ImageBackground source={hero} resizeMode="cover" style={s.hero} imageStyle={s.heroImage}>
                  <View style={s.heroShade} />
                  <View style={s.heroTop}>
                    <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Switch to original UI"><Menu color={ink} size={23} /></Pressable>
                    <Pressable onPress={() => navigation.navigate('Sync')} style={s.battery}>
                      <BatteryMedium color={orange} size={25} />
                      <Text style={s.batteryText}>{connected ? 'Connected' : 'Connect ring'}</Text>
                    </Pressable>
                  </View>
                </ImageBackground>
                <View style={s.statsRow}>
                  <Pressable style={[s.statCard, s.statMint]} onPress={() => changeTab('notes')}>
                    <Text style={s.statNumber}>{readyNotes.length}</Text><Text style={s.statText}>Recently updated{ '\n' }notes</Text><ArrowRight color={mint} size={17} style={s.statArrow} />
                  </Pressable>
                  <Pressable style={[s.statCard, s.statRose]} onPress={() => changeTab('processes')}>
                    <Text style={s.statNumber}>{finishedProcesses.length}</Text><Text style={s.statText}>Finished{ '\n' }processes</Text><ArrowRight color={red} size={17} style={s.statArrow} />
                  </Pressable>
                </View>
                <View style={s.homePanel}>
                  <View style={s.sectionRow}><Text style={s.sectionTitle}>Recent captures</Text><Pressable onPress={() => changeTab('notes')}><ArrowRight color={ink} size={17} /></Pressable></View>
                  {files.length ? files.slice(0, 3).map((file) => (
                    <Pressable key={file.id} style={s.homeRow} onPress={() => openNote(file)}>
                      <FileText color={muted} size={27} strokeWidth={1.2} />
                      <View style={s.grow}><Text style={s.rowTitle} numberOfLines={1}>{noteTitle(file, analyses[file.id])}</Text><Text style={[s.rowSub, { color: analyses[file.id]?.status === 'completed' ? mint : orange }]}>{analyses[file.id]?.status === 'completed' ? 'Notes ready' : 'Ready to process'}</Text></View>
                      <ChevronRight color={muted} size={16} />
                    </Pressable>
                  )) : <Text style={s.emptyText}>Connect your ring to see captures here.</Text>}
                </View>
                <View style={s.quickActions}>
                  <Pressable style={s.quickAction} onPress={() => navigation.navigate('Sync')}><Mic2 color={ink} size={18} /><Text style={s.quickText}>Sync ring</Text></Pressable>
                  <Pressable style={s.quickAction} onPress={() => navigation.navigate('MainTabs', { screen: 'Records' })}><PenLine color={ink} size={18} /><Text style={s.quickText}>Recording tools</Text></Pressable>
                  <Pressable style={s.quickAction} onPress={() => navigation.navigate('Me')}><Settings2 color={ink} size={18} /><Text style={s.quickText}>Settings</Text></Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={s.header}>
                  {searching ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={`Search ${tab}`} placeholderTextColor={muted} style={s.searchInput} /> : <Text style={s.pageTitle}>{tab === 'notes' ? 'Notes' : 'Processes'}</Text>}
                  <Pressable onPress={() => tab === 'notes' ? navigation.navigate('MainTabs', { screen: 'Records' }) : navigation.navigate('MainTabs', { screen: 'Assistants' })} accessibilityLabel="Open all tools"><Grid2X2 color={ink} size={19} /></Pressable>
                  <Pressable onPress={() => { setSearching(!searching); setQuery(''); }} accessibilityLabel="Search"><Search color={ink} size={21} /></Pressable>
                </View>
                {tab === 'notes' ? (
                  <>
                    <Text style={s.sectionTitle}>Recent projects</Text>
                    <View style={s.projectStrip}>
                      {files.length ? files.slice(0, 3).map((file, index) => (
                        <Pressable key={file.id} style={s.projectItem} onPress={() => openNote(file)}>
                          {index % 2 ? <Sparkles color={muted} size={29} strokeWidth={1.1} /> : <FileText color={muted} size={29} strokeWidth={1.1} />}
                          <Text style={s.projectTitle} numberOfLines={2}>{noteTitle(file, analyses[file.id])}</Text>
                          <View style={s.projectRule} /><Text style={[s.projectStatus, { color: analyses[file.id]?.status === 'completed' ? mint : orange }]}>{analyses[file.id]?.status === 'completed' ? 'Ready to view' : 'To process'}</Text>
                        </Pressable>
                      )) : <Text style={s.emptyText}>Your recent captures will appear here.</Text>}
                    </View>
                    <View style={s.sectionRow}><Text style={s.sectionTitle}>Recent notes</Text><Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Records' })}><ArrowRight color={muted} size={18} /></Pressable></View>
                    <View style={s.listPanel}>
                      <View style={s.filterRow}>{(['All', 'Ready', 'To process'] as NoteFilter[]).map((filter) => <Chip key={filter} label={filter} selected={noteFilter === filter} onPress={() => setNoteFilter(filter)} />)}</View>
                      {shownNotes.length ? shownNotes.map((file, index) => <View key={file.id}>
                        {(index === 0 || dayKey(file.modifiedAt) !== dayKey(shownNotes[index - 1].modifiedAt)) && <Text style={s.dateHeading}>{dateLabel(file.modifiedAt)}</Text>}
                        <Pressable style={s.listRow} onPress={() => openNote(file)}><View style={[s.colorBar, { backgroundColor: [orange, violet, red, mint][index % 4] }]} /><View style={s.grow}><Text style={s.rowTitle} numberOfLines={1}>{noteTitle(file, analyses[file.id])}</Text><Text style={s.rowSub}>{analyses[file.id]?.status === 'completed' ? 'Summary and transcript available' : 'Tap to process recording'}</Text></View><ChevronRight color={muted} size={16} /></Pressable>
                      </View>) : <Text style={s.emptyText}>No notes match this view.</Text>}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.sectionTitle}>Processes</Text>
                    <View style={s.listPanel}>
                      <View style={s.filterRow}><Chip label="In progress" selected={processFilter === 'In progress'} onPress={() => setProcessFilter('In progress')} /><Chip label="Finished" selected={processFilter === 'Finished'} onPress={() => setProcessFilter('Finished')} /></View>
                      {shownProcesses.length ? shownProcesses.map((card) => <Pressable key={card.id} style={s.listRow} onPress={() => openProcess(card)}><View style={[s.colorBar, { backgroundColor: processColor(card.status) }]} /><View style={s.grow}><Text style={s.rowTitle} numberOfLines={1}>{card.title}</Text><Text style={[s.rowSub, { color: processColor(card.status) }]}>{statusLabel(card.status)} · {card.category}</Text></View><ChevronRight color={muted} size={16} /></Pressable>) : <Text style={s.emptyText}>No processes in this view.</Text>}
                    </View>
                    <Pressable style={s.processAction} onPress={() => navigation.navigate('MainTabs', { screen: 'Assistants' })}><Plus color={ink} size={18} /><Text style={s.quickText}>Open assistant tools</Text><ChevronRight color={muted} size={16} /></Pressable>
                  </>
                )}
              </>
            )}
          </ScrollView>
          <View style={s.navBar}>
            <NavItem icon={<Home color={tab === 'home' ? ink : muted} size={20} />} label="Home" active={tab === 'home'} onPress={() => changeTab('home')} />
            <NavItem icon={<PenLine color={tab === 'notes' ? ink : muted} size={20} />} label="Notes" active={tab === 'notes'} onPress={() => changeTab('notes')} />
            <NavItem icon={<Settings2 color={tab === 'processes' ? ink : muted} size={20} />} label="Processes" active={tab === 'processes'} onPress={() => changeTab('processes')} />
          </View>
        </>
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.chip, selected && s.chipSelected]}><Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text></Pressable>;
}
function NavItem({ icon, label, active, onPress }: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.navItem}>{icon}<Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>{active && <View style={s.navDot} />}</Pressable>;
}
function SequenceStep({ color, title, description, last }: { color: string; title: string; description: string; last?: boolean }) {
  return <View style={s.sequenceRow}><View style={s.timeline}><View style={[s.timelineDot, { backgroundColor: color }]} />{!last && <View style={s.timelineLine} />}</View><View style={s.grow}><Text style={s.entryTitle}>{title}</Text><Text style={s.entryCaption}>{description}</Text></View><ChevronRight color={muted} size={15} /></View>;
}
function noteTitle(file: LocalAudioFile, analysis?: LocalRecordingAnalysis) {
  return (analysis?.status === 'completed' && titleFromMeetingNotes(analysis.meetingNotes, 45)) || file.name.replace(/\.(ogg|m4a)$/i, '').replace(/[_-]+/g, ' ');
}
function processColor(status: LocalAgentCard['status']) { return status === 'completed' ? mint : status === 'failed' ? red : status === 'processing' ? violet : orange; }
function statusLabel(status: LocalAgentCard['status']) { return status === 'completed' ? 'Finished' : status === 'failed' ? 'Needs retry' : status === 'processing' ? 'In progress' : 'Ready to process'; }
function dayKey(value: number) { return new Date(value).toDateString(); }
function dateLabel(value: number) { return new Date(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }); }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050909' },
  pageContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30 },
  hero: { height: 390, borderRadius: 3, overflow: 'hidden', marginHorizontal: -22, marginTop: -18 },
  heroImage: { opacity: 0.84 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,15,0.22)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 26 },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 45 }, batteryText: { color: ink, fontSize: 17, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: -53, marginBottom: 11 },
  statCard: { flex: 1, height: 72, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, overflow: 'hidden' },
  statMint: { backgroundColor: 'rgba(33,47,45,0.93)' }, statRose: { backgroundColor: 'rgba(50,40,45,0.94)' },
  statNumber: { color: ink, fontSize: 27, fontWeight: '800' }, statText: { color: '#c8cccd', fontSize: 11, lineHeight: 15, marginTop: 4 }, statArrow: { position: 'absolute', right: 12, bottom: 10 },
  homePanel: { backgroundColor: panel, borderRadius: 18, padding: 17 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: ink, fontSize: 13, fontWeight: '700', marginBottom: 10 }, homeRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 11 },
  grow: { flex: 1 }, rowTitle: { color: ink, fontSize: 12, fontWeight: '700' }, rowSub: { color: muted, fontSize: 9, marginTop: 4 },
  emptyText: { color: muted, fontSize: 11, lineHeight: 17, paddingVertical: 22 },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 13 }, quickAction: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#151a1b', padding: 12, borderRadius: 12 }, quickText: { color: ink, fontSize: 10, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 17, minHeight: 52, marginBottom: 22 }, pageTitle: { color: ink, fontSize: 21, fontWeight: '800', flex: 1 }, searchInput: { flex: 1, color: ink, borderBottomWidth: 1, borderBottomColor: '#777', padding: 4 },
  projectStrip: { flexDirection: 'row', gap: 9, backgroundColor: panel, borderRadius: 18, padding: 13, minHeight: 111, marginBottom: 27 }, projectItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 }, projectTitle: { color: ink, fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 5, minHeight: 22 }, projectRule: { height: 3, width: '65%', backgroundColor: '#8b9292', borderRadius: 2, marginTop: 6 }, projectStatus: { fontSize: 8, marginTop: 5, fontWeight: '700' },
  listPanel: { backgroundColor: panel, borderRadius: 18, padding: 15, minHeight: 310 }, filterRow: { flexDirection: 'row', gap: 8, marginBottom: 17 },
  chip: { borderWidth: 1, borderColor: '#777d7d', paddingHorizontal: 13, paddingVertical: 5, borderRadius: 99 }, chipSelected: { backgroundColor: '#e3e5e4', borderColor: '#e3e5e4' }, chipText: { color: '#c7caca', fontSize: 9, fontWeight: '700' }, chipTextSelected: { color: '#101415' },
  dateHeading: { color: ink, fontSize: 10, fontWeight: '800', marginTop: 3, marginBottom: 7 }, listRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }, colorBar: { width: 2, height: 17, borderRadius: 1, marginRight: 25 },
  processAction: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 16, backgroundColor: panel, borderRadius: 16, marginTop: 13 },
  navBar: { height: 73, backgroundColor: '#050909', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9 }, navItem: { width: 72, alignItems: 'center', gap: 3 }, navLabel: { color: muted, fontSize: 9 }, navLabelActive: { color: ink }, navDot: { width: 4, height: 4, backgroundColor: red, borderRadius: 2, position: 'absolute', top: -1, right: 24 },
  detailContent: { paddingHorizontal: 22, paddingTop: 21, paddingBottom: 40 }, detailTop: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 12 }, detailTopTitle: { color: ink, fontSize: 13, fontWeight: '700', flex: 1 },
  overviewCard: { backgroundColor: panel, borderRadius: 18, padding: 18, marginTop: 15, marginBottom: 25, maxHeight: 180 }, overviewTitle: { color: ink, fontSize: 13, fontWeight: '700', marginBottom: 9 }, overviewText: { color: '#d0d4d3', fontSize: 10, lineHeight: 15 },
  detailSectionTitle: { color: ink, fontSize: 13, fontWeight: '700', marginBottom: 12 }, hint: { color: muted, fontSize: 9 }, detailEntry: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 6, paddingHorizontal: 10 }, entryAccent: { width: 3, height: 23, backgroundColor: orange }, entryTitle: { color: ink, fontSize: 11, fontWeight: '700' }, entryCaption: { color: muted, fontSize: 9, marginTop: 5 },
  sequenceCard: { backgroundColor: panel, borderRadius: 18, paddingHorizontal: 17, paddingTop: 20, paddingBottom: 4 }, sequenceRow: { flexDirection: 'row', gap: 16, minHeight: 78, alignItems: 'flex-start' }, timeline: { alignItems: 'center', width: 13, height: 78 }, timelineDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 }, timelineLine: { flex: 1, width: 2, backgroundColor: '#d4d7d7', marginTop: 3 },
  primaryAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 99, backgroundColor: '#e8eceb', paddingHorizontal: 17, paddingVertical: 11, marginBottom: 17 }, primaryActionText: { color: '#121818', fontWeight: '800', fontSize: 11 }
});
