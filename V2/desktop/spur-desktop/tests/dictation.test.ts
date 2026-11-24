import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { AppState, AudioSource, Recording } from '../src/types';
import { Dictation, freshRingRecording, ringTranscriptRemainder, textGap } from '../electron/dictation';
import { RealtimeTranscriber } from '../electron/transcription';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const file = (path: string, timestamp: number): Recording => ({ id: path, name: path + '.ogg', path, size: 100, timestamp });

function harness(source: AudioSource = 'ring') {
  const state: AppState = {
    version: 'test', connection: 'connected', ringName: 'AIZO-RING', devices: [], discovery: { status: 'idle' }, recordings: [],
    transcript: { committed: '', partial: '' },
    dictation: { status: 'idle', source, insertAtCursor: true, targetLabel: '', level: 0 },
    settings: { hasApiKey: true, language: 'auto', shortcut: 'Ctrl+Shift+Space', insertAtCursor: true, source },
    service: { ready: true }, logs: [], progress: 0, busy: null,
  };
  const calls: { method: string; params?: Record<string, unknown> }[] = [];
  const target = { handle: 123, processId: 456, label: 'Test editor' };
  const ports: ConstructorParameters<typeof Dictation>[0] = {
    state, changed() {}, log() {}, key: () => 'test-key-never-sent', excludedPids: () => [1, 2],
    async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      calls.push({ method, params });
      if (method === 'captureTarget') return target as T;
      if (method === 'insertText') return { inserted: true, count: String(params?.text).length } as T;
      return {} as T;
    },
    async sync() {}, async transcribe() { return 'Test transcript'; },
  };
  const dictation = new Dictation(ports);
  return { state, calls, ports, dictation, target };
}

function ringHarness(t: TestContext) {
  const h = harness('ring-recording');
  h.ports.decodeRingAudio = () => {};
  type SpeechEvents = ConstructorParameters<typeof RealtimeTranscriber>[2];
  let speech: SpeechEvents | undefined;
  // Stub the cloud boundary and deliver the same events as the realtime client.
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function (this: RealtimeTranscriber) {
    speech = this['callbacks'];
  });
  const timestamp = Math.floor(Date.now() / 1000);
  function stream() {
    const take = h.dictation.liveRingTake;
    assert.ok(take);
    take.packet({ timestamp, data: 'AA==', frameSize: 1, frameDurationMs: 20, sampleRate: 16000, channels: 1 });
    take.pcm(new Uint8Array([0, 0]));
    assert.ok(speech);
    return speech;
  }
  async function release(withFile = true) {
    const take = h.dictation.liveRingTake!;
    take.end(timestamp);
    take.decoderDone();
    if (withFile) h.dictation.file(file('ring-recording', timestamp));
    await h.dictation.trigger('stop');
  }
  const insertions = () => h.calls.filter(call => call.method === 'insertText').map(call => call.params?.text);
  return { ...h, stream, release, insertions };
}

test('a global dictation start cannot take the ring while a recording sync is underway', async () => {
  const { state, dictation, calls } = harness();
  state.busy = 'syncing recordings';
  await assert.rejects(dictation.start(0), /syncing recordings/);
  assert.equal(dictation.active, false);
  assert.deepEqual(calls, []);
});

test('Codex destination keeps ring transcription out of the foreground application', async (t) => {
  const h = ringHarness(t);
  h.state.destination = 'codex';
  await h.dictation.start(0);
  await h.dictation.trigger('start');
  h.stream().committed('Explain this project.');
  await h.release();
  await h.dictation.stop();
  assert.match(h.state.transcript.committed, /Explain this project/);
  assert.equal(h.state.dictation.insertAtCursor, false);
  assert.equal(h.calls.some(c => c.method === 'captureTarget' || c.method === 'insertText'), false);
});

test('Claude receives only the speech captured for its own draft', async t => {
  const h = ringHarness(t);
  h.state.transcript.committed = 'Older dictation.';
  h.state.voiceDrafts = { codex: { session: 0, text: 'Codex draft.' } };
  h.state.destination = 'claude';
  await h.dictation.start(0);
  await h.dictation.trigger('start');
  h.stream().committed('Claude draft.');
  await h.release();
  await h.dictation.stop();
  assert.equal(h.state.voiceDrafts.claude?.text, 'Claude draft.');
  assert.equal(h.state.voiceDrafts.codex?.text, 'Codex draft.');
  assert.equal(h.calls.some(c => c.method === 'captureTarget' || c.method === 'insertText'), false);
});

test('textGap adds a boundary between English phrases without duplicating existing whitespace', () => {
  assert.equal(textGap('', 'hello'), '');
  assert.equal(textGap('Hello', 'world'), ' ');
  assert.equal(textGap('Hello.', 'Next'), ' ');
  assert.equal(textGap('Hello ', 'world'), '');
  assert.equal(textGap('Hello', ', world'), '');
  assert.equal(textGap('这段', '录音'), '');
});

test('a completed file can extend live words but cannot silently rewrite a different utterance', () => {
  assert.equal(ringTranscriptRemainder('First phrase.', 'first phrase, then another.'), 'then another.');
  assert.equal(ringTranscriptRemainder('First phrase', 'First phrase, then another.'), ', then another.');
  assert.equal(ringTranscriptRemainder('First phrase.', 'First phrase.'), '');
  assert.equal(ringTranscriptRemainder('First phrase.', 'A different phrase.'), undefined);
  assert.equal(ringTranscriptRemainder('can', 'candy is sweet.'), undefined);
});

test('fresh ring selection excludes baseline files, old timestamps and ambiguous new recordings', () => {
  const old = file('existing', 100);
  const fresh = file('new', 101);
  const baseline = new Set(['existing']);
  assert.equal(freshRingRecording([old, fresh, file('stale', 90)], baseline, 100, 102), fresh);
  assert.equal(freshRingRecording([old], baseline, 100, 102), undefined);
  assert.equal(freshRingRecording([fresh, file('also-new', 102)], baseline, 100, 102), undefined);
  assert.equal(freshRingRecording([file('invalid', Number.NaN)], baseline, 100, 102), undefined);
  assert.equal(freshRingRecording([fresh, file('later', 105)], baseline, 104, 106, 101), fresh);
  assert.equal(freshRingRecording([file('later', 105)], baseline, 104, 106, 101), undefined);
});

test('arming requires an API key and never starts capture until explicitly triggered', async () => {
  const h = harness();
  h.ports.key = () => '';
  await assert.rejects(h.dictation.start(), /API key/);
  assert.equal(h.dictation.active, false);
  assert.equal(h.calls.length, 0);
  h.ports.key = () => 'test';
  await h.dictation.start();
  await h.dictation.start();
  assert.equal(h.state.dictation.status, 'armed');
  assert.deepEqual(h.calls.map(call => call.method), ['armDictation']);
  await h.dictation.stop();
});

test('denied operating-system permission never arms the ring or starts the paid service', async t => {
  let starts = 0;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function () { starts++; });
  const h = harness();
  h.ports.prepareSession = async () => { throw new Error('Microphone permission denied'); };
  await assert.rejects(h.dictation.start(), /permission denied/);
  assert.equal(h.dictation.active, false);
  assert.equal(h.state.dictation.status, 'error');
  assert.equal(starts, 0);
  assert.equal(h.calls.filter(call => call.method === 'armDictation' || call.method === 'captureTarget').length, 0);
});

test('stopping while an OS permission prompt is pending prevents late capture', async t => {
  const permission = deferred<void>();
  let starts = 0;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function () { starts++; });
  const h = harness('microphone');
  h.ports.prepareSession = () => permission.promise;
  const starting = h.dictation.start(0);
  await h.dictation.stop();
  permission.resolve();
  await starting;
  assert.equal(starts, 0);
  assert.equal(h.dictation.active, false);
  assert.equal(h.state.dictation.status, 'idle');
  assert.equal(h.calls.length, 0);
});

test('duplicate ring start triggers open only one microphone transcription session', async t => {
  let starts = 0;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function () { starts++; });
  t.mock.method(RealtimeTranscriber.prototype, 'stop', async function () {});
  t.mock.method(RealtimeTranscriber.prototype, 'cancel', function () {});
  const h = harness();
  await h.dictation.start();
  await Promise.all([h.dictation.trigger('start'), h.dictation.trigger('start')]);
  assert.equal(starts, 1);
  assert.equal(h.calls.filter(call => call.method === 'captureTarget').length, 1);
  await Promise.all([h.dictation.trigger('stop'), h.dictation.trigger('stop')]);
  assert.equal(h.state.dictation.status, 'armed');
  await h.dictation.stop();
});

function microphoneStream(t: TestContext) {
  let callbacks: ConstructorParameters<typeof RealtimeTranscriber>[2] | undefined;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function (this: RealtimeTranscriber) {
    callbacks = this['callbacks'];
  });
  return () => { assert.ok(callbacks); return callbacks; };
}

test('a standby press starts the host mic immediately and a quick release flushes its pre-roll exactly once', async t => {
  const h = harness('ring');
  h.state.busy = 'syncing recordings';
  h.state.connection = 'syncing';
  h.ports.prepareSession = async () => assert.fail('Standby is already prepared');
  const opening = deferred<void>();
  let first!: ConstructorParameters<typeof RealtimeTranscriber>[2];
  const start = t.mock.method(RealtimeTranscriber.prototype, 'start', async function (this: RealtimeTranscriber) {
    first = this['callbacks'];
    await opening.promise;
  });
  const send = t.mock.method(RealtimeTranscriber.prototype, 'send', () => {});
  const finish = t.mock.method(RealtimeTranscriber.prototype, 'stop', async () => first.committed('Quick thought.'));
  const press = h.dictation.startFromRingPress();
  assert.equal(h.state.dictation.status, 'listening');
  const pcm = new Uint8Array([1, 0]);
  h.dictation.audio(pcm);
  await h.dictation.trigger('start');
  const release = h.dictation.trigger('stop');
  const duplicate = h.dictation.trigger('stop');
  assert.equal(h.state.dictation.status, 'stopping');
  h.dictation.audio(new Uint8Array([2, 0]));
  opening.resolve();
  await Promise.all([press, release, duplicate]);
  await h.dictation.trigger('stop');
  assert.equal(start.mock.callCount(), 1);
  assert.deepEqual(send.mock.calls.map(c => c.arguments[0]), [pcm]);
  assert.equal(finish.mock.callCount(), 1);
  assert.equal(h.state.dictation.status, 'idle');
  assert.equal(h.dictation.active, false);
  first.partial('Stale');
  assert.deepEqual(h.state.transcript, { committed: 'Quick thought.', partial: '' });
  assert.equal(h.calls.filter(c => c.method === 'insertText').length, 1);
  assert.ok(!h.calls.some(c => c.method === 'armDictation' || c.method === 'disarmDictation'));
});

test('standby ring audio accepts the first packet on the start edge and can capture another take', async t => {
  const h = ringHarness(t);
  for (const text of ['First.', 'Second.']) {
    const press = h.dictation.startFromRingPress();
    const take = h.dictation.liveRingTake;
    assert.ok(take);
    h.stream().committed(text);
    await h.dictation.trigger('start');
    assert.equal(h.dictation.liveRingTake, take);
    await press;
    await h.release();
    await h.dictation.trigger('stop');
    assert.equal(h.dictation.active, false);
    assert.equal(h.state.dictation.status, 'idle');
  }
  assert.equal(h.state.transcript.committed, 'First. Second.');
  assert.deepEqual(h.insertions(), ['First.', 'Second.']);
  assert.ok(!h.calls.some(c => c.method === 'armDictation' || c.method === 'disarmDictation'));
});

test('a manual arm reply cannot overwrite a take that has already started', async t => {
  const h = harness('ring');
  const arm = deferred<void>();
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) =>
    method === 'armDictation' ? await arm.promise as T : request<T>(method, params);
  microphoneStream(t);
  const arming = h.dictation.start();
  await h.dictation.trigger('start');
  assert.equal(h.state.dictation.status, 'listening');
  arm.resolve();
  await arming;
  assert.equal(h.state.dictation.status, 'listening');
  await h.dictation.trigger('stop');
  assert.equal(h.state.dictation.status, 'armed');
  await h.dictation.stop();
});

test('standby double-click suppression and microphone-only mode never open a physical take', async t => {
  const start = t.mock.method(RealtimeTranscriber.prototype, 'start', async () => {});
  const h = harness('ring');
  h.dictation.ringTouch('double_click');
  await h.dictation.startFromRingPress();
  assert.equal(h.dictation.active, false);
  const mic = harness('microphone');
  await mic.dictation.startFromRingPress();
  assert.equal(mic.dictation.active, false);
  assert.equal(start.mock.callCount(), 0);
});

for (const source of ['ring', 'microphone'] as const) {
  test(`${source} shows live microphone captions even when Spur has focus`, async t => {
    const h = harness(source);
    const speech = microphoneStream(t);
    const request = h.ports.request;
    let captures = 0;
    h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
      if (method === 'captureTarget' && ++captures === 1) throw new Error('Select a text field in another application.');
      return request<T>(method, params);
    };
    await h.dictation.start(0);
    if (source === 'ring') await h.dictation.trigger('start');
    assert.equal(h.state.dictation.status, 'listening');
    assert.match(h.state.dictation.cursorNotice || '', /Live captions continue/);
    speech().partial('Live');
    assert.equal(h.state.transcript.partial, 'Live');
    speech().committed('Live words.');
    assert.equal(h.state.transcript.committed, 'Live words.');
    await h.dictation.stop();
    assert.equal(captures, 1);
    assert.equal(h.calls.some(call => call.method === 'insertText'), false);
  });
}

test('a slow cursor lookup does not delay microphone captions or redirect words after release', async t => {
  const h = harness('ring');
  const speech = microphoneStream(t);
  const firstTarget = deferred<typeof h.target>();
  const secondTarget = deferred<typeof h.target>();
  const captures = [firstTarget, secondTarget];
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    if (method === 'captureTarget') return await captures.shift()!.promise as T;
    return request<T>(method, params);
  };
  await h.dictation.start(0);
  await h.dictation.trigger('start');
  assert.equal(h.state.dictation.utteranceStart, 0);
  speech().partial('First');
  assert.equal(h.state.transcript.partial, 'First');
  speech().committed('First take.');
  await h.dictation.trigger('stop');
  assert.equal(h.state.dictation.status, 'armed');
  await h.dictation.trigger('start');
  assert.equal(h.state.dictation.utteranceStart, 'First take.'.length);
  speech().committed('Second take.');
  firstTarget.resolve({ ...h.target, label: 'Old field' });
  await tick();
  assert.equal(h.calls.some(call => call.method === 'insertText'), false);
  secondTarget.resolve(h.target);
  await tick();
  speech().committed('More.');
  await h.dictation.trigger('stop');
  assert.deepEqual(h.calls.filter(call => call.method === 'insertText').map(call => call.params), [
    { target: h.target, text: 'Second take.' }, { target: h.target, text: ' More.' },
  ]);
  assert.equal(h.state.transcript.committed, 'First take. Second take. More.');
  await h.dictation.stop();
});

test('ring release preserves an unfinalized computer-mic preview locally without typing it', async t => {
  const h = harness('ring');
  const speech = microphoneStream(t);
  await h.dictation.start(0);
  await h.dictation.trigger('start');
  speech().partial('Last audible words');
  await h.dictation.trigger('stop');
  assert.deepEqual(h.state.transcript, { committed: 'Last audible words', partial: '' });
  assert.equal(h.calls.some(call => call.method === 'insertText'), false);
  await h.dictation.stop();
});

test('a ring double-click suppresses the following recording-state start edge', async t => {
  let starts = 0;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function () { starts++; });
  const h = harness();
  await h.dictation.start();
  h.dictation.ringTouch('double_click');
  await h.dictation.trigger('start');
  assert.equal(starts, 0);
  assert.equal(h.state.dictation.status, 'armed');
  await h.dictation.stop();
});

test('stop while arm request is pending cannot leave a late armed UI or session', async () => {
  const h = harness();
  const arm = deferred<Record<string, never>>();
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    if (method === 'armDictation') { h.calls.push({ method, params }); return await arm.promise as T; }
    return request<T>(method, params);
  };
  const starting = h.dictation.start();
  const stopping = h.dictation.stop();
  await tick();
  arm.resolve({});
  await Promise.all([starting, stopping]);
  assert.equal(h.dictation.active, false);
  assert.equal(h.state.dictation.status, 'idle');
  assert.equal(h.calls.filter(call => call.method === 'disarmDictation').length, 1);
});

test('stop during microphone countdown never captures a target or opens a paid session', async t => {
  let starts = 0;
  t.mock.method(RealtimeTranscriber.prototype, 'start', async function () { starts++; });
  t.mock.method(RealtimeTranscriber.prototype, 'stop', async function () {});
  t.mock.method(RealtimeTranscriber.prototype, 'cancel', function () {});
  const h = harness('microphone');
  const starting = h.dictation.start(20);
  const stopping = h.dictation.stop();
  await Promise.all([starting, stopping]);
  assert.equal(starts, 0);
  assert.equal(h.calls.filter(call => call.method === 'captureTarget').length, 0);
  assert.equal(h.dictation.active, false);
  assert.equal(h.state.dictation.status, 'idle');
});

test('a new start waits for pending stop cleanup before arming the next session', async () => {
  const h = harness();
  const firstArm = deferred<Record<string, never>>();
  let armCount = 0;
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    if (method === 'armDictation' && ++armCount === 1) {
      h.calls.push({ method, params });
      return await firstArm.promise as T;
    }
    return request<T>(method, params);
  };
  const firstStart = h.dictation.start();
  const stopping = h.dictation.stop();
  const nextStart = h.dictation.start();
  await tick();
  firstArm.resolve({});
  await Promise.all([firstStart, stopping, nextStart]);
  assert.equal(h.dictation.active, true);
  assert.equal(h.state.dictation.status, 'armed');
  assert.deepEqual(h.calls.map(call => call.method), ['armDictation', 'disarmDictation', 'armDictation']);
  await h.dictation.stop();
});

test('stop during ring-recording target capture ignores the late target and listening status', async () => {
  const h = harness('ring-recording');
  const capture = deferred<Record<string, unknown>>();
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    if (method === 'captureTarget') { h.calls.push({ method, params }); return await capture.promise as T; }
    return request<T>(method, params);
  };
  await h.dictation.start();
  const triggering = h.dictation.trigger('start');
  await tick();
  await h.dictation.stop();
  capture.resolve(h.target);
  await triggering;
  assert.equal(h.dictation.active, false);
  assert.equal(h.state.dictation.status, 'idle');
  assert.equal(h.state.dictation.targetLabel, '');
});

test('an aborted old file transcription cannot fail a newly armed session', async () => {
  const h = harness('ring-recording');
  const entered = deferred<void>();
  const transcription = deferred<string>();
  h.ports.sync = async () => { h.dictation.file(file('fresh-ring', Date.now() / 1000)); };
  h.ports.transcribe = async () => { entered.resolve(); return transcription.promise; };
  await h.dictation.start();
  await h.dictation.trigger('start');
  const oldCycle = h.dictation.trigger('stop');
  await entered.promise;
  await h.dictation.stop();
  await h.dictation.start();
  transcription.reject(new Error('The old request was aborted'));
  await oldCycle;
  assert.equal(h.dictation.active, true);
  assert.equal(h.state.dictation.status, 'armed');
  assert.equal(h.state.dictation.error, undefined);
  await h.dictation.stop();
});

test('open-project dictation writes to the selected editor without an assistant connection', async t => {
  const h = ringHarness(t);
  h.state.destination = 'project';
  h.state.settings.insertAtCursor = false;
  assert.equal(h.state.claude, undefined);
  assert.equal(h.state.codex, undefined);
  await h.dictation.start(0);
  await h.dictation.trigger('start');
  h.stream().committed('Review our current changes.');
  await h.release();
  await h.dictation.stop();
  const writes = h.calls.filter(call => call.method === 'insertText');
  assert.deepEqual(writes.map(call => call.params), [{ target: h.target, text: 'Review our current changes.' }]);
  assert.equal(h.state.voiceDrafts, undefined);
  assert.equal(h.state.settings.insertAtCursor, false);
  h.state.destination = 'cursor';
  await h.dictation.start(0);
  assert.equal(h.state.dictation.insertAtCursor, false);
  await h.dictation.stop();
});

test('a completed live ring transcript survives an unavailable recording file', async t => {
  const h = ringHarness(t);
  h.ports.sync = async () => { throw new Error('Ring offline'); };
  const upload = t.mock.method(h.ports, 'transcribe');
  await h.dictation.start();
  assert.deepEqual(h.calls[0].params, { liveRingAudio: true });
  await h.dictation.trigger('start');
  h.stream().committed('Words from the ring.');
  await h.release(false);
  assert.equal(upload.mock.callCount(), 0);
  assert.equal(h.state.transcript.committed, 'Words from the ring.');
  assert.equal(h.calls.filter(call => call.method === 'insertText').length, 1);
  assert.equal(h.state.dictation.status, 'armed');
  await h.dictation.stop();
});

test('ring speech revises its caption and types each confirmed phrase once before release', async t => {
  const h = ringHarness(t);
  const upload = t.mock.method(h.ports, 'transcribe');
  await h.dictation.start();
  await h.dictation.trigger('start');
  const speech = h.stream();
  speech.partial('Re');
  speech.partial('Revised');
  await tick();
  assert.deepEqual(h.state.transcript, { committed: '', partial: 'Revised' });
  assert.deepEqual(h.insertions(), []);

  speech.committed('Ready.');
  await tick();
  assert.equal(h.state.dictation.status, 'listening');
  assert.deepEqual(h.insertions(), ['Ready.']);
  speech.partial('Set');
  speech.committed('Second phrase.');
  await tick();
  assert.deepEqual(h.insertions(), ['Ready.', ' Second phrase.']);
  await h.release();
  assert.deepEqual(h.state.transcript, { committed: 'Ready. Second phrase.', partial: '' });
  assert.deepEqual(h.insertions(), ['Ready.', ' Second phrase.']);
  assert.equal(upload.mock.callCount(), 0);
  await h.dictation.stop();
});

test('ring speech waits for an outstanding cursor capture and inserts early words in order', async t => {
  const h = ringHarness(t);
  const capture = deferred<typeof h.target>();
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    if (method === 'captureTarget') return await capture.promise as T;
    return request<T>(method, params);
  };
  await h.dictation.start();
  const recording = h.dictation.trigger('start');
  const speech = h.stream();
  speech.committed('Already speaking.');
  speech.committed('Still recording.');
  await tick();
  assert.deepEqual(h.insertions(), []);
  capture.resolve(h.target);
  await recording;
  await tick();
  assert.equal(h.state.dictation.status, 'listening');
  assert.equal(h.insertions().join(''), 'Already speaking. Still recording.');
  await h.release();
  assert.equal(h.insertions().join(''), 'Already speaking. Still recording.');
  await h.dictation.stop();
});

test('after a rejected native write ring dictation keeps speech without retargeting the next field', async t => {
  const h = ringHarness(t);
  let fieldChanged = false;
  const request = h.ports.request;
  h.ports.request = async <T>(method: string, params?: Record<string, unknown>) => {
    const usual = await request<T>(method, params);
    if (fieldChanged && method === 'insertText') return { inserted: false, reason: 'Focused field changed' } as T;
    return usual;
  };
  await h.dictation.start();
  await h.dictation.trigger('start');
  const speech = h.stream();
  speech.committed('In the editor.');
  await tick();
  fieldChanged = true;
  speech.committed('Changed field.');
  await tick();
  assert.match(h.state.dictation.cursorNotice || '', /Focused field changed/);
  speech.committed('Keep this too.');
  await h.release();
  assert.deepEqual(h.insertions(), ['In the editor.', ' Changed field.']);
  assert.equal(h.calls.filter(call => call.method === 'captureTarget').length, 1);
  assert.equal(h.state.transcript.committed, 'In the editor. Changed field. Keep this too.');
  await h.dictation.stop();
});

test('an interrupted live stream uses the matching saved recording exactly once', async t => {
  const h = harness('ring-recording');
  h.ports.decodeRingAudio = () => {};
  const upload = t.mock.method(h.ports, 'transcribe');
  const sync = t.mock.method(h.ports, 'sync');
  await h.dictation.start();
  await h.dictation.trigger('start');
  h.dictation.liveRingTake!.fail('Incomplete ring audio');
  const fresh = file('this-take', Date.now() / 1000);
  h.dictation.file(fresh);
  h.dictation.file(fresh);
  await Promise.all([h.dictation.trigger('stop'), h.dictation.trigger('stop')]);
  assert.equal(upload.mock.callCount(), 1);
  assert.equal(upload.mock.calls[0].arguments[0], fresh);
  assert.equal(sync.mock.callCount(), 0);
  assert.equal(h.state.transcript.committed, 'Test transcript');
  assert.equal(h.calls.filter(call => call.method === 'insertText').length, 1);
  await h.dictation.stop();
});
