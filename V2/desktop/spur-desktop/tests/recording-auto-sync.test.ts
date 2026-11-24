import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { RecordingAutoSync } from '../electron/recording-auto-sync';

const address = 'AA:BB:CC:DD:EE:01';

function harness(t: TestContext, download: () => Promise<number> = async () => 1) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const calls: boolean[] = [];
  const state = { idle: true };
  const auto = new RecordingAutoSync({
    canSync: id => id === address && state.idle,
    download: async (_id, inventory) => { calls.push(inventory); return download(); },
    failed() {},
  });
  const advance = async (ms: number) => {
    t.mock.timers.tick(ms);
    await new Promise<void>(resolve => setImmediate(resolve));
  };
  return { auto, calls, state, advance };
}

test('bursts of ready notifications wait for the ring and share one transfer', async t => {
  const { auto, calls, state, advance } = harness(t);
  auto.request(address, 'finished');
  await advance(300);
  auto.request(address, 'finished');
  state.idle = false;
  auto.refresh();
  await advance(3000);
  assert.deepEqual(calls, []);
  state.idle = true;
  auto.refresh();
  await advance(1);
  assert.deepEqual(calls, [false]);
});

test('a recording completed during a download gets one follow-up after that transfer', async t => {
  let complete!: (received: number) => void;
  const { auto, calls, advance } = harness(t, () => new Promise(resolve => { complete = resolve; }));
  auto.request(address, 'finished');
  await advance(650);
  auto.request(address, 'finished');
  auto.request(address, 'finished');
  await advance(1000);
  assert.equal(calls.length, 1);
  complete(1);
  await advance(0);
  await advance(1);
  assert.deepEqual(calls, [false, false]);
  complete(1);
});

test('only a fresh finish retries an empty queue, at most once', async t => {
  const { auto, calls, advance } = harness(t, async () => 0);
  auto.request(address, 'reconnected');
  await advance(650);
  await advance(5000);
  assert.deepEqual(calls, [true]);
  auto.request(address, 'finished');
  await advance(650);
  await advance(2000);
  await advance(20000);
  assert.deepEqual(calls, [true, false, false]);
});

test('a saved live take covers only its recording, while a manual sync covers the entire queue', async t => {
  const { auto, calls, advance } = harness(t);
  auto.request(address, 'reconnected');
  auto.request(address, 'finished');
  auto.covered(address, true);
  await advance(650);
  assert.deepEqual(calls, [true]);
  auto.request(address, 'finished');
  auto.covered(address);
  await advance(650);
  assert.deepEqual(calls, [true]);
});

test('a late empty reply from a disconnected ring never starts a retry', async t => {
  let complete!: (received: number) => void;
  const { auto, calls, advance } = harness(t, () => new Promise(resolve => { complete = resolve; }));
  auto.request(address, 'finished');
  await advance(650);
  auto.reset();
  complete(0);
  await advance(5000);
  await advance(5000);
  assert.deepEqual(calls, [false]);
});
