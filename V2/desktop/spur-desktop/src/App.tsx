import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { AppState, AudioSource, Settings, SpurAPI } from './types';
import { Icon } from './components/Icons';
import type { IconName } from './components/Icons';
import { Waveform } from './components/Waveform';
import { textGap } from './transcript-text';
import { AssistantPage, idleRingButton, type AssistantMode } from './CodexPage';
import { insertsAtCursor } from './dictation-destination';

type Page = 'dictation' | 'recordings' | 'settings' | 'codex' | 'claude';
type SaveSettings = Parameters<SpurAPI['saveSettings']>[0];
type Action = (name: string, operation: () => Promise<void>, success?: string) => Promise<boolean>;

const CONNECTION_LABELS = { disconnected: 'Not connected', connecting: 'Connecting', authenticating: 'Authenticating', connected: 'Connected', syncing: 'Syncing' };

function reconnectPhase(state: AppState) {
  if (state.rememberedRing && !state.syncRetryAddress
      && state.connection !== 'connected' && state.connection !== 'syncing') {
    return state.autoReconnect;
  }
}

function connectionLabel(state: AppState) {
  if (state.disconnecting) return 'Disconnecting';
  const phase = reconnectPhase(state);
  if (state.syncRetryAddress || phase === 'connecting') return 'Reconnecting';
  if (phase === 'waiting') return 'Waiting for ring';
  if (state.rememberedRing && state.autoReconnectError && state.connection === 'disconnected') return 'Reconnect paused';
  return CONNECTION_LABELS[state.connection];
}
function ringLabel(state: AppState, address?: string) {
  return address ? state.ringLabels?.[address.toUpperCase()] : undefined;
}
const LANGUAGES = [{ value: 'auto', label: 'Auto-detect language' }, { value: 'en', label: 'English' }, { value: 'zh', label: 'Chinese' }, { value: 'ja', label: 'Japanese' }, { value: 'ko', label: 'Korean' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' }, { value: 'de', label: 'German' }, { value: 'pt', label: 'Portuguese' }, { value: 'hi', label: 'Hindi' }];
const SOURCE_OPTIONS: { value: AudioSource; icon: IconName; title: string; description: string }[] = [
  { value: 'ring', icon: 'ring', title: 'Ring control', description: 'Your ring controls the computer microphone.' },
  { value: 'microphone', icon: 'mic', title: 'Computer mic', description: 'Start live dictation with a shortcut.' },
  { value: 'ring-recording', icon: 'ring', title: 'Ring microphone', description: 'Use the microphone built into your ring.' },
];

function sizeLabel(bytes: number) { return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
function dateLabel(timestamp: number) {
  const date = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function IconButton({ icon, label, onClick, disabled = false, className = '' }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon name={icon} size={18} /></button>;
}
function StatusPill({ children, connected = false, subtle = false }: { children: ReactNode; connected?: boolean; subtle?: boolean }) {
  return <span className={`status-pill${connected ? ' connected' : ''}${subtle ? ' subtle' : ''}`}><span className="status-dot" />{children}</span>;
}
function KeyboardShortcut({ shortcut = 'Ctrl+Shift+Space' }: { shortcut?: string }) {
  return <span className="keyboard-shortcut" aria-label={shortcut}>{shortcut.split('+').map((key) => <kbd key={key}>{key}</kbd>)}</span>;
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<Page>('dictation');
  const [modes, setModes] = useState<Record<'claude' | 'codex', AssistantMode>>({ claude: 'project', codex: 'project' });
  function openDraft(provider: 'claude' | 'codex') {
    setModes(current => ({ ...current, [provider]: 'embedded' }));
    setPage(provider);
  }
  const [fatal, setFatal] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingAction, setPending] = useState<string | null>(null);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const disconnectGeneration = useRef(0);
  const pending = disconnectPending || state?.disconnecting ? 'disconnect' : pendingAction;
  const [activity, setActivity] = useState(false);

  useEffect(() => {
    const api = window.spur;
    if (!api) {
      setFatal('The desktop connection is unavailable. Open Spur from its desktop application to connect your ring and use dictation.');
      return;
    }
    let alive = true;
    let receivedUpdate = false;
    const unsubscribe = api.onState((next) => {
      receivedUpdate = true;
      if (alive) setState(next);
    });
    api.getState().then((next) => { if (alive && !receivedUpdate) setState(next); }).catch((reason: unknown) => {
      if (alive) setFatal(reason instanceof Error ? reason.message : 'Spur could not read the desktop application state.');
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const run: Action = async (name, operation, success) => {
    const disconnect = name === 'disconnect';
    const usesRing = (action: string | null) => action === 'scan' || action === 'sync' || Boolean(action?.startsWith('connect-'))
      || (state?.settings.source !== 'microphone' && (action === 'start-dictation' || action === 'stop-dictation' || action === 'ring-button'));
    if (disconnect) {
      disconnectGeneration.current++;
      setDisconnectPending(true);
      setPending(current => usesRing(current) ? null : current);
    } else setPending(name);
    const generation = disconnectGeneration.current;
    const superseded = () => generation !== disconnectGeneration.current && (disconnect || usesRing(name));
    setError('');
    try {
      await operation();
      if (superseded()) return false;
      if (success) setNotice(success);
      return true;
    } catch (reason) {
      if (superseded()) return false;
      const message = reason instanceof Error ? reason.message : 'Something went wrong. Please try again.';
      setError(message.replace(/^Error invoking remote method 'spur:command': (?:Error: )?/, ''));
      return false;
    } finally {
      if (!superseded()) {
        if (disconnect) setDisconnectPending(false);
        else setPending(current => current === name ? null : current);
      }
    }
  };

  const api = window.spur;
  const connected = state?.connection === 'connected' || state?.connection === 'syncing';
  const savedRing = state?.rememberedRing;
  const sidebarName = state && ringLabel(state, connected ? state.ringAddress : savedRing?.id)
    || (connected ? state?.ringName || 'Spur Ring' : savedRing?.name || 'Your ring');
  const disabled = Boolean(pending || state?.busy);

  return <div className={`desktop-shell${state?.platform === 'macos' ? ' is-macos' : ''}`}>
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="#dictation" onClick={(event) => { event.preventDefault(); setPage('dictation'); }} aria-label="Spur home"><span className="brand-symbol"><Icon name="brand" size={26} /></span><span>spur<span className="brand-period">.</span></span></a>
      <div className="sidebar-caption">A LITTLE MORE FLOW</div>
      <nav className="nav-items">
        {([{ id: 'dictation', icon: 'mic', label: 'Dictation' }, { id: 'codex', icon: 'speech', label: 'Codex' }, { id: 'claude', icon: 'speech', label: 'Claude' }, { id: 'recordings', icon: 'library', label: 'Recordings' }, { id: 'settings', icon: 'settings', label: 'Settings' }] as const).map((item) => <button key={item.id} type="button" className={`nav-item${page === item.id ? ' active' : ''}`} onClick={() => setPage(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.id === 'recordings' && state?.recordings.length ? <span className="nav-count">{state.recordings.length}</span> : null}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="tiny-spark">✦</span><p>Less friction.<br /><strong>More you.</strong></p></div>
        <button type="button" className="sidebar-device" onClick={() => setPage('dictation')}><span className={`device-glyph${connected ? ' online' : ''}`}><Icon name="ring" size={21} /></span><span><strong title={sidebarName}>{sidebarName}</strong><small><span className={`inline-dot${connected ? ' online' : ''}`} />{state ? connectionLabel(state) : 'Waiting for desktop'}</small></span><Icon name="chevron" size={15} /></button>
        <span className="version">SPUR DESKTOP <span>{state ? `v${state.version}` : ''}</span></span>
      </div>
    </aside>

    <div className="app-body">
      <div className="titlebar"><span><span className="titlebar-dot" />Your space to think</span><div className="window-controls"><button type="button" aria-label="Minimize window" onClick={() => api && void api.minimize()} disabled={!api}><Icon name="minus" size={15} /></button><button type="button" aria-label="Close window" title={state?.platform === 'windows' ? 'Close to system tray' : 'Close window'} onClick={() => api && void api.close()} disabled={!api}><Icon name="close" size={15} /></button></div></div>
      <main className="main-content" id="main-content">
        <header className="page-header"><div><div className="eyebrow">{page === 'codex' || page === 'claude' ? 'FROM VOICE TO ACTION' : page === 'dictation' ? 'YOUR VOICE, IN FLOW' : page === 'recordings' ? 'KEEP THE GOOD THOUGHTS' : 'MAKE YOURSELF AT HOME'}</div><h1>{page === 'claude' ? 'Claude' : page === 'codex' ? 'Speak. Build. Continue.' : page === 'dictation' ? 'A thought away.' : page === 'recordings' ? 'Your recordings.' : 'Just your way.'}</h1><p>{page === 'claude' ? 'Work on a project with Claude by voice or text.' : page === 'codex' ? 'Your ring, connected to Codex.' : page === 'dictation' ? 'From a passing thought to words on your screen.' : page === 'recordings' ? 'The moments you captured. Ready for what comes next.' : 'A few small choices. A smoother everyday flow.'}</p></div><div className="eleven-badge"><span className="eleven-logo" aria-hidden="true">Ⅱ</span><span>Speech by<strong>ElevenLabs</strong></span></div></header>

        {fatal ? <div className="unavailable-state" role="alert"><span className="unavailable-icon"><Icon name="cloud" size={32} /></span><h2>Let’s reconnect to desktop.</h2><p>{fatal}</p></div> : !state ? <div className="loading-state" role="status"><Spinner /><span>Opening your space…</span></div> : <>
          {error ? <div className="message-banner error-banner" role="alert"><Icon name="info" size={18} /><span>{error}</span><IconButton icon="close" label="Dismiss error" onClick={() => setError('')} /></div> : null}
          {state.syncRetryAddress && pending !== 'disconnect' && <div className="message-banner" role="status"><Spinner /><span>Connection lost. Reconnecting to {ringLabel(state, state.syncRetryAddress) || state.syncRetryAddress} to finish syncing…</span></div>}
          {state.lastSync && page !== 'settings' && <div className="message-banner" role="status"><Icon name="library" size={18} /><span>Last sync · {state.lastSync}</span></div>}
          {!state.service.ready ? <div className="message-banner service-banner" role="status"><Icon name="info" size={18} /><span>{state.service.error || 'The ring service is starting. Bluetooth controls will be available when it is ready.'}</span><button className="text-button" type="button" onClick={() => setActivity(true)}>View activity<Icon name="arrow" size={15} /></button></div> : null}
          {page === 'codex' || page === 'claude' ? null : page === 'dictation' ? <div className="workspace-grid"><div className="dictation-column"><DictationPanel state={state} disabled={disabled} pending={pending} run={run} onSettings={() => setPage('settings')} /><div className="codex-destination"><label htmlFor="voice-destination">Voice destination</label><select id="voice-destination" value={state.destination || 'cursor'} disabled={disabled || !['idle', 'error'].includes(state.dictation.status)} onChange={e => void run('destination', () => api.setVoiceDestination(e.target.value as NonNullable<AppState['destination']>))}><option value="cursor">Write where my cursor is</option><option value="project">Open project message box</option><option value="codex">Codex draft in Spur</option><option value="claude">Claude draft in Spur</option></select>{state.destination === 'codex' && <button className="button secondary" onClick={() => openDraft('codex')}>Open Codex</button>}{state.destination === 'claude' && <button className="button secondary" onClick={() => openDraft('claude')}>Open Claude</button>}</div><TranscriptPanel state={state} disabled={disabled} run={run} /></div><div className="context-column"><RingPanel state={state} disabled={disabled} pending={pending} run={run} /><FlowGuide source={state.settings.source} shortcut={state.settings.shortcut} /></div></div> : page === 'recordings' ? <RecordingsPage state={state} disabled={disabled} pending={pending} run={run} /> : <SettingsPage settings={state.settings} disabled={disabled || !['idle', 'error'].includes(state.dictation.status)} pending={pending} onSave={(settings) => run('save-settings', () => api.saveSettings(settings), 'Your preferences are saved.')} />}
          {(['claude', 'codex'] as const).map(provider => <div key={provider} hidden={page !== provider}>
            <AssistantPage provider={provider} state={state} mode={modes[provider]} pending={disabled}
              setMode={mode => setModes(current => ({ ...current, [provider]: mode }))}
              onSettings={() => setPage('settings')} onRing={() => setPage('dictation')}
              selectProject={() => void run('destination', () => api.setVoiceDestination('project'))}
              start={() => void run('start-dictation', () => api.startDictation('project'))}
              toggleRingButton={pause => void run('ring-button', () => pause ? api.pauseRingButton() : api.resumeRingButton())}
              stop={() => void run('stop-dictation', () => api.stopDictation())} />
          </div>)}
          <footer className="workspace-footer"><span><Icon name="shield" size={14} />Your recordings stay on this computer. Transcription uses ElevenLabs.</span><button type="button" className={`activity-toggle${activity ? ' expanded' : ''}`} onClick={() => setActivity((open) => !open)} aria-expanded={activity}><span className="inline-dot" />Activity<Icon name="chevron" size={12} /></button></footer>
          {activity ? <section className="activity-panel" aria-label="Application activity"><div className="activity-header"><h2>Behind the scenes</h2><span>{state.logs.length} events</span></div>{state.logs.length ? <ol>{state.logs.slice(-80).map((entry) => <li className={entry.level === 'error' ? 'log-error' : ''} key={entry.id}><time>{entry.time}</time><span>{entry.message}</span></li>)}</ol> : <p>No activity yet. Connection and dictation updates will appear here.</p>}</section> : null}
        </>}
      </main>
    </div>
    {notice ? <div className="toast" role="status"><span><Icon name="check" size={16} /></span>{notice}</div> : null}
  </div>;
}

function DictationPanel({ state, disabled, pending, run, onSettings }: { state: AppState; disabled: boolean; pending: string | null; run: Action; onSettings: () => void }) {
  const source = state.settings.source;
  const ringControl = source === 'ring';
  const ringRecording = source === 'ring-recording';
  const ringSource = source !== 'microphone';
  const standby = idleRingButton(state);
  const listening = state.dictation.status === 'listening';
  const armed = state.dictation.status === 'armed';
  const starting = state.dictation.status === 'starting';
  const stopping = state.dictation.status === 'stopping';
  const active = listening || armed || starting || stopping;
  const ringConnected = state.connection === 'connected' || state.connection === 'syncing';
  const needsKey = !state.settings.hasApiKey;
  const needsRing = ringSource && !ringConnected;
  const waitingForRing = needsRing && !needsKey && Boolean(reconnectPhase(state));
  const stopPending = pending === 'stop-dictation';
  const disconnectingRing = ringSource && pending === 'disconnect';
  const busy = starting || stopping || pending === 'start-dictation' || stopPending;
  const status = starting ? 'Getting ready…' : stopping ? 'Finishing your thought…' : armed ? (ringRecording ? 'Ready · Record on your ring' : 'Ready · Hold your ring button to speak') : listening ? (ringRecording ? 'Recording with your ring’s microphone' : 'Listening to your computer microphone') : standby?.status || 'A little space for your next idea';
  const button = stopPending ? 'Stopping dictation…' : starting || stopping ? 'Cancel dictation' : active ? (ringSource ? 'Stop and pause ring button' : 'Stop dictation') : needsKey ? 'Set up ElevenLabs' : waitingForRing ? 'Waiting for your ring…' : needsRing ? 'Find your ring' : standby?.action || (ringSource ? 'Arm ring dictation' : 'Start dictation');
  const handleClick = () => {
    if (active) { void run('stop-dictation', () => window.spur.stopDictation()); return; }
    if (needsKey) { onSettings(); return; }
    if (needsRing) { void run('scan', () => window.spur.scan()); return; }
    if (standby) { void run('ring-button', () => standby.pause ? window.spur.pauseRingButton() : window.spur.resumeRingButton()); return; }
    void run('start-dictation', () => window.spur.startDictation());
  };
  const setSource = (next: AudioSource) => { void run('source', () => window.spur.saveSettings({ source: next, language: state.settings.language, insertAtCursor: state.settings.insertAtCursor })); };
  let sourceInstructions = 'Speak naturally. See your words appear in the window where you’re working.';
  if (ringControl) sourceInstructions = 'When the ring button is ready, hold it and speak near your computer microphone. A floating caption shows your words. Release to finish.';
  if (ringRecording) {
    sourceInstructions = insertsAtCursor(state)
      ? 'When the ring button is ready, click where you want to type and record on your ring. Captions appear as live ring audio arrives.'
      : 'When the ring button is ready, record on your ring. Captions appear as live ring audio arrives and your words stay in Dictation.';
  }

  return <section className={`dictation-hero${listening ? ' active' : ''}`} aria-label="Dictation controls">
    <div className="hero-top"><div className="source-switch" aria-label="Audio source"><button type="button" aria-pressed={ringControl} onClick={() => setSource('ring')} disabled={disabled || active}><Icon name="ring" size={15} />Ring control</button><button type="button" aria-pressed={!ringSource} onClick={() => setSource('microphone')} disabled={disabled || active}><Icon name="mic" size={14} />Computer mic</button><button type="button" aria-pressed={ringRecording} onClick={() => setSource('ring-recording')} disabled={disabled || active}><Icon name="ring" size={14} />Ring microphone</button></div></div>
    <div className="hero-center"><div className={`capture-symbol${listening ? ' capture-active' : ''}`}><span className="capture-orbit orbit-one" /><span className="capture-orbit orbit-two" /><span className="capture-icon"><Icon name={ringSource ? 'ring' : 'mic'} size={29} /></span>{listening || armed || Boolean(standby && state.ringButton === 'ready') ? <span className="capture-live-dot" /> : null}</div><h2>{listening && !ringRecording ? <>Go on.<br />We’re all ears.</> : standby && state.ringButton === 'ready' ? <>Hold the ring<br />button to speak.</> : armed ? <>One touch.<br />A little more flow.</> : <>Think it.<br />Say it. Keep going.</>}</h2><p>{sourceInstructions}</p></div>
    <Waveform active={listening && !ringRecording} processing={starting || stopping} level={state.dictation.level} />
    <div className="capture-status" aria-live="polite"><span className={`inline-dot${listening ? ' online pulsing' : standby && state.ringButton === 'ready' ? ' online' : ''}`} />{status}</div>
    <button type="button" className={`capture-button${active ? ' is-stop' : ''}`} onClick={handleClick} disabled={disconnectingRing || (active ? stopPending : disabled || waitingForRing || (!state.service.ready && ringSource))}>{busy ? <Spinner /> : <Icon name={active ? 'stop' : needsKey ? 'bolt' : needsRing ? 'bluetooth' : 'mic'} size={18} />}{button}{!active && !needsKey && !needsRing ? <Icon name="arrow" size={17} /> : null}</button>
    {!ringSource && <div className="hero-shortcut"><KeyboardShortcut shortcut={state.settings.shortcut} /><span>{starting ? 'Switch to the window you want to type in.' : 'to start or stop, from anywhere'}</span></div>}
    <div className="hero-bottom"><span><Icon name={insertsAtCursor(state) ? 'cursor' : 'speech'} size={13} />{insertsAtCursor(state) ? 'Insert at cursor' : 'Transcript only'}</span><span><Icon name={ringRecording ? 'ring' : 'mic'} size={13} />{ringRecording ? 'Ring microphone' : 'Computer microphone'}</span></div>
    {state.dictation.cursorNotice && !state.dictation.error ? <p className="dictation-error" role="status">{state.dictation.cursorNotice}</p> : null}
    {state.dictation.error ? <p className="dictation-error" role="alert">{state.dictation.error}</p> : null}
    {standby && state.ringButton === 'error' && state.ringButtonError && <p className="dictation-error" role="alert">{state.ringButtonError}</p>}
  </section>;
}

function TranscriptPanel({ state, disabled, run }: { state: AppState; disabled: boolean; run: Action }) {
  const { committed, partial } = state.transcript;
  const dictationActive = !['idle', 'error'].includes(state.dictation.status);
  const hasText = Boolean(committed || partial);
  const wordCount = committed.trim() ? committed.trim().split(/\s+/).length : 0;
  return <section className="transcript-card panel" aria-label="Live transcript"><div className="panel-header"><div><span className="section-overline">THE WORDS AS THEY COME</span><h2>Your transcript<span className="subtle-dot">.</span></h2></div><div className="panel-actions"><IconButton icon="copy" label="Copy transcript" onClick={() => void run('copy', () => window.spur.copyTranscript(), 'Transcript copied to your clipboard.')} disabled={disabled || !committed} /><IconButton icon="trash" label="Clear transcript" onClick={() => void run('clear', () => window.spur.clearTranscript())} disabled={disabled || !hasText || dictationActive} /></div></div><div className={`transcript-content${hasText ? ' has-text' : ''}`} role="log" aria-label="Dictation transcript" aria-live="polite" aria-relevant="text">{hasText ? <p>{committed}<span className="partial-transcript">{textGap(committed, partial)}{partial}</span>{state.dictation.status === 'listening' ? <span className="typing-caret" /> : null}</p> : <div className="transcript-placeholder"><span className="text-line long" /><span className="text-line" /><span className="text-line short" /><p>Give that thought somewhere to land.<br /><span>Your words will appear here.</span></p></div>}</div><div className="transcript-footer"><span>{hasText ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'}` : 'A fresh page, just for you'}</span><span>{state.dictation.targetLabel ? <><Icon name="cursor" size={12} />{state.dictation.targetLabel}</> : <><Icon name="speech" size={12} />{insertsAtCursor(state) ? 'Focus your destination before starting' : 'Transcript preview'}</>}</span></div></section>;
}

function RingLabelControls({ address, label, disabled, run }: { address: string; label?: string; disabled: boolean; run: Action }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);

  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function save(value: string) {
    const ok = await run('label-' + address, () => window.spur.labelRing(address, value));
    if (ok) closeEditor();
  }

  if (!editing) return <div className="ring-label-controls"><button type="button" className="text-button" ref={trigger}
    disabled={disabled} onClick={() => { setDraft(label || ''); setEditing(true); }}>{label ? 'Rename' : 'Name ring'}</button></div>;
  return <form className="ring-label-controls ring-label-editor" aria-label="Name this ring"
    onSubmit={event => { event.preventDefault(); if (!disabled && draft.trim() !== (label || '')) void save(draft.trim()); }}
    onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); closeEditor(); } }}>
    <label>Ring name<input autoFocus value={draft} maxLength={64} placeholder="e.g. Work ring"
      onChange={event => setDraft(event.target.value)} disabled={disabled} /></label>
    <div className="ring-label-actions">
      <button type="submit" className="button secondary" disabled={disabled || draft.trim() === (label || '')}>Save</button>
      <button type="button" className="text-button" disabled={disabled} onClick={closeEditor}>Cancel</button>
      {label && <button type="button" className="text-button muted" disabled={disabled} onClick={() => void save('')}>Remove name</button>}
    </div>
  </form>;
}

function RingPanel({ state, disabled, pending, run }: { state: AppState; disabled: boolean; pending: string | null; run: Action }) {
  const [address, setAddress] = useState('');
  const target = state.platform === 'windows' ? address.trim().toUpperCase() : '';
  const validTarget = !target || /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(target);
  const devices = state.devices.filter(device => !target || device.id.toUpperCase() === target);
  const dictationActive = !['idle', 'error'].includes(state.dictation.status);
  const connected = state.connection === 'connected' || state.connection === 'syncing';
  const connecting = state.connection === 'connecting' || state.connection === 'authenticating';
  const scanning = pending === 'scan' || state.busy === 'scanning';
  const syncing = state.busy === 'syncing recordings' || state.connection === 'syncing';
  const ringActionsDisabled = disabled || connecting || dictationActive || !state.service.ready;
  const savedRing = state.rememberedRing;
  const phase = reconnectPhase(state);
  const reconnectError = savedRing && !phase && state.connection === 'disconnected' && !state.syncRetryAddress ? state.autoReconnectError : undefined;
  const disconnecting = pending === 'disconnect' || state.busy === 'disconnecting';
  const activeLink = connected || connecting || syncing || state.busy === 'connecting' || Boolean(state.syncRetryAddress || pending?.startsWith('connect-'));
  const showDisconnect = activeLink || savedRing || disconnecting;
  const showDiscovery = !connected && !phase && !state.syncRetryAddress && !disconnecting;
  const disconnect = () => void run('disconnect', () => window.spur.disconnect());
  const displayedAddress = connected ? state.ringAddress : savedRing?.id;
  const savedLabel = ringLabel(state, displayedAddress);
  const name = savedLabel || (connected ? state.ringName || 'Spur Ring' : savedRing?.name || 'Small ring. Big ideas.');
  const description = connected
    ? state.ringAddress || 'Connected to your ring.'
    : savedRing?.id || 'Bring your ring nearby and connect it to your computer.';

  return <section className="ring-panel panel" aria-label="Ring connection">
    <div className="ring-card-header"><span className="section-overline">YOUR EVERYDAY COMPANION</span><StatusPill connected={connected}>{connectionLabel(state)}</StatusPill></div>
    <div className={`ring-scene${connected ? ' connected' : ''}`} aria-hidden="true"><span className="ring-halo halo-one" /><span className="ring-halo halo-two" /><div className="ring-object"><span /><i /></div><span className="ring-shadow" /></div>
    <h2>{name}</h2>
    <p>{description}</p>
    {state.platform === 'windows' && displayedAddress && <RingLabelControls key={displayedAddress}
      address={displayedAddress} label={savedLabel} disabled={disabled} run={run} />}
    {reconnectError && <div className="ring-scan-result" role="status">{reconnectError}</div>}
    <div className="ring-primary-actions">
      {connected && (
        <button type="button" className="button secondary" onClick={() => void run('sync', () => window.spur.sync())} disabled={disabled || dictationActive || !state.service.ready}>
          {syncing ? <Spinner /> : <Icon name="refresh" size={16} />}{syncing ? 'Syncing…' : 'Sync recordings'}
        </button>
      )}
      {showDisconnect && <button type="button" className={activeLink ? 'text-button muted' : 'button secondary'} onClick={disconnect}
        disabled={disconnecting} title={savedRing ? 'Disconnect and stop automatic reconnection' : undefined}>
        {disconnecting ? <><Spinner />Disconnecting…</> : activeLink ? 'Disconnect' : 'Stop auto-reconnect'}
      </button>}
      {showDiscovery && <button type="button" className="button secondary" onClick={() => void run('scan', () => window.spur.scan(target || undefined))} disabled={ringActionsDisabled || !validTarget}>
        {scanning || connecting ? <Spinner /> : <Icon name="bluetooth" size={17} />}{scanning ? 'Looking nearby…' : connecting ? 'Connecting…' : 'Find your ring'}
      </button>}
    </div>
    {state.connection === 'syncing' ? <div className="sync-progress"><div><span style={{ width: `${Math.min(100, Math.max(0, state.progress))}%` }} /></div><small>{Math.round(state.progress)}% complete</small></div> : null}
    {showDiscovery && state.platform === 'windows' && <details className="ring-address"><summary>Find by Bluetooth address</summary><label>Address from the AIZO app <input value={address} onChange={event => setAddress(event.target.value)} placeholder="AA:BB:CC:DD:EE:FF" spellCheck={false} disabled={disabled || connecting} /></label></details>}
    {showDiscovery && devices.length > 0 && <div className="nearby-devices">
      <div className="section-overline">NEARBY DEVICES</div>
      {devices.map(device => {
        const label = ringLabel(state, device.id);
        const displayName = label || device.name || 'Unnamed device';
        const canLabel = state.platform === 'windows' && (device.compatible || label || !device.name || /^unnamed\b/i.test(device.name));
        return <div className={`nearby-device${device.compatible ? '' : ' incompatible'}`} key={device.id}>
        <span className="nearby-icon"><Icon name={device.compatible ? 'ring' : 'bluetooth'} size={17} /></span>
        <span><strong title={displayName}>{displayName}</strong><small>{device.compatible ? `${device.id} · ${device.rssi} dBm` : 'Not a supported ring'}</small></span>
        {device.compatible && <div className="nearby-actions">
          <button type="button" className="button primary" disabled={ringActionsDisabled} onClick={() => void run('connect-sync-' + device.id, () => window.spur.connectAndSync(device.id))}>
            {pending === 'connect-sync-' + device.id ? <><Spinner />{state.syncRetryAddress ? 'Reconnecting…' : 'Connecting…'}</> : 'Connect & sync'}
          </button>
          <button type="button" className="text-button" disabled={ringActionsDisabled} onClick={() => void run('connect-' + device.id, () => window.spur.connect(device.id))}>
            {pending === 'connect-' + device.id ? 'Connecting…' : 'Connect only'}
          </button>
        </div>}
        {canLabel && <RingLabelControls address={device.id} label={label} disabled={disabled} run={run} />}
      </div>; })}
    </div>}
    {showDiscovery && !connecting && !syncing && state.discovery.status !== 'idle' && <div className="ring-scan-result" role="status" data-discovery={state.discovery.status}>
      {state.discovery.status === 'searching' && 'Scanning for nearby rings…'}
      {state.discovery.status === 'retrying' && 'No ring seen on the first scan. Looking once more…'}
      {state.discovery.status === 'failed' && state.discovery.message}
      {state.discovery.status === 'complete' && (devices.some(device => device.compatible)
        ? 'Select Connect & sync beside your ring to download its recordings.'
        : target ? `No advertisement matching ${target} is visible. Keep the ring near the PC and search again.` : 'No compatible ring found. If the other Spur app is connecting or connected, disconnect there and close it. Bring your ring close to this computer and select Find your ring again.')}
    </div>}
    <div className="ring-footnote"><Icon name="bluetooth" size={13} />{connected ? 'Finished recordings sync automatically' : reconnectError ? 'Ring saved on this computer' : savedRing ? 'Auto-reconnect is on for this ring' : 'Connect directly over Bluetooth · No phone needed'}</div>
  </section>;
}

function FlowGuide({ source, shortcut }: { source: AudioSource; shortcut: string }) {
  return <section className="flow-guide"><span className="section-overline">A LITTLE LESS FRICTION</span><h3>Stay in your flow.</h3><ol><li><span>01</span><p>{source !== 'microphone' ? 'Connect the ring. When Spur shows “Ring button ready”, click in the field where you want your words.' : <>Start dictation with <strong>{shortcut.replaceAll('+', ' + ')}</strong>.</>}</p></li><li><span>02</span><p>{source === 'ring' ? 'Hold the ring button and speak near your computer microphone.' : source === 'ring-recording' ? 'Speak into the ring. Release to finish the recording.' : 'Put your cursor in a document, message, or anywhere you write.'}</p></li><li><span>03</span><p>{source === 'ring' ? 'Release to finish. With cursor insertion on, Spur types confirmed words into the focused field.' : source === 'ring-recording' ? 'With cursor insertion on, Spur types confirmed phrases into the field. A file-only recording is transcribed after release.' : 'Speak your mind. Your words follow along.'}</p></li></ol><div className="guide-tip"><Icon name={source === 'microphone' ? 'cursor' : source === 'ring' ? 'mic' : 'ring'} size={15} /><p>{source === 'microphone' ? 'Starting from the app? You have 3 seconds to focus your destination.' : source === 'ring' ? 'The ring is your remote. Live audio comes from this computer’s microphone.' : 'Keep the text field focused while dictating.'}</p></div></section>;
}

function RecordingsPage({ state, disabled, pending, run }: { state: AppState; disabled: boolean; pending: string | null; run: Action }) {
  const [query, setQuery] = useState('');
  const recordings = useMemo(() => { const search = query.trim().toLocaleLowerCase(); return search ? state.recordings.filter((recording) => `${recording.name} ${recording.transcript || ''}`.toLocaleLowerCase().includes(search)) : state.recordings; }, [state.recordings, query]);
  const connected = state.connection === 'connected';
  const dictationActive = !['idle', 'error'].includes(state.dictation.status);
  return <section className="recordings-page"><div className="library-toolbar"><div className="library-count"><span>{state.recordings.length}</span> {state.recordings.length === 1 ? 'recording' : 'recordings'} on this computer</div><div><button type="button" className="button secondary" onClick={() => void run('import', () => window.spur.importRecordings())} disabled={disabled || dictationActive}>Import from AIZO</button><button type="button" className="button secondary" onClick={() => void run('folder', () => window.spur.openFolder())} disabled={disabled}><Icon name="folder" size={17} />Open folder</button><button type="button" className="button primary" onClick={() => void run('sync', () => window.spur.sync())} disabled={disabled || !connected || dictationActive}>{pending === 'sync' || state.connection === 'syncing' ? <Spinner /> : <Icon name="refresh" size={17} />}Sync recordings</button></div></div>{state.importNotice && <p role="status">{state.importNotice}</p>}<div className="library-panel panel"><div className="library-panel-header"><h2>Collected thoughts<span className="subtle-dot">.</span></h2><label className="search-field"><Icon name="search" size={17} /><input type="search" placeholder="Find a recording…" aria-label="Search recordings and transcripts" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>{recordings.length ? <div className="recording-table-scroll"><table className="recording-table"><thead><tr><th scope="col">RECORDING</th><th scope="col">CAPTURED</th><th scope="col">SIZE</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{recordings.map((recording) => <tr key={recording.id}><td><div className="recording-title"><span className="recording-file-icon"><Icon name="speech" size={20} /></span><span><strong>{recording.name}</strong><small>{recording.transcript ? 'Transcript available' : 'Ready to listen'}</small></span></div></td><td>{dateLabel(recording.timestamp)}</td><td>{sizeLabel(recording.size)}</td><td><div className="recording-actions"><IconButton icon="play" label={`Play ${recording.name}`} onClick={() => void run(`play-${recording.id}`, () => window.spur.openRecording(recording.id))} disabled={disabled} /><IconButton icon="speech" label={`Transcribe ${recording.name}`} onClick={() => void run(`transcribe-${recording.id}`, () => window.spur.transcribeRecording(recording.id), 'Recording transcribed. Find the words in Dictation.')} disabled={disabled || !state.settings.hasApiKey || dictationActive} /><IconButton icon="download" label={`Export ${recording.name}`} onClick={() => void run(`export-${recording.id}`, () => window.spur.exportRecording(recording.id))} disabled={disabled} /></div></td></tr>)}</tbody></table></div> : <div className="library-empty"><div className="empty-recording-art" aria-hidden="true"><span className="empty-sheet sheet-back" /><span className="empty-sheet sheet-front"><Icon name="speech" size={28} /><i /><i /><i /></span><span className="empty-spark">✦</span></div><h3>{query ? 'That thought isn’t here yet.' : 'Good thoughts deserve a home.'}</h3><p>{query ? 'Try another name or a word from the transcript.' : 'Sync directly from your ring, or export audio in the AIZO app and import the saved files here.'}</p>{query ? <button type="button" className="text-button" onClick={() => setQuery('')}>Clear search<Icon name="arrow" size={16} /></button> : <span className="empty-library-note"><Icon name="shield" size={14} />Saved locally. Yours to keep.</span>}</div>}</div></section>;
}

function SettingsPage({ settings, disabled, pending, onSave }: { settings: Settings; disabled: boolean; pending: string | null; onSave: (settings: SaveSettings) => Promise<boolean> }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [language, setLanguage] = useState(settings.language);
  const [source, setSource] = useState(settings.source);
  const [insertAtCursor, setInsertAtCursor] = useState(settings.insertAtCursor);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [permissionPending, setPermissionPending] = useState(false);
  const requestPermissions = async () => {
    setPermissionPending(true);
    try {
      await window.spur.requestPermissions();
      const current = await window.spur.getState();
      setPermissionMessage(`Microphone: ${current.permissions?.microphone || 'unknown'}. Cursor typing: ${current.permissions?.accessibility.granted ? 'allowed' : 'enable Accessibility in System Settings → Privacy & Security'}.`);
    } catch (error) { setPermissionMessage(error instanceof Error ? error.message : 'Could not check macOS permissions.'); }
    finally { setPermissionPending(false); }
  };
  useEffect(() => { setLanguage(settings.language); setSource(settings.source); setInsertAtCursor(settings.insertAtCursor); }, [settings.language, settings.source, settings.insertAtCursor]);
  const submit = async (event: FormEvent) => { event.preventDefault(); const saved = await onSave({ apiKey: apiKey.trim() || undefined, language, source, insertAtCursor }); if (saved) { setApiKey(''); setShowKey(false); } };
  return <form className="settings-layout" onSubmit={(event) => void submit(event)}>
    <div className="settings-main">
      <section className="settings-card panel">
        <div className="settings-section-heading">
          <span className="settings-icon"><span className="eleven-logo">Ⅱ</span></span>
          <div><h2>A voice-to-words connection.</h2><p>Bring your ElevenLabs key. We’ll take it from there.</p></div>
          <StatusPill connected={settings.hasApiKey}>{settings.hasApiKey ? 'Key saved' : 'Not set up'}</StatusPill>
        </div>
        <div className="settings-section-body">
          <label className="field-label" htmlFor="api-key">ElevenLabs API key</label>
          <div className="key-field">
            <input id="api-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={disabled} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={settings.hasApiKey ? 'Enter a new key to replace your saved key' : 'Paste your ElevenLabs API key'} aria-describedby="key-help" />
            <IconButton icon={showKey ? 'eyeoff' : 'eye'} label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey((show) => !show)} disabled={disabled} />
          </div>
          <p className="field-help" id="key-help"><Icon name="shield" size={13} />Protected by {settings.credentialStore || 'your operating system'} and saved only on this computer.</p>
          <div className="cloud-note"><Icon name="cloud" size={19} /><p>Audio is sent to ElevenLabs for transcription. Usage is billed to your ElevenLabs account.</p></div>
        </div>
      </section>
      {settings.credentialStore === 'macOS Keychain' ? <section className="settings-card panel">
        <div className="settings-section-heading"><span className="settings-icon"><Icon name="shield" size={21} /></span><div><h2>Allow dictation on your Mac.</h2><p>Microphone access captures speech. Accessibility lets Spur type at your cursor.</p></div></div>
        <div className="settings-section-body"><p className="field-help">In System Settings → Privacy &amp; Security, allow Bluetooth for the ring and Accessibility for Spur Desktop and its ring helper, if listed.</p><button type="button" className="button secondary" disabled={disabled || permissionPending} onClick={() => void requestPermissions()}>{permissionPending ? 'Checking permissions…' : 'Check / enable permissions'}</button>{permissionMessage ? <p className="field-help" role="status">{permissionMessage}</p> : null}</div>
      </section> : null}
      <section className="settings-card panel">
        <div className="settings-section-heading"><span className="settings-icon"><Icon name="mic" size={21} /></span><div><h2>The way you capture.</h2><p>Choose what works for the moment.</p></div></div>
        <div className="settings-section-body">
          <div className="field-label" id="source-label">Your audio source</div>
          <div className="source-options" role="group" aria-labelledby="source-label">
            {SOURCE_OPTIONS.map((option) => <button type="button" key={option.value} className={source === option.value ? 'selected' : ''} aria-pressed={source === option.value} onClick={() => setSource(option.value)} disabled={disabled}>
              <span className="source-option-top"><Icon name={option.icon} size={22} /><span className="radio-indicator">{source === option.value ? <span /> : null}</span></span>
              <strong>{option.title}</strong><small>{option.description}</small>
            </button>)}
          </div>
          <label className="field-label language-label" htmlFor="language">Transcription language</label>
          <div className="select-wrap"><select id="language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={disabled}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Icon name="chevron" size={15} /></div>
          <div className="setting-toggle-row"><span><strong>Write where my cursor is</strong><small>Type each confirmed phrase into the text field where you started dictating.</small></span><button type="button" className={`toggle${insertAtCursor ? ' on' : ''}`} role="switch" aria-checked={insertAtCursor} aria-label="Insert dictated text at cursor" onClick={() => setInsertAtCursor((value) => !value)} disabled={disabled}><span /></button></div>
        </div>
      </section>
      <div className="settings-save-row"><span><Icon name="check" size={14} />Make it yours. Change it anytime.</span><button type="submit" className="button primary" disabled={disabled}>{pending === 'save-settings' ? <Spinner /> : <Icon name="check" size={17} />}Save preferences</button></div>
    </div>
    <aside className="settings-aside">
      <span className="shortcut-art"><Icon name="bolt" size={24} /></span><div className="section-overline">ONE SHORTCUT. MORE FLOW.</div><h3>Good thoughts<br />don’t wait.</h3>
      <p>Start or stop dictation from any app. Keep your cursor where you want your words to go.</p><KeyboardShortcut shortcut={settings.shortcut} />
      <div className="settings-aside-rule" /><span className="section-overline">A NOTE ON RING AUDIO</span>
      <p>Choose Ring microphone to dictate from your ring. Ring control uses this computer’s microphone.</p>
    </aside>
  </form>;
}
