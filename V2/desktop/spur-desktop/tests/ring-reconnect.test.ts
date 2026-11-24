import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { isRingIdentifier, RingReconnect, type ReconnectPhase, type ReconnectResult } from '../electron/ring-reconnect';

const firstRing = 'AA:BB:CC:DD:EE:01';
const secondRing = 'AA:BB:CC:DD:EE:02';

test('restores the saved CoreBluetooth UUID on Mac and MAC address on Windows', async t => {
  const advance = clock(t);
  const id = 'b84172e1-85c2-42ad-8345-9493302ec18a';
  assert.ok(isRingIdentifier(id, 'macos'));
  assert.ok(isRingIdentifier(firstRing, 'windows'));
  assert.equal(isRingIdentifier(firstRing, 'macos'), false);
  assert.equal(isRingIdentifier(id, 'windows'), false);
  const attempts: string[] = [];
  const reconnect = new RingReconnect({ canAttempt: () => true, async connect(address) { attempts.push(address); return 'stop'; } });
  reconnect.setTarget(id);
  await advance(0);
  assert.deepEqual(attempts, [id.toUpperCase()]);
});

function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return async (ms: number) => {
    t.mock.timers.tick(ms);
    await Promise.resolve();
  };
}

test('restores only the saved address when eligible and re-arms after link loss', async t => {
  const advance = clock(t);
  const attempts: string[] = [];
  const phases: ReconnectPhase[] = [];
  let eligible = false;
  const reconnect = new RingReconnect({
    canAttempt: () => eligible,
    async connect(address) {
      attempts.push(address);
      eligible = false; // Authenticated ring now occupies the connection.
      return 'connected';
    },
    onPhase(phase) {
      phases.push(phase);
      reconnect.refresh(); // Publishing UI state may notify the controller again.
    },
  });

  reconnect.setTarget(firstRing.toLowerCase());
  await advance(60000);
  assert.deepEqual(attempts, []);
  eligible = true;
  reconnect.refresh();
  reconnect.refresh();
  await advance(0);
  assert.deepEqual(attempts, [firstRing]);
  assert.deepEqual(phases, ['waiting', 'connecting', undefined]);
  await advance(60000);
  assert.equal(attempts.length, 1);

  eligible = true;
  reconnect.refresh();
  await advance(4999);
  assert.equal(attempts.length, 1);
  await advance(1);
  assert.deepEqual(attempts, [firstRing, firstRing]);
});

test('backs off absent or unreachable rings without resetting the timer on UI updates', async t => {
  const advance = clock(t);
  let count = 0;
  const reconnect = new RingReconnect({
    canAttempt: () => true,
    async connect() {
      if (++count % 2 === 1) throw new Error('Bluetooth unavailable');
      return 'retry';
    },
  });
  reconnect.setTarget(firstRing);
  await advance(0);
  for (const delay of [5000, 15000, 30000, 60000, 60000]) {
    const before = count;
    await advance(delay - 1);
    reconnect.setTarget(firstRing);
    reconnect.refresh();
    assert.equal(count, before);
    await advance(1);
    assert.equal(count, before + 1);
  }
  reconnect.setTarget(null);
  await advance(60000);
  assert.equal(count, 6);
});

test('busy manual work preempts scheduled attempts, even when it starts at the timer deadline', async t => {
  const advance = clock(t);
  let busy = false;
  let count = 0;
  const reconnect = new RingReconnect({
    canAttempt: () => !busy,
    async connect() { count++; return 'retry'; },
  });
  reconnect.setTarget(firstRing);
  busy = true;
  await advance(0);
  assert.equal(count, 0);
  busy = false;
  reconnect.refresh();
  await advance(0);
  assert.equal(count, 1);
  busy = true;
  reconnect.refresh();
  await advance(60000);
  assert.equal(count, 1);
  busy = false;
  reconnect.refresh();
  await advance(5000);
  assert.equal(count, 2);
  reconnect.setTarget(null);
});

test('changing rings aborts the prior intent and waits for it to settle before another attempt', async t => {
  const advance = clock(t);
  const calls: { address: string; signal: AbortSignal; finish(result: ReconnectResult): void }[] = [];
  const reconnect = new RingReconnect({
    canAttempt: () => true,
    connect: (address, signal) => new Promise(resolve => calls.push({ address, signal, finish: resolve })),
  });
  reconnect.setTarget(firstRing);
  await advance(0);
  reconnect.setTarget(secondRing);
  assert.equal(calls[0].signal.aborted, true);
  reconnect.refresh();
  await advance(60000);
  assert.deepEqual(calls.map(c => c.address), [firstRing]);
  calls[0].finish('stop');
  await Promise.resolve();
  await advance(0);
  assert.deepEqual(calls.map(c => c.address), [firstRing, secondRing]);
  reconnect.setTarget(null);
  assert.equal(calls[1].signal.aborted, true);
  calls[1].finish('connected');
  await Promise.resolve();
  reconnect.refresh();
  await advance(60000);
  assert.equal(calls.length, 2);
});

test('suppresses a rejected binding until explicit reselection and ignores malformed saved addresses', async t => {
  const advance = clock(t);
  let count = 0;
  const reconnect = new RingReconnect({
    canAttempt: () => true,
    async connect() { count++; return 'stop'; },
  });
  reconnect.setTarget('AIZO RING');
  await advance(60000);
  assert.equal(count, 0);
  reconnect.setTarget(firstRing);
  await advance(0);
  reconnect.refresh();
  await advance(60000);
  assert.equal(count, 1);
  reconnect.setTarget(firstRing);
  await advance(0);
  assert.equal(count, 2);
});
