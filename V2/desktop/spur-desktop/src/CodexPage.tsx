import { useState } from 'react';
import type { AppState, CodexQuestion } from './types';
import { textGap } from './transcript-text';

function Questions({ request, onAnswer, disabled }: { request: CodexQuestion; onAnswer: (value: unknown) => void; disabled: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <form className="codex-request" onSubmit={e => { e.preventDefault(); onAnswer({ id: request.id, answers }); }}>
    <h3>Codex needs your input</h3>
    {request.questions.map(q => <label key={q.id}>{q.question}
      {q.options?.map(option => <button type="button" className="button secondary" key={option.label} onClick={() => setAnswers(a => ({ ...a, [q.id]: option.label }))} title={option.description}>{option.label}</button>)}
      <input required value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} maxLength={8000} />
    </label>)}
    <button className="button primary" disabled={disabled}>Reply to Codex</button>
  </form>;
}

type Provider = 'codex' | 'claude';
export type AssistantMode = 'project' | 'embedded';

const ringButtonControls = {
  preparing: { status: 'Preparing ring button…', action: 'Pause ring button', pause: true },
  ready: { status: 'Ring button ready', action: 'Pause ring button', pause: true },
  paused: { status: 'Ring button paused', action: 'Enable ring button', pause: false },
  error: { status: 'Ring button unavailable', action: 'Retry ring button', pause: false },
};

export function idleRingButton(state: AppState) {
  if (state.settings.source === 'microphone' || !state.ringButton ||
    !state.settings.hasApiKey || !state.service.ready || !['connected', 'syncing'].includes(state.connection) ||
    !['idle', 'error'].includes(state.dictation.status)) return;
  return ringButtonControls[state.ringButton];
}

interface AssistantPageProps {
  state: AppState;
  provider: Provider;
  mode: AssistantMode;
  setMode(mode: AssistantMode): void;
  onSettings(): void;
  onRing(): void;
  selectProject(): void;
  start(): void;
  stop(): void;
  toggleRingButton(pause: boolean): void;
  pending: boolean;
}

export function AssistantPage({ state, provider, mode, setMode, onSettings, onRing, selectProject, start, stop, toggleRingButton, pending }: AssistantPageProps) {
  const label = provider === 'claude' ? 'Claude' : 'Codex';
  const { settings, dictation } = state;
  const microphone = settings.source === 'microphone';
  const active = !['idle', 'error'].includes(dictation.status);
  const ringSource = !microphone;
  const standby = idleRingButton(state);
  const cursorDestination = !state.destination || state.destination === 'cursor';
  const inProject = state.destination === 'project' || (ringSource && cursorDestination && settings.insertAtCursor);
  const otherRecording = active && !inProject;
  const needsRing = ringSource && state.connection !== 'connected' && state.connection !== 'syncing';
  const finalWords = dictation.utteranceStart === undefined ? '' : state.transcript.committed.slice(dictation.utteranceStart).trimStart();
  const completedRingTake = ringSource && dictation.source !== 'microphone' && dictation.status === 'idle' && dictation.insertAtCursor && Boolean(finalWords);
  const partial = dictation.status === 'listening' || dictation.status === 'stopping' ? state.transcript.partial : '';

  return <section className="codex-page" aria-label={label + ' workspace'}>
    <div className="codex-row" role="group" aria-label="Conversation location">
      {(['project', 'embedded'] as const).map(value => <button key={value} type="button"
        className={'button ' + (mode === value ? 'primary' : 'secondary')} aria-pressed={mode === value}
        onClick={() => setMode(value)}>{value === 'project' ? 'Open project' : 'Chat in Spur'}</button>)}
    </div>
    {mode === 'project' && <section className="panel codex-setup" aria-label={'Dictate into ' + label}>
      <h2>Dictate into your {label} project</h2>
      <p>Choose your conversation and model in {label}. Spur types into the message box you focus. Review and send each message there.</p>
      <p className="codex-help">{microphone
        ? 'Start dictation, then click the message box within three seconds.'
        : settings.source === 'ring'
          ? 'When the ring button is ready, click the project’s message box. Hold the ring button, speak near your computer microphone, then release.'
          : 'When the ring button is ready, click the message box and record on the ring. Captions appear as live ring audio arrives.'}</p>
      <div className="codex-row">
        {active && inProject
          ? <button type="button" className="button primary" onClick={stop} disabled={dictation.status === 'stopping'}>Stop project dictation</button>
          : !settings.hasApiKey
            ? <button type="button" className="button secondary" onClick={onSettings}>Set up ElevenLabs transcription</button>
            : needsRing
              ? <button type="button" className="button secondary" onClick={onRing}>Connect your ring</button>
              : standby ? <>
                  <strong role="status">{standby.status}</strong>
                  <button type="button" className="button secondary" disabled={pending} onClick={() => toggleRingButton(standby.pause)}>{standby.action}</button>
                </> : <button type="button" className="button primary" onClick={start} disabled={pending || otherRecording || !state.service.ready || Boolean(state.busy)}>
                  {microphone ? 'Start project dictation' : 'Arm ring for open project'}</button>}
        {!active && !inProject && settings.hasApiKey && !needsRing && <button type="button" className="button secondary"
          onClick={selectProject} disabled={pending}>{ringSource ? 'Use this project' : 'Use shortcut in project'}</button>}
        {inProject && active && <span role="status">{dictation.status} · {dictation.targetLabel}</span>}
        {otherRecording && <span role="status">Stop the current dictation to change its destination.</span>}
      </div>
      {inProject && !active && microphone && <p className="codex-help">Focus the project’s message box and press <kbd>{settings.shortcut}</kbd> to start dictation.</p>}
      {standby && state.ringButton === 'error' && state.ringButtonError && <p role="alert">{state.ringButtonError}</p>}
      {inProject && (active || completedRingTake) && dictation.utteranceStart !== undefined && <section className="codex-voice" aria-label="Project transcript">
        <strong>{dictation.status === 'armed' || completedRingTake ? 'Last transcript' : 'Live transcript'}</strong>
        <p aria-live="polite">{finalWords}<span className="partial-transcript">{textGap(finalWords, partial)}{partial}</span>
          {!finalWords && !partial && (dictation.status === 'armed' ? 'No speech captured.' : 'Listening for speech…')}</p>
      </section>}
      {inProject && (dictation.cursorNotice || dictation.error) && <p role="alert">{dictation.error || dictation.cursorNotice}</p>}
    </section>}
    <div hidden={mode !== 'embedded'}><EmbeddedAssistant state={state} provider={provider} /></div>
  </section>;
}

function EmbeddedAssistant({ state, provider }: { state: AppState; provider: Provider }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [addedSession, setAddedSession] = useState<number>();
  const [apiKey, setApiKey] = useState('');
  const isClaude = provider === 'claude';
  const label = isClaude ? 'Claude' : 'Codex';
  const c = state[provider];
  if (!c) return <p>Restart Spur to enable {label}.</p>;
  const active = !['idle', 'error'].includes(state.dictation.status);
  const working = c.status === 'running' || c.status === 'connecting';
  const locked = pending || working;
  const capture = state.voiceDrafts?.[provider];
  const recordingHere = active && state.destination === provider;
  const voiceText = capture && capture.session !== addedSession ? capture.text : '';
  const act = async (action: string, value?: unknown) => {
    setPending(true); setError('');
    try { await (isClaude ? window.spur.claudeAction : window.spur.codexAction)(action, value); return true; }
    catch (e) { setError(String(e).replace(/^Error: Error invoking remote method 'spur:command': Error: /, '')); return false; }
    finally { setPending(false); }
  };
  const stopVoice = async () => {
    setPending(true); setError('');
    try { await window.spur.stopDictation(); } catch (e) { setError(String(e)); } finally { setPending(false); }
  };
  const addVoice = () => {
    setDraft(d => [d.trim(), voiceText].filter(Boolean).join('\n'));
    setAddedSession(capture?.session);
  };
  return <section className="codex-page" aria-label={label + " chat in Spur"}>
    <div className="panel codex-setup">
      <div className="codex-row"><strong>{label} connection</strong><span role="status">{c.status} · {c.account || 'Not connected'}</span></div>
      <div className="codex-row">
        {isClaude && !c.authenticated && <label>Anthropic API key <input id="claude-api-key" type="password" autoComplete="off" spellCheck={false} disabled={locked} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter key or use saved key" /></label>}
        <button className="button primary" disabled={locked} onClick={() => { void act('connect', isClaude && apiKey ? apiKey : undefined); setApiKey(''); }}>{c.status === 'disconnected' ? 'Connect ' + label : 'Reconnect'}</button>
        {isClaude && c.authenticated && <button className="button secondary" disabled={locked} onClick={() => void act('forget')}>Disconnect and forget saved key</button>}
        {!isClaude && !c.authenticated && c.status === 'ready' && <button className="button secondary" disabled={locked} onClick={() => void act('login')}>Sign in with ChatGPT</button>}
        {!isClaude && <button className="button secondary" disabled={locked} onClick={() => void act('executable')}>Choose Codex executable</button>}
      </div>
      <p className="codex-help">{isClaude ? 'Connect with an Anthropic API key. Spur encrypts saved keys on this computer and can also use ANTHROPIC_API_KEY. Anthropic bills API usage to your account.' : 'Uses the Codex CLI and its account on this computer. On Windows, choose the native codex.exe executable.'}</p>
      {!isClaude && c.executable && <p className="codex-path" title={c.executable}>{c.executable}</p>}
      {c.models.length > 0 && <div className="codex-row"><label htmlFor={provider + '-model'}>Model</label><select id={provider + '-model'} value={c.model} disabled={locked} onChange={e => void act('model', e.target.value)}>{c.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
      <div className="codex-row"><button className="button secondary" disabled={locked} onClick={() => void act('project')}>Choose project</button><span className="codex-path">{c.project || 'Select a project folder.'}</span></div>
      <div className="codex-row"><label htmlFor={provider + '-conversation'}>Conversation</label>
        <select id={provider + '-conversation'} value={c.threadId || ''} disabled={locked || c.status !== 'ready'} onChange={e => void act(e.target.value ? 'resume' : 'new', e.target.value)}>
          <option value="">New conversation</option>
          {c.conversations.filter(t => t.project === c.project).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button className="button secondary" disabled={locked} onClick={() => void act('new')}>New conversation</button>
      </div>
      <p className="codex-help">{isClaude ? 'Review file edits and commands requested by Claude here before they run.' : 'Codex can edit files in the selected project. Requests for additional access appear below.'}</p>
    </div>
    {(error || c.error) && <p className="message-banner error-banner" role="alert">{error || c.error}</p>}
    <div className="panel codex-chat">
      <div className="codex-row"><h2>Your conversation</h2><span role="status">{c.activity}</span>
        {c.status === 'running' && <button className="button secondary" disabled={pending || !c.turnId} onClick={() => void act('stop')}>Stop task</button>}
      </div>
      <div className="codex-messages" aria-label="Conversation messages" aria-live="polite">
        {!c.messages.length && <p>Ask {label} to explain code, make a change, or work on files in your project.</p>}
        {c.messages.map(m => m.role === 'activity'
          ? <details key={m.id} className="codex-activity"><summary>Command or file change</summary><pre>{m.text}</pre></details>
          : <article key={m.id} className={`codex-message ${m.role}`}><strong>{m.role === 'user' ? 'You' : label}</strong><div>{m.text}</div></article>)}
      </div>
      {c.approvals.map(a => <section key={a.id} className="codex-request" aria-label={label + " approval"}><h3>{a.title}</h3><pre>{a.details}</pre>
        {!a.canApprove && <p>This request cannot be approved in Spur. Decline it and ask {label} for a narrower action.</p>}
        <div className="codex-row"><button className="button secondary" disabled={pending} onClick={() => void act('answer', { id: a.id, allow: false })}>Decline</button>
          <button className="button primary" disabled={pending || !a.canApprove} onClick={() => void act('answer', { id: a.id, allow: true })}>Allow once</button></div>
      </section>)}
      {c.questions.map(q => <Questions key={q.id} request={q} disabled={pending} onAnswer={value => void act('answer', value)} />)}
    </div>
    <form className="panel codex-compose" onSubmit={e => { e.preventDefault(); void act('send', draft).then(ok => { if (ok) setDraft(''); }); }}>
      <label htmlFor={provider + '-draft'}>Instruction for {label}</label>
      <textarea id={provider + '-draft'} value={draft} onChange={e => setDraft(e.target.value)} maxLength={64000} disabled={pending} placeholder={"Speak or type what you want " + label + " to do…"} rows={5} />
      <div className="codex-row">
        <button type="button" className="button secondary" disabled={pending || (active && !recordingHere) || (!active && (!state.service.ready || !state.settings.hasApiKey || (state.settings.source !== 'microphone' && state.connection !== 'connected')))} onClick={() => void (recordingHere ? stopVoice() : act('voice'))}>{recordingHere ? 'Stop / disarm voice' : state.settings.source === 'microphone' ? 'Record instruction' : 'Arm ring for ' + label}</button>
        {!capture && <button type="button" className="button secondary" disabled={active || pending || !state.transcript.committed.trim()} onClick={() => setDraft(d => [d.trim(), state.transcript.committed.trim()].filter(Boolean).join('\n'))}>Add existing transcript</button>}
        <button className="button primary" disabled={locked || active || !draft.trim() || !c.project || !c.authenticated || c.status !== 'ready'}>Send to {label}</button>
      </div>
      <p className="codex-help">Voice uses the audio source and ElevenLabs key from Settings. Stop recording, add the transcript, and review before sending. {label} receives your instruction and may read project files.</p>
      {state.destination === provider && state.dictation.error && <p role="alert">{state.dictation.error}</p>}
      {capture && capture.session !== addedSession && <div className="codex-voice"><strong>Voice transcript{recordingHere ? ' · ' + state.dictation.status : ''}</strong><p>{voiceText || (recordingHere ? 'Waiting for speech…' : 'No speech captured.')} <span>{recordingHere && state.transcript.partial}</span></p><button type="button" className="button secondary" disabled={active || !voiceText || pending} onClick={addVoice}>Add transcript to instruction</button></div>}
    </form>
  </section>;
}
