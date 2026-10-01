import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AppState, BackHandler, DeviceEventEmitter, Image, Modal, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import {
  ArrowLeft, ArrowRight, BatteryMedium,
  ChevronRight, FileText, Heart, Home, Menu, Mic2, Pause, PenLine,
  Play, Plus, Search, Settings2, Share2, Sparkles, Trash2, X
} from 'lucide-react-native';

import { deleteLocalAudioFile, listLocalAudioFiles, preparePlayback, type LocalAudioFile } from '@/services/localAudioLibrary';
import { AgentSkillPanel } from '@/components/AgentSkillPanel';
import { deleteRecordingAnalysis, listRecordingAnalyses, processLocalRecording, type LocalRecordingAnalysis } from '@/services/localRecordingAnalysis';
import { deleteAgentCard, processAgentCard, syncLocalAgentCards, toggleAgentCardFavorite, type LocalAgentCard } from '@/services/localAgentCards';
import { cancelOfficeJob, inferOfficeKind, OFFICE_JOB_EVENT, openCardOffice, startOfficeJob } from '@/services/officeJob';
import { getRingUiSession } from '@/services/ringConnectionSession';
import { titleFromMeetingNotes } from '@/utils/meetingNotesTitle';
import { createLocalProject, deleteLocalProject, listLocalProjects, removeNoteFromProjects, setProjectNote, type LocalProject } from '@/services/localProjects';

type Tab = 'home' | 'notes' | 'processes';
type Selected = { kind: 'note'; id: string } | { kind: 'process'; id: string } | { kind: 'project'; id: string } | null;
type NoteFilter = 'All' | 'Ready' | 'To process';
type ProcessFilter = 'In progress' | 'Finished';

const ink = '#f4f5f4';
const muted = '#a0a7a8';
const panel = '#222628';
const orange = '#ffad12';
const mint = '#59c78a';
const violet = '#b438e8';
const red = '#ed5260';
const hero = require('../../assets/ui-v2/ring-hero-new.png');

export function RingAppScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<Selected>(null);
  const [files, setFiles] = useState<LocalAudioFile[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, LocalRecordingAnalysis>>({});
  const [cards, setCards] = useState<LocalAgentCard[]>([]);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [projectModal, setProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectPicker, setProjectPicker] = useState(false);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('All');
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('In progress');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [audio, saved, agents, localProjects] = await Promise.all([
        listLocalAudioFiles(), listRecordingAnalyses(), syncLocalAgentCards(), listLocalProjects()
      ]);
      setFiles(audio.filter((item) => item.category === 'recording'));
      setAnalyses(saved);
      setCards(agents);
      setProjects(localProjects);
      setConnected(getRingUiSession().connectionState === 'connected');
    } catch (error) {
      console.warn('[ring-ui] unable to load local content', error);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15000);
    const appSub = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); appSub.remove(); };
  }, [refresh]));
  useEffect(() => {
    const officeSub = DeviceEventEmitter.addListener(OFFICE_JOB_EVENT, (updated: LocalAgentCard) => {
      setCards((current) => current.map((card) => card.id === updated.id ? updated : card));
    });
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (projectModal) { setProjectModal(false); return true; }
      if (projectPicker) { setProjectPicker(false); return true; }
      if (menuOpen) { setMenuOpen(false); return true; }
      if (selected) { setSelected(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => { officeSub.remove(); backSub.remove(); };
  }, [menuOpen, projectModal, projectPicker, selected, tab]);
  useEffect(() => () => { if (soundRef.current) void soundRef.current.unloadAsync(); }, []);

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
  const openProject = (project: LocalProject) => setSelected({ kind: 'project', id: project.id });
  const addProject = async () => {
    try {
      const saved = await createLocalProject(projectName);
      setProjects(saved);
      setProjectName('');
      setProjectModal(false);
      setSelected({ kind: 'project', id: saved[0].id });
    } catch (error) { Alert.alert('Could not create project', error instanceof Error ? error.message : String(error)); }
  };
  const toggleProjectNote = async (projectId: string, noteId: string, included: boolean) => {
    try { setProjects(await setProjectNote(projectId, noteId, included)); }
    catch (error) { Alert.alert('Could not update project', String(error)); }
  };
  const removeProject = (project: LocalProject) => Alert.alert('Delete project?', 'The notes in this project will remain available in Recent notes.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void (async () => { setProjects(await deleteLocalProject(project.id)); setSelected(null); })() }
  ]);
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
  const togglePlayback = async (uri: string) => {
    try {
      await preparePlayback();
      if (soundRef.current && playingUri === uri) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) await soundRef.current.pauseAsync();
        else await soundRef.current.playAsync();
        return;
      }
      if (soundRef.current) await soundRef.current.unloadAsync();
      const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setIsPlaying(status.isPlaying);
        if (status.didJustFinish) { setPlayingUri(null); setIsPlaying(false); }
      });
      soundRef.current = created.sound;
      setPlayingUri(uri);
      setIsPlaying(true);
    } catch (error) {
      Alert.alert('Playback unavailable', error instanceof Error ? error.message : String(error));
    }
  };
  const removeNote = (file: LocalAudioFile) => Alert.alert('Delete recording?', 'This removes the audio and its notes from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
      if (playingUri === file.uri && soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; setPlayingUri(null); }
      await deleteLocalAudioFile(file.uri);
      await deleteRecordingAnalysis(file.id);
      setProjects(await removeNoteFromProjects(file.id));
      setSelected(null);
      await refresh();
    })() }
  ]);
  const removeCard = (card: LocalAgentCard) => Alert.alert('Delete capture?', 'This removes the capture and its process from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
      if (playingUri === card.fileUri && soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; setPlayingUri(null); }
      await deleteAgentCard(card);
      setSelected(null);
      await refresh();
    })() }
  ]);
  const favoriteCard = async (card: LocalAgentCard) => {
    const updated = await toggleAgentCardFavorite(card);
    setCards((current) => current.map((item) => item.id === updated.id ? updated : item));
  };
  const processAll = async () => {
    if (busy) return;
    for (const card of cards.filter((item) => item.status === 'pending' || item.status === 'failed')) {
      await processCard(card);
    }
    await refresh();
  };
  const shareSelected = async () => {
    const message = currentNote
      ? [noteTitle(currentNote, currentAnalysis), currentAnalysis?.meetingNotes, currentAnalysis?.transcript].filter(Boolean).join('\n\n')
      : [currentCard?.title, currentCard?.output, currentCard?.transcript].filter(Boolean).join('\n\n');
    if (message) await Share.share({ message });
  };
  const changeTab = (next: Tab) => {
    setSelected(null);
    setTab(next);
    setQuery('');
    setSearching(false);
    if (next === 'processes') setProcessFilter(finishedProcesses.length ? 'Finished' : 'In progress');
  };
  const currentNote = selected?.kind === 'note' ? files.find((file) => file.id === selected.id) : undefined;
  const currentAnalysis = currentNote ? analyses[currentNote.id] : undefined;
  const currentCard = selected?.kind === 'process' ? cards.find((card) => card.id === selected.id) : undefined;
  const currentProject = selected?.kind === 'project' ? projects.find((project) => project.id === selected.id) : undefined;

  return (
    <View style={s.root}>
      <StatusBar style="light" backgroundColor="#050909" />
      {selected ? (
        <ScrollView contentContainerStyle={s.detailContent}>
          <View style={s.detailTop}>
            <Pressable onPress={() => setSelected(null)} accessibilityLabel="Back"><ArrowLeft size={20} color={ink} /></Pressable>
            <Text style={s.detailTopTitle} numberOfLines={1}>{currentNote ? noteTitle(currentNote, currentAnalysis) : currentProject?.title || currentCard?.title || 'Process'}</Text>
            {!currentProject && <Pressable onPress={() => void shareSelected()} accessibilityLabel="Share capture"><Share2 size={18} color={ink} /></Pressable>}
          </View>
          {currentProject ? <>
            <View style={s.projectDetailHeader}>
              <Text style={s.detailSectionTitle}>{currentProject.noteIds.length} {currentProject.noteIds.length === 1 ? 'note' : 'notes'}</Text>
              <Text style={s.hint}>Created {dateLabel(currentProject.createdAt)}</Text>
            </View>
            <Pressable style={s.primaryAction} onPress={() => setProjectPicker(true)} accessibilityLabel="Add notes to project"><Plus color="#121818" size={17} /><Text style={s.primaryActionText}>Add notes</Text></Pressable>
            <View style={s.listPanel}>
              {currentProject.noteIds.length ? currentProject.noteIds.map((id) => {
                const file = files.find((item) => item.id === id);
                return file ? <Pressable key={id} style={s.listRow} onPress={() => openNote(file)}><FileText color={orange} size={20} /><View style={s.grow}><Text style={s.rowTitle}>{noteTitle(file, analyses[id])}</Text><Text style={s.rowSub}>{dateLabel(file.modifiedAt)}</Text></View><ChevronRight color={muted} size={16} /></Pressable> : null;
              }) : <Text style={s.emptyText}>No notes yet. Add recordings to organize them here.</Text>}
            </View>
            <Pressable style={[s.utilityAction, s.deleteProject]} onPress={() => removeProject(currentProject)}><Trash2 color={red} size={17} /><Text style={s.utilityText}>Delete project</Text></Pressable>
          </> : <View style={s.overviewCard}>
            <Text style={s.overviewTitle}>Overview</Text>
            <Text style={s.overviewText}>
              {currentAnalysis?.meetingNotes || currentCard?.summary || currentCard?.output || 'This capture is ready for processing.'}
            </Text>
          </View>}
          {currentNote ? (
            <>
              <View style={s.sectionRow}><Text style={s.detailSectionTitle}>Capture</Text><Text style={s.hint}>{dateLabel(currentNote.modifiedAt)}</Text></View>
              <View style={s.detailActions}>
                <Pressable style={s.utilityAction} onPress={() => void togglePlayback(currentNote.uri)}>
                  {playingUri === currentNote.uri && isPlaying ? <Pause color={ink} size={17} /> : <Play color={ink} size={17} />}
                  <Text style={s.utilityText}>{playingUri === currentNote.uri && isPlaying ? 'Pause audio' : 'Play audio'}</Text>
                </Pressable>
                <Pressable style={s.utilityAction} onPress={() => removeNote(currentNote)}><Trash2 color={red} size={17} /><Text style={s.utilityText}>Delete</Text></Pressable>
              </View>
              <Pressable style={s.projectMembership} onPress={() => setProjectPicker(true)}><Plus color={mint} size={17} /><Text style={s.utilityText}>Projects</Text><Text style={s.rowSub}>{projects.filter((project) => project.noteIds.includes(currentNote.id)).map((project) => project.title).join(', ') || 'Add to a project'}</Text><ChevronRight color={muted} size={16} /></Pressable>
              {currentAnalysis?.status !== 'completed' && <Pressable disabled={busy} style={s.primaryAction} onPress={() => void processNote(currentNote)}><Sparkles color="#121818" size={16} /><Text style={s.primaryActionText}>{busy ? 'Processing…' : 'Process recording'}</Text></Pressable>}
              {currentAnalysis?.status === 'completed' && <>
              <Pressable style={s.detailEntry} onPress={() => navigation.navigate('RecordingSummary', { id: currentNote.id })}>
                <View style={s.entryAccent} /><View style={s.grow}><Text style={s.entryTitle}>Notes and AI tools</Text><Text style={s.entryCaption}>Summaries, templates and questions</Text></View><ChevronRight size={17} color={muted} />
              </Pressable>
              <Pressable style={s.detailEntry} onPress={() => navigation.navigate('RecordingSummary', { id: currentNote.id, tab: 'transcript' })}>
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
              {currentCard.error ? <Text style={s.errorText}>{currentCard.error}</Text> : null}
              <View style={s.detailActions}>
                <Pressable style={s.utilityAction} onPress={() => void togglePlayback(currentCard.fileUri)}>
                  {playingUri === currentCard.fileUri && isPlaying ? <Pause color={ink} size={17} /> : <Play color={ink} size={17} />}
                  <Text style={s.utilityText}>{playingUri === currentCard.fileUri && isPlaying ? 'Pause audio' : 'Play audio'}</Text>
                </Pressable>
                <Pressable style={s.utilityAction} onPress={() => void favoriteCard(currentCard)}><Heart color={red} fill={currentCard.favorite ? red : 'transparent'} size={17} /><Text style={s.utilityText}>{currentCard.favorite ? 'Saved' : 'Save'}</Text></Pressable>
                <Pressable style={s.utilityAction} onPress={() => removeCard(currentCard)}><Trash2 color={red} size={17} /><Text style={s.utilityText}>Delete</Text></Pressable>
              </View>
              {currentCard.imageUrl ? <Image source={{ uri: currentCard.imageUrl }} style={s.generatedImage} resizeMode="contain" /> : null}
              {currentCard.transcript ? <View style={s.transcriptCard}><Text style={s.overviewTitle}>Transcript</Text><Text style={s.overviewText}>{currentCard.transcript}</Text></View> : null}
              {currentCard.office?.status === 'ready' ? <Pressable style={s.detailEntry} onPress={() => void openCardOffice(currentCard).catch((error) => Alert.alert('Open document', String(error)))}><View style={[s.entryAccent, { backgroundColor: mint }]} /><View style={s.grow}><Text style={s.entryTitle}>Open {currentCard.office.kind === 'pptx' ? 'presentation' : 'PDF'}</Text><Text style={s.entryCaption}>{currentCard.office.fileName || 'Saved document'}</Text></View><ChevronRight size={17} color={muted} /></Pressable> : null}
              {currentCard.office?.status === 'generating' ? <Pressable style={s.detailEntry} onPress={() => void cancelOfficeJob(currentCard.id)}><View style={[s.entryAccent, { backgroundColor: orange }]} /><View style={s.grow}><Text style={s.entryTitle}>Creating {currentCard.office.kind === 'pptx' ? 'presentation' : 'PDF'}…</Text><Text style={s.entryCaption}>Tap to cancel</Text></View><X size={17} color={muted} /></Pressable> : null}
              {currentCard.office?.status === 'failed' ? <Pressable style={s.detailEntry} onPress={() => void startOfficeJob(currentCard, currentCard.office!.kind, currentCard.office!.prompt || currentCard.transcript || currentCard.output || '')}><View style={[s.entryAccent, { backgroundColor: red }]} /><View style={s.grow}><Text style={s.entryTitle}>Retry document</Text><Text style={s.entryCaption}>{currentCard.office.error || 'Document generation failed'}</Text></View><ChevronRight size={17} color={muted} /></Pressable> : null}
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
                <View style={s.hero}>
                  <Image source={hero} resizeMode="stretch" style={[s.heroImage, { width: screenWidth, height: screenWidth * 2102 / 1173 }]} />
                  <View style={s.heroShade} />
                  <View style={s.heroTop}>
                    <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="Open menu"><Menu color={ink} size={23} /></Pressable>
                    <Pressable onPress={() => navigation.navigate('Sync')} style={s.battery}>
                      <BatteryMedium color={orange} size={25} />
                      <Text style={s.batteryText}>{connected ? 'Connected' : 'Connect ring'}</Text>
                    </Pressable>
                  </View>
                </View>
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
                  <Pressable style={s.quickAction} onPress={() => changeTab('notes')}><PenLine color={ink} size={18} /><Text style={s.quickText}>Recording tools</Text></Pressable>
                  <Pressable style={s.quickAction} onPress={() => navigation.navigate('Me')}><Settings2 color={ink} size={18} /><Text style={s.quickText}>Settings</Text></Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={s.header}>
                  {searching ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={`Search ${tab}`} placeholderTextColor={muted} style={s.searchInput} /> : <Text style={s.pageTitle}>{tab === 'notes' ? 'Notes' : 'Processes'}</Text>}
                   {tab === 'notes' && <Pressable onPress={() => setProjectModal(true)} accessibilityLabel="Add project"><Plus color={ink} size={22} /></Pressable>}
                  <Pressable onPress={() => { setSearching(!searching); setQuery(''); }} accessibilityLabel="Search"><Search color={ink} size={21} /></Pressable>
                </View>
                {tab === 'notes' ? (
                  <>
                    <Text style={s.sectionTitle}>Recent projects</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.projectStrip} contentContainerStyle={s.projectStripContent}>
                      {projects.length ? projects.map((project, index) => (
                        <Pressable key={project.id} style={s.projectItem} onPress={() => openProject(project)}>
                          {index % 2 ? <Sparkles color={muted} size={29} strokeWidth={1.1} /> : <FileText color={muted} size={29} strokeWidth={1.1} />}
                          <Text style={s.projectTitle} numberOfLines={2}>{project.title}</Text>
                          <View style={s.projectRule} /><Text style={[s.projectStatus, { color: mint }]}>{project.noteIds.length} {project.noteIds.length === 1 ? 'note' : 'notes'}</Text>
                        </Pressable>
                      )) : <Text style={s.emptyText}>Create a project to group related notes.</Text>}
                    </ScrollView>
                    <View style={s.sectionRow}><Text style={s.sectionTitle}>Recent notes</Text><Pressable onPress={() => setNoteFilter('All')} accessibilityLabel="Show all notes"><ArrowRight color={muted} size={18} /></Pressable></View>
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
                    <Pressable style={s.processAction} disabled={busy || !cards.some((card) => card.status === 'pending' || card.status === 'failed')} onPress={() => void processAll()}><Plus color={ink} size={18} /><Text style={s.quickText}>{busy ? 'Processing…' : 'Process all pending captures'}</Text><ChevronRight color={muted} size={16} /></Pressable>
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
      {currentCard ? <AgentSkillPanel card={currentCard} onApplied={(updated) => {
        setCards((current) => current.map((card) => card.id === updated.id ? updated : card));
      }} /> : null}
      <Modal transparent visible={projectModal} animationType="fade" onRequestClose={() => setProjectModal(false)}>
        <View style={s.dialogBackdrop}>
          <View style={s.dialogPanel}>
            <View style={s.menuHeader}><Text style={s.menuTitle}>New project</Text><Pressable onPress={() => setProjectModal(false)} accessibilityLabel="Close"><X color={ink} size={20} /></Pressable></View>
            <Text style={s.dialogHelp}>Group related notes in one project.</Text>
            <TextInput autoFocus value={projectName} onChangeText={setProjectName} placeholder="Project name" placeholderTextColor={muted} style={s.dialogInput} maxLength={80} returnKeyType="done" onSubmitEditing={() => void addProject()} />
            <Pressable style={s.dialogButton} onPress={() => void addProject()}><Text style={s.dialogButtonText}>Create project</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={projectPicker} animationType="slide" onRequestClose={() => setProjectPicker(false)}>
        <View style={s.dialogBackdrop}>
          <View style={s.dialogPanel}>
            <View style={s.menuHeader}><Text style={s.menuTitle}>{currentProject ? 'Add notes' : 'Add to projects'}</Text><Pressable onPress={() => setProjectPicker(false)} accessibilityLabel="Done"><X color={ink} size={20} /></Pressable></View>
            <ScrollView style={s.pickerList}>
              {currentProject ? (files.length ? files.map((file) => <Pressable key={file.id} style={s.pickerRow} onPress={() => void toggleProjectNote(currentProject.id, file.id, !currentProject.noteIds.includes(file.id))}><Text style={s.pickerText} numberOfLines={2}>{noteTitle(file, analyses[file.id])}</Text><Text style={s.pickerCheck}>{currentProject.noteIds.includes(file.id) ? '✓' : '+'}</Text></Pressable>) : <Text style={s.emptyText}>Sync your ring to add recordings.</Text>)
                : currentNote ? (projects.length ? projects.map((project) => <Pressable key={project.id} style={s.pickerRow} onPress={() => void toggleProjectNote(project.id, currentNote.id, !project.noteIds.includes(currentNote.id))}><Text style={s.pickerText} numberOfLines={2}>{project.title}</Text><Text style={s.pickerCheck}>{project.noteIds.includes(currentNote.id) ? '✓' : '+'}</Text></Pressable>) : <Text style={s.emptyText}>Create a project from the Notes page first.</Text>) : null}
            </ScrollView>
            <Pressable style={s.dialogButton} onPress={() => setProjectPicker(false)}><Text style={s.dialogButtonText}>Done</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={s.menuPanel}>
            <View style={s.menuHeader}><Text style={s.menuTitle}>Spur Ring</Text><Pressable onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu"><X color={ink} size={20} /></Pressable></View>
            <Pressable style={s.menuRow} onPress={() => { setMenuOpen(false); changeTab('home'); }}><Home color={ink} size={18} /><Text style={s.menuText}>Home</Text></Pressable>
            <Pressable style={s.menuRow} onPress={() => { setMenuOpen(false); changeTab('notes'); }}><PenLine color={ink} size={18} /><Text style={s.menuText}>Notes and recordings</Text></Pressable>
            <Pressable style={s.menuRow} onPress={() => { setMenuOpen(false); changeTab('processes'); }}><Settings2 color={ink} size={18} /><Text style={s.menuText}>Processes</Text></Pressable>
            <Pressable style={s.menuRow} onPress={() => { setMenuOpen(false); navigation.navigate('Sync'); }}><Mic2 color={ink} size={18} /><Text style={s.menuText}>Ring sync</Text></Pressable>
            <Pressable style={s.menuRow} onPress={() => { setMenuOpen(false); navigation.navigate('Me'); }}><Settings2 color={ink} size={18} /><Text style={s.menuText}>Settings</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
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
  pageContent: { paddingHorizontal: 22, paddingTop: 42, paddingBottom: 30 },
  hero: { height: 390, borderRadius: 3, overflow: 'hidden', marginHorizontal: -22, marginTop: -42 },
  heroImage: { position: 'absolute', top: -50, left: 0 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,15,0.12)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingTop: 50 },
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
  projectStrip: { backgroundColor: panel, borderRadius: 18, minHeight: 111, marginBottom: 27 }, projectStripContent: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, minHeight: 111 }, projectItem: { width: 101, alignItems: 'center', justifyContent: 'center' }, projectTitle: { color: ink, fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 5, minHeight: 22 }, projectRule: { height: 3, width: '65%', backgroundColor: '#8b9292', borderRadius: 2, marginTop: 6 }, projectStatus: { fontSize: 8, marginTop: 5, fontWeight: '700' },
  listPanel: { backgroundColor: panel, borderRadius: 18, padding: 15, minHeight: 310 }, filterRow: { flexDirection: 'row', gap: 8, marginBottom: 17 },
  chip: { borderWidth: 1, borderColor: '#777d7d', paddingHorizontal: 13, paddingVertical: 5, borderRadius: 99 }, chipSelected: { backgroundColor: '#e3e5e4', borderColor: '#e3e5e4' }, chipText: { color: '#c7caca', fontSize: 9, fontWeight: '700' }, chipTextSelected: { color: '#101415' },
  dateHeading: { color: ink, fontSize: 10, fontWeight: '800', marginTop: 3, marginBottom: 7 }, listRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }, colorBar: { width: 2, height: 17, borderRadius: 1, marginRight: 25 },
  processAction: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 16, backgroundColor: panel, borderRadius: 16, marginTop: 13 },
  navBar: { height: 73, backgroundColor: '#050909', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9 }, navItem: { width: 72, alignItems: 'center', gap: 3 }, navLabel: { color: muted, fontSize: 9 }, navLabelActive: { color: ink }, navDot: { width: 4, height: 4, backgroundColor: red, borderRadius: 2, position: 'absolute', top: -1, right: 24 },
  detailContent: { paddingHorizontal: 22, paddingTop: 21, paddingBottom: 40 }, detailTop: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 12 }, detailTopTitle: { color: ink, fontSize: 13, fontWeight: '700', flex: 1 },
  overviewCard: { backgroundColor: panel, borderRadius: 18, padding: 18, marginTop: 15, marginBottom: 25, maxHeight: 180 }, overviewTitle: { color: ink, fontSize: 13, fontWeight: '700', marginBottom: 9 }, overviewText: { color: '#d0d4d3', fontSize: 10, lineHeight: 15 },
  detailSectionTitle: { color: ink, fontSize: 13, fontWeight: '700', marginBottom: 12 }, hint: { color: muted, fontSize: 9 }, detailEntry: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 6, paddingHorizontal: 10 }, entryAccent: { width: 3, height: 23, backgroundColor: orange }, entryTitle: { color: ink, fontSize: 11, fontWeight: '700' }, entryCaption: { color: muted, fontSize: 9, marginTop: 5 },
  sequenceCard: { backgroundColor: panel, borderRadius: 18, paddingHorizontal: 17, paddingTop: 20, paddingBottom: 4 }, sequenceRow: { flexDirection: 'row', gap: 16, minHeight: 78, alignItems: 'flex-start' }, timeline: { alignItems: 'center', width: 13, height: 78 }, timelineDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 }, timelineLine: { flex: 1, width: 2, backgroundColor: '#d4d7d7', marginTop: 3 },
  primaryAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 99, backgroundColor: '#e8eceb', paddingHorizontal: 17, paddingVertical: 11, marginBottom: 17 }, primaryActionText: { color: '#121818', fontWeight: '800', fontSize: 11 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 },
  utilityAction: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: panel, paddingHorizontal: 11, paddingVertical: 10 },
  utilityText: { color: ink, fontSize: 10, fontWeight: '700' },
  projectDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  projectMembership: { backgroundColor: panel, borderRadius: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, marginBottom: 18 },
  deleteProject: { alignSelf: 'flex-start', marginTop: 22 },
  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'center', paddingHorizontal: 22 },
  dialogPanel: { backgroundColor: panel, borderRadius: 20, padding: 21, maxHeight: '75%' },
  dialogHelp: { color: muted, fontSize: 12, marginBottom: 18 },
  dialogInput: { color: ink, backgroundColor: '#121718', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 17 },
  dialogButton: { backgroundColor: '#e3e5e4', borderRadius: 12, alignItems: 'center', padding: 13, marginTop: 8 },
  dialogButtonText: { color: '#101415', fontWeight: '800', fontSize: 13 },
  pickerList: { maxHeight: 380 }, pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#404647' }, pickerText: { color: ink, fontSize: 13, flex: 1 }, pickerCheck: { color: mint, fontSize: 18, fontWeight: '800' },
  generatedImage: { width: '100%', height: 230, borderRadius: 16, backgroundColor: panel, marginBottom: 18 },
  errorText: { color: red, fontSize: 11, marginBottom: 12 },
  transcriptCard: { backgroundColor: panel, borderRadius: 18, padding: 18, marginBottom: 25 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-start' },
  menuPanel: { width: '78%', height: '100%', backgroundColor: '#151a1b', paddingHorizontal: 20, paddingTop: 54 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  menuTitle: { color: ink, fontSize: 20, fontWeight: '800' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 55, borderBottomWidth: 1, borderBottomColor: '#303637' },
  menuText: { color: ink, fontSize: 13, fontWeight: '600' }
});
