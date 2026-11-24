import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, protocol, safeStorage, session, shell, systemPreferences, Tray } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppState, Recording, RingDevice, Settings } from '../src/types';
import { RingService } from './bridge';
import { Dictation } from './dictation';
import { transcribeFile } from './transcription';
import { desktopEnvironment } from './platform';
import { discoverRings } from './discovery';
import { syncRingRecordings } from './ring-sync';
import { isRingIdentifier, RingReconnect } from './ring-reconnect';
import { RingButton } from './ring-button';
import { RecordingAutoSync } from './recording-auto-sync';
import { readRingLabels, ringLabelEntry } from './ring-labels';
import { audioTypes, importAudio, importedAudio } from './audio-import';
import { CaptionOverlay } from './caption-overlay';
import { CaptionSession } from './caption-session';
import { CodexConnection, initialCodexState } from './codex';
import { ClaudeConnection } from './claude';

protocol.registerSchemesAsPrivileged([{ scheme: 'spur', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const selfTest = process.argv.includes('--self-test');
const primaryInstance = selfTest || app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
const root = app.getAppPath();
const environment = desktopEnvironment(process.platform, app.getPath('home'), app.getPath('appData'), process.env.LOCALAPPDATA);
const dataRoot = environment.dataRoot;
const importedRoot = path.join(dataRoot, 'recordings', 'aizo-imports');
const settingsFile = path.join(dataRoot, 'desktop-ui.json');
const keyFile = path.join(dataRoot, 'elevenlabs-key.bin');
const rememberedRingFile = path.join(dataRoot, 'remembered-ring.json');
const ringLabelsFile = path.join(dataRoot, 'ring-labels.json');
const codexFile = path.join(dataRoot, 'codex.json');
const claudeFile = path.join(dataRoot, 'claude.json');
const claudeKeyFile = path.join(dataRoot, 'anthropic-key.bin');
let claudeKey = '';
const desktopRingControls = (process.platform === 'win32' || environment.mac) && !selfTest;
let window: BrowserWindow | undefined;
let tray: Tray | undefined;
let overlay: CaptionOverlay | undefined;
let captions: CaptionSession | undefined;
let quitting = false;
let quitReady = false;

function showMainWindow(): void {
  if (quitting || !window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

if (!selfTest && primaryInstance) {
  app.on('second-instance', showMainWindow);
}
let diagnosticExitCode: number | undefined;
let logSequence = 0;
let apiKey = '';
let dictation: Dictation;
let reconnect: RingReconnect | undefined;
let ringButton: RingButton | undefined;
let ringButtonPaused = false;
let rendererReady = false;
let autoSync: RecordingAutoSync | undefined;
let ringWriting = false;
let selectedForConnection: RingDevice | undefined;
let ringActivity = new AbortController();
let disconnectJob: Promise<void> | undefined;
const settings: Settings = { hasApiKey: false, language: 'auto', shortcut: environment.shortcut, insertAtCursor: true, source: process.platform === 'win32' ? 'ring-recording' : 'ring', credentialStore: environment.credentialStore };
const state: AppState = {
  codex: initialCodexState(), claude: initialCodexState(), destination: 'cursor',
  version: app.getVersion(), connection: 'disconnected', ringName: 'Your Spur Ring', devices: [], discovery: { status: 'idle' }, recordings: [],
  transcript: { committed: '', partial: '' },
  dictation: { status: 'idle', source: 'ring', insertAtCursor: true, targetLabel: '', level: 0 },
  settings, service: { ready: false }, logs: [], progress: 0, busy: null, platform: environment.mac ? 'macos' : 'windows',
};
const traceRingButton = process.argv.includes('--trace-ring-button');
let previousRingTrace = '';
const publishState = () => {
  if (window && !window.isDestroyed()) window.webContents.send('spur:state', state);
  if (traceRingButton) {
    const trace = JSON.stringify({ connection: state.connection, button: state.ringButton, source: settings.source,
      dictation: state.dictation.status, hasPartial: Boolean(state.transcript.partial), hasFinal: Boolean(state.transcript.committed) });
    if (trace !== previousRingTrace) {
      previousRingTrace = trace;
      console.info('[spur-ring]', trace);
    }
  }
};
const changed = () => {
  reconnect?.refresh();
  ringButton?.refresh();
  autoSync?.refresh();
  publishState();
  if (!quitting) captions?.update(state, dictation?.liveRingTake?.phase);
};
function log(message: string, error = false): void {
  state.logs = [...state.logs.slice(-149), { id: ++logSequence, time: new Date().toISOString(), level: error ? 'error' : 'info', message }];
  changed();
}
function atomicJSON(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, file);
}
const codex = new CodexConnection(state.codex!, changed, () => {
  const { project, executable, conversations, model } = state.codex!;
  atomicJSON(codexFile, { project, executable, conversations, model });
});
const claude = new ClaudeConnection(state.claude!, {
  key: () => claudeKey || process.env.ANTHROPIC_API_KEY || '',
  saveKey(key) {
    if (key) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.');
      const encrypted = safeStorage.encryptString(key);
      mkdirSync(dataRoot, { recursive: true });
      writeFileSync(claudeKeyFile + '.tmp', encrypted, { mode: 0o600 });
      renameSync(claudeKeyFile + '.tmp', claudeKeyFile);
    } else if (existsSync(claudeKeyFile)) unlinkSync(claudeKeyFile);
    claudeKey = key;
  },
  save() {
    const { project, conversations, model } = state.claude!;
    atomicJSON(claudeFile, { project, conversations, model });
  },
  changed,
  runtime: () => path.join(app.isPackaged ? root + '.unpacked' : root, 'node_modules', '@anthropic-ai',
    `claude-agent-sdk-${process.platform}-${process.arch}`, process.platform === 'win32' ? 'claude.exe' : 'claude'),
});
function loadClaude(): void {
  if (existsSync(claudeKeyFile)) {
    try { claudeKey = safeStorage.decryptString(readFileSync(claudeKeyFile)); }
    catch { log('Your saved Anthropic key could not be unlocked. Enter it again on the Claude page.', true); }
  }
  if (!existsSync(claudeFile)) return;
  try {
    const saved = JSON.parse(readFileSync(claudeFile, 'utf8'));
    if (typeof saved.project === 'string') state.claude!.project = saved.project;
    if (typeof saved.model === 'string') state.claude!.model = saved.model;
    if (Array.isArray(saved.conversations)) state.claude!.conversations = saved.conversations.filter((c: any) =>
      typeof c?.id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(c.id) && typeof c.title === 'string' && typeof c.project === 'string').slice(0, 100);
  } catch { log('Could not load saved Claude conversations.', true); }
}
function loadCodex(): void {
  const bundled = environment.mac
    ? path.join(process.resourcesPath, 'codex', process.arch, 'bin', 'codex')
    : path.join(process.resourcesPath, 'codex', 'bin', 'codex.exe');
  if (app.isPackaged && existsSync(bundled)) state.codex!.executable = bundled;
  try {
    if (!existsSync(codexFile)) return;
    const saved = JSON.parse(readFileSync(codexFile, 'utf8'));
    if (typeof saved.project === 'string') state.codex!.project = saved.project;
    if (typeof saved.model === 'string') state.codex!.model = saved.model;
    if (typeof saved.executable === 'string' && existsSync(saved.executable)) state.codex!.executable = saved.executable;
    if (Array.isArray(saved.conversations)) state.codex!.conversations = saved.conversations.filter((c: any) =>
      typeof c?.id === 'string' && typeof c.title === 'string' && typeof c.project === 'string').slice(0, 100);
  } catch { log('Could not load saved Codex conversations.', true); }
}
function setVoiceDestination(value: unknown): void {
  if (dictation.active) throw new Error('Stop or disarm dictation before changing its destination.');
  if (value !== 'cursor' && value !== 'project' && value !== 'codex' && value !== 'claude') throw new Error('Choose a valid destination.');
  state.destination = value; changed();
}
async function assistantCommand(provider: 'codex' | 'claude', argument: unknown): Promise<void> {
  if (!argument || typeof argument !== 'object' || !('action' in argument)) throw new Error('Invalid assistant action.');
  const assistant = provider === 'codex' ? codex : claude;
  const { action, value } = argument as { action: string; value?: unknown };
  switch (action) {
    case 'connect': return provider === 'claude' ? claude.connect(value) : codex.connect();
    case 'forget': if (provider === 'claude') return claude.forget(); break;
    case 'model': return assistant.model(value);
    case 'login': if (provider === 'codex') { await shell.openExternal(await codex.login()); return; } break;
    case 'project': {
      const selected = await dialog.showOpenDialog(window!, { title: 'Choose a project folder', properties: ['openDirectory'] });
      if (!selected.canceled && selected.filePaths[0]) assistant.project(selected.filePaths[0]); return;
    }
    case 'executable': {
      if (provider !== 'codex') break;
      const selected = await dialog.showOpenDialog(window!, { title: 'Choose the native Codex executable', properties: ['openFile'], ...(process.platform === 'win32' ? { filters: [{ name: 'Codex executable', extensions: ['exe'] }] } : {}) });
      if (!selected.canceled && selected.filePaths[0]) codex.executable(selected.filePaths[0]); return;
    }
    case 'new': return assistant.newConversation();
    case 'resume': return assistant.resume(value);
    case 'send':
      if (dictation.active) throw new Error('Stop or disarm recording and review the instruction before sending.');
      return assistant.send(value);
    case 'stop': return assistant.stop();
    case 'answer': return assistant.answer(value);
    case 'destination': return setVoiceDestination(value);
    case 'voice':
      if (dictation.active) throw new Error('Stop the current dictation first.');
      state.destination = provider; changed(); return dictation.start(0);
  }
  throw new Error('Unknown assistant action.');
}
function loadRememberedRing(): void {
  if (!desktopRingControls || !existsSync(rememberedRingFile)) return;
  try {
    const ring = JSON.parse(readFileSync(rememberedRingFile, 'utf8'));
    if (ring === null) return;
    if (!isRingIdentifier(ring?.id, state.platform) ||
        typeof ring.name !== 'string' || !ring.name.trim()) throw new Error('Invalid saved ring');
    state.rememberedRing = { id: ring.id.toUpperCase(), name: ring.name };
    reconnect?.setTarget(state.rememberedRing.id);
  } catch { log('Could not read the remembered ring. Choose your ring to save it again.', true); }
}
function loadRingLabels(): void {
  if (state.platform !== 'windows') return;
  state.ringLabels = {};
  if (!existsSync(ringLabelsFile)) return;
  try { state.ringLabels = readRingLabels(JSON.parse(readFileSync(ringLabelsFile, 'utf8'))); }
  catch { log('Could not read the ring names saved on this PC.', true); }
}

function saveRingLabel(argument: unknown): void {
  if (state.platform !== 'windows' || !argument || typeof argument !== 'object' || !('id' in argument) || !('label' in argument)) {
    throw new Error('Select a ring to name.');
  }
  const [id, label] = ringLabelEntry(argument.id, argument.label);
  const labels = { ...state.ringLabels };
  const current = (state.connection === 'connected' || state.connection === 'syncing') && state.ringAddress?.toUpperCase() === id;
  if (!current && state.rememberedRing?.id !== id && !Object.hasOwn(labels, id) &&
      !state.devices.some(device => device.id.toUpperCase() === id)) throw new Error('Find your ring again before naming it.');
  if (label) labels[id] = label;
  else delete labels[id];
  atomicJSON(ringLabelsFile, labels);
  state.ringLabels = labels;
  changed();
}
function rememberAuthenticatedSelection(device: RingDevice): void {
  const ring = { id: device.id.toUpperCase(), name: device.name || 'Spur Ring' };
  try {
    atomicJSON(rememberedRingFile, ring);
    state.rememberedRing = ring;
    state.autoReconnectError = undefined;
    reconnect?.setTarget(ring.id);
  } catch { log('Connected, but Spur could not save the ring for the next launch.', true); }
}
function loadSettings(): void {
  if (existsSync(settingsFile)) {
    try {
      const value = JSON.parse(readFileSync(settingsFile, 'utf8'));
      if (['ring', 'microphone', 'ring-recording'].includes(value.source)) settings.source = value.source;
      if (typeof value.insertAtCursor === 'boolean') settings.insertAtCursor = value.insertAtCursor;
      ringButtonPaused = value.ringButtonPaused === true;
      if (typeof value.language === 'string' && /^(auto|[a-z]{2,3})$/.test(value.language)) settings.language = value.language;
    } catch { log('Could not read saved preferences. Default preferences are in use.', true); }
  }
  if (process.env.ELEVENLABS_API_KEY) apiKey = process.env.ELEVENLABS_API_KEY;
  else if (existsSync(keyFile)) {
    try { apiKey = safeStorage.decryptString(readFileSync(keyFile)); }
    catch { log('Your saved ElevenLabs key could not be unlocked. Enter it again in Settings.', true); }
  }
  settings.hasApiKey = Boolean(apiKey);
  Object.assign(state.dictation, { source: settings.source, insertAtCursor: settings.insertAtCursor });
}
const service = new RingService(event => {
  if (event.type === 'ring-opus') { dictation?.liveRingTake?.packet(event); return; }
  if (event.type === 'ring-live-end') {
    ringWriting = false;
    if (state.ringAddress) autoSync?.covered(state.ringAddress, true);
    dictation?.liveRingTake?.end(event.timestamp);
    return;
  }
  if (event.type === 'ring-live-error') { dictation?.liveRingTake?.fail(event.message || 'The ring audio stream was interrupted.', event.timestamp); return; }
  if (event.type === 'status') {
    state.connection = event.status;
    if (event.status === 'disconnected') { ringWriting = false; autoSync?.reset(); }
    if (desktopRingControls && !state.disconnecting && event.status === 'connected' && typeof event.address === 'string') {
      const address: string = event.address.toUpperCase();
      state.ringAddress = address;
      if (selectedForConnection && selectedForConnection.id.toUpperCase() === address) rememberAuthenticatedSelection(selectedForConnection);
      const remembered = state.rememberedRing;
      if (remembered && remembered.id === address) {
        state.ringName = remembered.name;
      }
    }
    if (event.status === 'syncing') state.syncRetryAddress = undefined;
    if (event.status === 'disconnected' && !state.disconnecting && dictation?.active && (state.dictation.source !== 'microphone' || !desktopRingControls)) void dictation.fail(new Error('The ring disconnected. Dictation stopped; your transcript is retained.'));
    if (event.message) log(event.message);
  } else if (event.type === 'ring-state') {
    ringWriting = event.state === 2 || event.state === 3;
  } else if (event.type === 'recording-ready') {
    if (!quitting && !state.disconnecting && state.ringAddress && typeof event.address === 'string' && event.address.toUpperCase() === state.ringAddress &&
        (state.connection === 'connected' || state.connection === 'syncing')) {
      ringWriting = false;
      autoSync?.request(state.ringAddress, 'finished');
    }
  } else if (event.type === 'sync-retry') {
    if (state.disconnecting) return;
    state.syncRetryAddress = event.address;
    state.progress = 0;
  } else if (event.type === 'log') log(event.message);
  else if (event.type === 'error') log(event.message, true);
  else if (event.type === 'progress') state.progress = event.progress;
  else if (event.type === 'dictation-state' && event.armed === false) ringButton?.nativeDisarmed();
  else if (event.type === 'dictation-trigger' && !quitting && !state.disconnecting) {
    if (dictation?.active) void dictation.trigger(event.action);
    else if (event.action === 'start' && ringButton?.acceptsPress) {
      void dictation.startFromRingPress().catch(error => log(error instanceof Error ? error.message : 'Could not start ring dictation.', true));
    }
  }
  else if (event.type === 'ring-touch') {
    if (event.action === 'long_press') ringWriting = true;
    dictation?.ringTouch(event.action);
  }
  else if (event.type === 'recording') {
    const file = toRecording(event.file);
    if (file) { dictation?.file(file); void refreshLibrary().catch(error => log(String(error), true)); }
  }
  changed();
}, message => {
  ringWriting = false; autoSync?.reset();
  state.service = { ready: false, error: message }; state.connection = 'disconnected';
  state.devices = []; state.discovery = { status: 'failed', message };
  if (!quitting) { log(message, true); if (dictation?.active) void dictation.fail(new Error(message)); }
});
if (desktopRingControls) {
  ringButton = new RingButton({
    current: () => ({
      link: !quitting && !state.disconnecting && state.service.ready &&
        (state.connection === 'connected' || state.connection === 'syncing') ? state.ringAddress : undefined,
      source: settings.hasApiKey && settings.source !== 'microphone' ? settings.source : undefined,
      paused: ringButtonPaused,
      canConfigure: rendererReady && !state.busy && state.connection === 'connected' && !dictation?.active,
    }),
    configure: source => source ? service.request('armDictation', source === 'ring-recording' ? { liveRingAudio: true } : {}) : service.request('disarmDictation'),
    status(value, message) {
      if (state.ringButton === value && state.ringButtonError === message) return;
      state.ringButton = value; state.ringButtonError = message; publishState();
    },
  });
  autoSync = new RecordingAutoSync({
    canSync: address => {
      const dictationUsingRing = state.dictation.source !== 'microphone' &&
        ['starting', 'listening', 'stopping'].includes(state.dictation.status);
      return !quitting && !state.disconnecting && !state.busy && !ringWriting && !dictationUsingRing &&
        state.service.ready && state.connection === 'connected' && state.ringAddress === address;
    },
    download: (_address, checkInventory) => downloadRecordings(undefined, true, checkInventory),
    failed: message => {
      state.lastSync = `Automatic sync: ${message}`;
      log(state.lastSync, true);
    },
  });
  reconnect = new RingReconnect({
    canAttempt: () => !quitting && state.service.ready && !state.busy && !dictation?.active && state.connection === 'disconnected',
    onPhase: phase => { state.autoReconnect = phase; publishState(); },
    connect: async (address, signal) => {
      const reply = await service.request<{ connected: boolean; reason?: string; message?: string }>('reconnectSavedRing', { address }, null);
      if (signal.aborted) return 'stop';
      if (reply.reason === 'authentication-rejected') {
        state.autoReconnectError = reply.message || 'The ring declined the connection. Choose your ring to try again.';
        log(state.autoReconnectError, true);
        return 'stop';
      }
      if (reply.connected && state.connection === 'connected') {
        autoSync?.request(address, 'reconnected');
        return 'connected';
      }
      return 'retry';
    },
  });
}
function toRecording(raw: any, imported = false): Recording | undefined {
  if (!raw || typeof raw.path !== 'string' || typeof raw.name !== 'string') return;
  const absolute = path.resolve(raw.path);
  const relative = path.relative(imported ? importedRoot : path.join(dataRoot, 'recordings'), absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  if (!imported && relative.split(path.sep)[0] === 'aizo-imports') return;
  if (imported ? !Object.hasOwn(audioTypes, path.extname(absolute).slice(1).toLowerCase()) : !absolute.endsWith('.ogg')) return;
  const id = createHash('sha256').update(absolute.toLowerCase()).digest('hex').slice(0, 24);
  let transcript: string | undefined;
  try { const saved = JSON.parse(readFileSync(absolute + '.transcript.json', 'utf8')); if (typeof saved.text === 'string') transcript = saved.text; } catch {}
  return { id, name: raw.name, path: absolute, size: Number(raw.size), timestamp: Number(raw.timestamp), transcript };
}
async function refreshLibrary(): Promise<void> {
  const [recordings, imports] = await Promise.all([service.request<any[]>('listRecordings'), importedAudio(importedRoot)]);
  state.recordings = [...recordings.map(file => toRecording(file)), ...imports.map(file => toRecording(file, true))]
    .filter((file): file is Recording => Boolean(file)).sort((a, b) => b.timestamp - a.timestamp);
  changed();
}
function downloadRecordings(selected?: RingDevice, automatic = false, checkInventory = false): Promise<number | undefined> {
  if (state.disconnecting) return Promise.reject(new Error('The ring is disconnecting.'));
  return syncRingRecordings({ state, refreshLibrary, log, changed, request: (method, params, timeout) => {
    const address = selected?.id.toUpperCase() ?? state.ringAddress;
    if (!automatic && address) autoSync?.covered(address);
    return service.request(method, params, timeout);
  } }, selected, ringActivity.signal, checkInventory);
}
async function sync(selected?: RingDevice): Promise<void> {
  await downloadRecordings(selected);
}

async function disconnectRing(): Promise<void> {
  state.disconnecting = true;
  autoSync?.reset();
  ringWriting = false;
  ringActivity.abort();
  const previousTarget = state.rememberedRing;
  selectedForConnection = undefined;
  state.syncRetryAddress = undefined;
  state.rememberedRing = undefined;
  state.autoReconnectError = undefined;
  reconnect?.setTarget(null);
  if (state.busy === 'scanning') state.discovery = { status: 'idle' };
  if (!state.busy || ['connecting', 'scanning', 'syncing recordings'].includes(state.busy)) state.busy = 'disconnecting';
  changed();
  let saved = true;
  try {
    if (previousTarget) {
      try { atomicJSON(rememberedRingFile, null); } catch { saved = false; }
    }
    // Release the radio even when dictation is still waiting for its arm or flush reply.
    const [radio, speech] = await Promise.allSettled([
      state.service.ready ? service.request('disconnect') : undefined,
      state.dictation.source !== 'microphone' ? dictation.stop() : undefined,
    ]);
    if (radio.status === 'rejected') throw radio.reason;
    state.connection = 'disconnected';
    state.ringAddress = undefined;
    state.ringName = 'Your Spur Ring';
    if (speech.status === 'rejected') throw speech.reason;
    if (!saved) throw new Error('The ring disconnected, but Spur could not save the auto-reconnect setting. Choose Stop auto-reconnect to retry.');
  } finally {
    if (!saved) state.rememberedRing = previousTarget;
    state.disconnecting = false;
    if (state.busy === 'disconnecting') state.busy = null;
    ringActivity = new AbortController();
    changed();
  }
}
async function transcribe(file: Recording, signal?: AbortSignal): Promise<string> {
  if (!apiKey) throw new Error('Add your ElevenLabs API key in Settings first.');
  log(`Transcribing ${file.name} with ElevenLabs…`);
  const text = await transcribeFile(file.path, apiKey, settings.language, signal);
  atomicJSON(file.path + '.transcript.json', { schema: 1, text, service: 'ElevenLabs', model: 'scribe_v2', createdAt: new Date().toISOString() });
  await refreshLibrary();
  log(text ? 'Transcript saved alongside the original recording.' : 'No speech was recognized. The original recording is retained.');
  return text;
}
function selectedFile(id: unknown): Recording {
  const file = state.recordings.find(recording => recording.id === id);
  if (!file || !existsSync(file.path)) throw new Error('This recording is no longer available. Refresh the library.');
  return file;
}
function writeDesktopSettings(paused = ringButtonPaused): void {
  atomicJSON(settingsFile, { schema: 1, source: settings.source, language: settings.language, insertAtCursor: settings.insertAtCursor, ringButtonPaused: paused });
}

async function setRingButtonPaused(paused: boolean): Promise<void> {
  if (!ringButton) return;
  if (ringButtonPaused !== paused) {
    writeDesktopSettings(paused);
    ringButtonPaused = paused;
  }
  if (paused && settings.source !== 'microphone' && dictation.active) await dictation.stop();
  ringButton.retry();
}

async function saveSettings(value: unknown): Promise<void> {
  if (dictation.active) throw new Error('Stop or disarm dictation before changing its settings.');
  if (!value || typeof value !== 'object') throw new Error('Invalid settings.');
  const next = value as Record<string, unknown>;
  if (!['ring', 'microphone', 'ring-recording'].includes(String(next.source)) || typeof next.insertAtCursor !== 'boolean' || typeof next.language !== 'string' || !/^(auto|[a-z]{2,3})$/.test(next.language)) throw new Error('Choose a valid audio source and language.');
  if (next.apiKey !== undefined) {
    if (typeof next.apiKey !== 'string' || !next.apiKey.trim() || next.apiKey.length > 1024 || /[\r\n]/.test(next.apiKey)) throw new Error('Enter a valid ElevenLabs API key.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error(`${environment.credentialStore} credential encryption is unavailable. Your API key was not saved.`);
    const encrypted = safeStorage.encryptString(next.apiKey.trim());
    mkdirSync(dataRoot, { recursive: true });
    writeFileSync(keyFile + '.tmp', encrypted, { mode: 0o600 }); renameSync(keyFile + '.tmp', keyFile);
    apiKey = next.apiKey.trim();
  }
  Object.assign(settings, { source: next.source, language: next.language, insertAtCursor: next.insertAtCursor, hasApiKey: Boolean(apiKey) });
  writeDesktopSettings();
  Object.assign(state.dictation, { source: settings.source, insertAtCursor: settings.insertAtCursor, error: undefined, status: 'idle' });
  log(`Preferences saved. API credentials stay in the desktop process and are protected by ${environment.credentialStore}.`);
}
async function refreshPermissions(promptAccessibility = false): Promise<void> {
  if (!environment.mac) return;
  const permissions = await service.request<{ accessibility: { required: boolean; granted: boolean; available?: boolean; message?: string } }>(promptAccessibility ? 'requestInputPermissions' : 'getInputPermissions');
  state.permissions = { accessibility: permissions.accessibility, microphone: systemPreferences.getMediaAccessStatus('microphone') };
  changed();
}
async function prepareSession(): Promise<void> {
  if (!environment.mac) return;
  if (settings.source !== 'ring-recording' && systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    if (!granted) throw new Error('Allow Spur Desktop in System Settings → Privacy & Security → Microphone, then restart the app.');
  }
  await refreshPermissions(state.dictation.insertAtCursor);
  if (state.dictation.insertAtCursor && !state.permissions?.accessibility.granted) throw new Error('Allow Spur Desktop and its ring helper, if listed, in System Settings → Privacy & Security → Accessibility, then start dictation again.');
}
async function command(method: unknown, argument?: unknown): Promise<unknown> {
  switch (method) {
    case 'codex':
    case 'claude': return assistantCommand(method, argument);
    case 'getState': return state;
    case 'labelRing': return saveRingLabel(argument);
    case 'scan': {
      if (state.disconnecting || state.busy || dictation.active || state.autoReconnect === 'connecting') throw new Error('Finish the current connection or operation before scanning.');
      const { signal } = ringActivity;
      state.busy = 'scanning'; state.devices = []; state.discovery = { status: 'searching' }; changed();
      try {
        const scanOptions = argument || !state.ringLabels ? { address: argument } : { knownAddresses: Object.keys(state.ringLabels) };
        const devices = await discoverRings(() => signal.aborted ? Promise.resolve([]) : service.request('scan', scanOptions), () => {
          if (signal.aborted) return;
          state.discovery = { status: 'retrying' }; changed();
        });
        if (signal.aborted) return;
        state.devices = devices;
        state.discovery = { status: 'complete' };
      } catch (error) {
        if (signal.aborted) return;
        state.discovery = { status: 'failed', message: error instanceof Error ? error.message : 'Bluetooth discovery failed.' };
        throw error;
      } finally { if (!signal.aborted) { state.busy = null; changed(); } }
      return;
    }
    case 'connect':
    case 'connectAndSync': {
      if (state.disconnecting || state.busy || dictation.active || state.autoReconnect === 'connecting') throw new Error('Finish the current connection or operation first.');
      const device = state.devices.find(device => device.id === argument);
      if (!device?.compatible) throw new Error('Scan and select a compatible ring first.');
      if (state.connection !== 'disconnected') throw new Error('Disconnect the current ring before selecting another.');
      const { signal } = ringActivity;
      selectedForConnection = device;
      try {
        if (method === 'connectAndSync') return await sync(device);
        state.busy = 'connecting'; changed();
        try {
          await service.request('connect', { address: device.id }, 95000);
          if (signal.aborted) return;
          state.ringName = device.name;
          state.ringAddress = device.id.toUpperCase();
          state.lastSync = undefined;
        } finally { if (!signal.aborted) { state.busy = null; changed(); } }
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally { if (!signal.aborted) selectedForConnection = undefined; }
      return;
    }
    case 'disconnect': {
      if (!desktopRingControls) { await dictation.stop(); await service.request('disconnect'); return; }
      disconnectJob ??= disconnectRing().finally(() => { disconnectJob = undefined; });
      return disconnectJob;
    }
    case 'sync': if (dictation.active) throw new Error('Disarm dictation before a manual sync.'); return sync();
    case 'openRecording': { const error = await shell.openPath(selectedFile(argument).path); if (error) throw new Error(error); return; }
    case 'importRecordings': {
      if (state.busy || dictation.active) throw new Error('Finish the current operation before importing audio.');
      state.busy = 'importing recordings'; state.importNotice = undefined; changed();
      try {
        const selected = await dialog.showOpenDialog(window!, { title: 'Import audio exported from AIZO',
          properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio files', extensions: Object.keys(audioTypes) }] });
        if (selected.canceled) return;
        let added = 0;
        for (const file of selected.filePaths) if (await importAudio(file, importedRoot)) added++;
        state.importNotice = `Imported ${added} recording(s). ${selected.filePaths.length - added} already in your library.`;
      } finally {
        try { await refreshLibrary(); } finally { state.busy = null; changed(); }
      }
      return;
    }
    case 'exportRecording': {
      const file = selectedFile(argument);
      const result = await dialog.showSaveDialog(window!, { defaultPath: file.name, filters: [{ name: 'Audio recording', extensions: [path.extname(file.path).slice(1)] }] });
      if (!result.canceled && result.filePath) await copyFile(file.path, result.filePath);
      return;
    }
    case 'openFolder': { const error = await shell.openPath(path.join(dataRoot, 'recordings')); if (error) throw new Error(error); return; }
    case 'saveSettings': return saveSettings(argument);
    case 'setVoiceDestination': return setVoiceDestination(argument);
    case 'startDictation':
      if (argument !== undefined) {
        if (argument !== 'project') throw new Error('Choose a valid destination.');
        setVoiceDestination(argument);
      }
      return dictation.start();
    case 'pauseRingButton': return setRingButtonPaused(true);
    case 'resumeRingButton': return setRingButtonPaused(false);
    case 'stopDictation':
      if (ringButton && settings.source !== 'microphone') return setRingButtonPaused(true);
      return dictation.stop();
    case 'copyTranscript': clipboard.writeText(state.transcript.committed); return;
    case 'clearTranscript': if (dictation.active) throw new Error('Stop or disarm dictation before clearing the transcript.'); state.transcript = { committed: '', partial: '' }; changed(); return;
    case 'transcribeRecording': {
      if (state.busy || dictation.active) throw new Error('Finish the current operation before transcribing a recording.');
      const file = selectedFile(argument); state.busy = 'transcribing'; changed();
      try { const text = await transcribe(file); state.transcript = { committed: text, partial: '' }; changed(); }
      finally { state.busy = null; changed(); }
      return;
    }
    case 'minimize': window?.minimize(); return;
    case 'close': window?.close(); return;
    case 'requestPermissions': {
      if (dictation.active) throw new Error('Stop or disarm dictation before changing permissions.');
      if (environment.mac) {
        if (settings.source !== 'ring-recording' && systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') await systemPreferences.askForMediaAccess('microphone');
        await refreshPermissions(true);
        if (!state.permissions?.accessibility.granted) log('Enable Accessibility for Spur Desktop and its helper, if listed, in System Settings → Privacy & Security.');
      }
      return;
    }
    default: throw new Error('Unknown desktop action.');
  }
}

async function createWindow(): Promise<void> {
  const dist = path.join(root, 'dist');
  protocol.handle('spur', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
    const requested = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const relative = path.relative(dist, requested);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(requested).href);
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(
    contents === window?.webContents && permission === 'media' && details.requestingUrl.startsWith('spur://app') &&
    (!('mediaTypes' in details) || !details.mediaTypes || details.mediaTypes.every(kind => kind === 'audio')) && dictation?.active === true,
  ));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => contents === window?.webContents && permission === 'media' && origin.startsWith('spur://app') && dictation?.active === true);
  window = new BrowserWindow({ width: 1280, height: 880, minWidth: 1000, minHeight: 720, show: false, frame: environment.mac, ...(environment.mac ? { titleBarStyle: 'hidden' as const } : {}),
    title: `Spur Desktop ${app.getVersion()}`, backgroundColor: '#F6F7F9', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, backgroundThrottling: false },
  });
  if (process.platform === 'win32' && !selfTest) {
    const icon = nativeImage.createFromBuffer(readFileSync(path.join(dist, 'spur-tray.png')));
    tray = new Tray(icon);
    tray.setToolTip('Spur Desktop');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Spur', click: showMainWindow },
      { type: 'separator' },
      { label: 'Quit Spur', click: () => app.quit() },
    ]));
    tray.on('click', showMainWindow);
  }
  if (desktopRingControls) {
    window.on('close', event => {
      if (quitting || quitReady) return;
      event.preventDefault();
      window?.hide();
    });
  }
  if (environment.mac && !selfTest) app.on('activate', showMainWindow);
  window.on('closed', () => { window = undefined; });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('spur://app/')) event.preventDefault(); });
  window.webContents.on('render-process-gone', () => { if (dictation.active) void dictation.fail(new Error('The interface closed; microphone capture stopped.')); });
  const validSender = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => event.sender === window?.webContents && event.senderFrame === window?.webContents.mainFrame;
  ipcMain.handle('spur:command', async (event, method, argument) => {
    if (!validSender(event)) throw new Error('Untrusted desktop request.');
    try { return await command(method, argument); }
    catch (error) { log(error instanceof Error ? error.message : 'Desktop operation failed.', true); throw error; }
  });
  ipcMain.on('spur:microphone', (event, pcm) => {
    if (!validSender(event) || state.dictation.source === 'ring-recording' || !(pcm instanceof Uint8Array) || !pcm.length || pcm.length > 64000 || pcm.length % 2) return;
    dictation.audio(pcm);
  });
  ipcMain.on('spur:ring-pcm', (event, id, pcm) => {
    const take = dictation.liveRingTake;
    if (!validSender(event) || !take || take.id !== id || !(pcm instanceof Uint8Array) || !pcm.length || pcm.length > 64000 || pcm.length % 2) return;
    take.pcm(pcm);
  });
  ipcMain.on('spur:ring-decoder-end', (event, id, error) => {
    const take = dictation.liveRingTake;
    if (validSender(event) && take && take.id === id) take.decoderDone(typeof error === 'string' ? error.slice(0, 200) : undefined);
  });
  ipcMain.on('spur:microphone-error', (event, message) => {
    if (validSender(event) && typeof message === 'string') void dictation.fail(new Error(`Microphone: ${message.slice(0, 400)}`));
  });
  await window.loadURL('spur://app/index.html');
  if (!selfTest) window.show();
}

async function verifyCaptionOverlay(): Promise<boolean> {
  const check = new CaptionOverlay();
  try {
    check.update({ label: 'Computer microphone', committed: '', partial: '' });
    const caption = BrowserWindow.getAllWindows().find(candidate => candidate.getTitle() === 'Spur live captions');
    if (!caption) throw new Error('The floating caption window was not created.');
    for (const [partial, committed] of [['', ''], ['a sample', ''], ['a sample phrase', ''], ['', 'A sample phrase.']]) {
      check.update({ label: 'Computer microphone', committed, partial });
      const deadline = Date.now() + 8000;
      while (true) {
        if (caption.isVisible()) {
          if (!caption.isAlwaysOnTop() || caption.isFocusable() || caption.isFocused()) throw new Error('The caption window must float without taking keyboard focus.');
          const text = await caption.webContents.executeJavaScript('document.querySelector("#transcript")?.textContent');
          if (text === (committed || partial)) break;
        }
        if (Date.now() >= deadline) throw new Error('The floating caption did not display the current text.');
        await new Promise(resolve => setTimeout(resolve, 40));
      }
    }
    check.update(null);
    if (caption.isVisible()) throw new Error('The floating caption did not hide.');
    return true;
  } finally { check.dispose(); }
}

async function verifyApp(): Promise<void> {
  const reportArgument = process.argv.indexOf('--report');
  const reportPath = reportArgument >= 0 ? process.argv[reportArgument + 1] : path.join(root, 'test-output', 'self-test.json');
  const result: Record<string, unknown> = { version: app.getVersion(), platform: process.platform, arch: process.arch, ui: false, service: false, noRendererNode: false, ringAuthenticated: false, transcriptionLiveVerified: false };
  diagnosticExitCode = 0;
  try {
    result.service = state.service.ready;
    if (environment.mac) {
      result.floatingCaptions = await verifyCaptionOverlay();
      result.macNativeBindings = state.permissions?.accessibility.available === true;
      const bluetooth = await service.request('diagnose');
      result.coreBluetoothBindings = typeof bluetooth.bluetooth_authorization === 'string';
      result.bluetoothPermission = bluetooth.bluetooth_authorization || bluetooth.error;
    }
    await window!.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    result.noRendererNode = await window!.webContents.executeJavaScript('typeof require === "undefined" && typeof process === "undefined"');
    result.ui = await window!.webContents.executeJavaScript('Boolean(document.querySelector("main")) && document.body.innerText.toLowerCase().includes("spur")');
    const [originalWidth, originalHeight] = window!.getContentSize();
    window!.setContentSize(1000, 720);
    try {
      result.dictationScroll = await window!.webContents.executeJavaScript(`(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const main = document.querySelector('main');
        const activity = main.querySelector('.activity-toggle');
        const belowFold = activity.getBoundingClientRect().bottom > innerHeight;
        main.scrollTop = main.scrollHeight;
        const bottom = activity.getBoundingClientRect().bottom;
        if ((belowFold && main.scrollTop <= 0) || bottom > innerHeight || bottom <= 0) {
          throw new Error('The Dictation page cannot scroll to its Activity button.');
        }
        main.scrollTop = 0;
        return true;
      })()`);
    } finally {
      window!.setContentSize(originalWidth, originalHeight);
    }
    result.pcmWorklet = await window!.webContents.executeJavaScript(`(async () => {
      // Offline rendering exercises the real worklet without an output device,
      // which is not guaranteed to exist on a hosted macOS build runner.
      const context = new OfflineAudioContext(1, 16000, 16000);
      let node;
      let timer;
      try {
        await context.audioWorklet.addModule('spur://app/pcm-worklet.js');
        node = new AudioWorkletNode(context, 'spur-pcm', { processorOptions: { inputRate: context.sampleRate } });
        const oscillator = context.createOscillator();
        const gain = context.createGain(); gain.gain.value = 0.1;
        oscillator.connect(gain).connect(node).connect(context.destination);
        const result = new Promise((resolve, reject) => {
          let chunks = 0;
          timer = setTimeout(() => reject(new Error('PCM worklet did not produce audio chunks.')), 6000);
          node.port.onmessage = event => {
            const samples = new Int16Array(event.data);
            if (samples.length !== 1600 || !samples.some(sample => sample !== 0)) { clearTimeout(timer); reject(new Error('Invalid PCM worklet output.')); return; }
            if (++chunks === 3) { clearTimeout(timer); resolve({ verified: true, sampleRate: context.sampleRate, chunkBytes: event.data.byteLength, syntheticAudioOnly: true }); }
          };
        });
        oscillator.start();
        const [, verified] = await Promise.all([context.startRendering(), result]);
        return verified;
      } finally { clearTimeout(timer); node?.disconnect(); node?.port.close(); }
    })()`, true);
    if (process.argv.includes('--test-scan')) {
      result.discovery = await window!.webContents.executeJavaScript(`(async () => {
        const panel = document.querySelector('[aria-label="Ring connection"]');
        const button = panel?.querySelector('.ring-primary-actions button');
        if (!button || button.disabled) throw new Error('Find your ring is unavailable.');
        button.click();
        const deadline = Date.now() + 65000;
        while (Date.now() < deadline) {
          const status = panel.querySelector('[data-discovery]')?.dataset.discovery;
          if (status === 'failed') throw new Error(panel.querySelector('[data-discovery]').textContent);
          if (status === 'complete') {
            const devices = Array.from(panel.querySelectorAll('.nearby-device'));
            return { count: devices.length, aizoVisible: devices.some(row => /AIZO[ -]?RING/i.test(row.querySelector('strong')?.textContent || '')),
              selectable: devices.filter(row => row.querySelector('button:not(:disabled)')).length };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Find your ring did not display a scan result.');
      })()`);
    }
    const testRing = process.argv.indexOf('--test-ring');
    if (testRing >= 0) {
      await command('scan');
      const address = process.argv[testRing + 1];
      await command('connect', address);
      result.ringAuthenticated = state.connection === 'connected';
      await command('disconnect');
    }
    await window!.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const screenshot = await window!.webContents.capturePage();
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(path.join(path.dirname(reportPath), 'desktop-preview.png'), screenshot.toPNG());
    result.importAvailableOffline = await window!.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('button')].find(button => button.textContent.trim().startsWith('Recordings'))?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [...document.querySelectorAll('button')].some(button => button.textContent === 'Import from AIZO' && !button.disabled);
    })()`);
    if (!result.importAvailableOffline) throw new Error('The recording import button is unavailable while disconnected.');
    result.settingsUI = await window!.webContents.executeJavaScript(`(async () => {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Settings');
      button?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 200));
      return Boolean(document.querySelector('input[type="password"]'));
    })()`);
    writeFileSync(path.join(path.dirname(reportPath), 'settings-preview.png'), (await window!.webContents.capturePage()).toPNG());
    if (!result.ui || !result.service || !result.noRendererNode || !result.settingsUI || (environment.mac && (!result.macNativeBindings || !result.coreBluetoothBindings)) || !(result.pcmWorklet as { verified?: boolean })?.verified) throw new Error('A packaged application check failed.');
  } catch (error) { result.error = error instanceof Error ? error.message : String(error); diagnosticExitCode = 1; }
  atomicJSON(reportPath, result);
  app.quit();
}

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  loadSettings();
  loadCodex();
  loadClaude();
  loadRingLabels();
  loadRememberedRing();
  if (desktopRingControls) {
    overlay = new CaptionOverlay();
    captions = new CaptionSession(view => overlay?.update(view));
  }
  if (environment.mac) Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Spur Desktop', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { role: 'windowMenu' },
  ]));
  dictation = new Dictation({ state, changed, log, request: service.request.bind(service), key: () => apiKey,
    excludedPids: () => [process.pid, ...(window ? [window.webContents.getOSProcessId()] : [])].filter(pid => pid > 0), sync, transcribe, prepareSession,
    decodeRingAudio: desktopRingControls ? message => {
      if (window && !window.isDestroyed()) window.webContents.send('spur:ring-audio', message);
    } : undefined,
    saveLiveTranscript: async (file, text) => {
      atomicJSON(file.path + '.transcript.json', { schema: 1, text, service: 'ElevenLabs', model: 'scribe_v2_realtime', createdAt: new Date().toISOString() });
      await refreshLibrary();
    },
  });
  let serviceStarted: Promise<void>;
  try {
    service.start(app.isPackaged, process.resourcesPath, root, dataRoot);
    serviceStarted = service.request('getInfo').then(async () => { state.service = { ready: true }; await refreshLibrary(); await refreshPermissions(); changed(); });
  } catch (error) { state.service = { ready: false, error: String(error) }; serviceStarted = Promise.resolve(); }
  await createWindow();
  rendererReady = true;
  ringButton?.refresh();
  await serviceStarted.catch(error => { state.service = { ready: false, error: String(error) }; log(String(error), true); });
  if (selfTest) { await verifyApp(); return; }
  if (!globalShortcut.register('CommandOrControl+Shift+Space', () => {
    const operation = ringButton && settings.source !== 'microphone'
      ? setRingButtonPaused(dictation.active || state.ringButton === 'ready' || state.ringButton === 'preparing')
      : dictation.active ? dictation.stop() : dictation.start(0);
    void operation.catch(error => log(String(error), true));
  })) log(`${settings.shortcut} is in use by another app. Use the Start button or change the other app’s shortcut.`, true);
}).catch(error => { if (!selfTest) dialog.showErrorBox('Spur could not start', error instanceof Error ? error.message : String(error)); app.quit(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (!primaryInstance || quitReady) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  autoSync?.reset();
  codex.close();
  claude.stop();
  captions?.dispose();
  overlay?.dispose();
  reconnect?.setTarget(null);
  globalShortcut.unregisterAll();
  void (async () => {
    try {
      await dictation?.stop().catch(() => {});
      await service.close();
    } finally {
      quitReady = true;
      tray?.destroy();
      if (diagnosticExitCode !== undefined) app.exit(diagnosticExitCode);
      else app.quit();
    }
  })();
});
