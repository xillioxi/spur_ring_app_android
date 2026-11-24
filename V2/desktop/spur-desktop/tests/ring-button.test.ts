import assert from 'node:assert/strict';
import test from 'node:test';
import { RingButton } from '../electron/ring-button';

type Ports = ConstructorParameters<typeof RingButton>[0];
type Source = ReturnType<Ports['current']>['source'];
type Status = Parameters<Ports['status']>[0];

function harness() {
  const state: ReturnType<Ports['current']> = { paused: false, canConfigure: false };
  const calls: { source: Source; finish(): void; fail(error: Error): void }[] = [];
  let status: Status;
  let message: string | undefined;
  const button = new RingButton({
    current: () => state,
    configure: source => new Promise<void>((finish, fail) => calls.push({ source, finish, fail })),
    status(value, detail) { status = value; message = detail; },
  });
  function set(values: Partial<typeof state>) {
    Object.assign(state, values);
    button.refresh();
  }
  return { button, calls, set, status: () => status, message: () => message };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('waits for an authenticated link, configured ring source and a free connection before subscribing once', async () => {
  const h = harness();
  h.set({ canConfigure: true });
  h.set({ link: 'A' });
  assert.equal(h.status(), undefined);
  assert.equal(h.button.acceptsPress, false);
  h.set({ source: 'ring', canConfigure: false });
  assert.equal(h.status(), 'preparing');
  assert.equal(h.calls.length, 0);
  h.set({ canConfigure: true });
  h.button.refresh();
  assert.deepEqual(h.calls.map(call => call.source), ['ring']);
  assert.equal(h.button.acceptsPress, true, 'native presses can precede the arm reply');
  h.calls[0].finish();
  await settle();
  assert.equal(h.status(), 'ready');
  h.set({ canConfigure: false });
  assert.equal(h.button.acceptsPress, true, 'a busy connection keeps its existing subscription');
  assert.equal(h.calls.length, 1);
});

test('serializes a source change with the pending arm and ignores events for the former source', async () => {
  const h = harness();
  h.set({ link: 'A', canConfigure: true, source: 'ring' });
  h.set({ source: 'ring-recording' });
  assert.equal(h.button.acceptsPress, false);
  assert.equal(h.calls.length, 1);
  h.calls[0].finish();
  await settle();
  assert.deepEqual(h.calls.map(call => call.source), ['ring', 'ring-recording']);
  assert.equal(h.button.acceptsPress, true);
  h.calls[1].finish();
  await settle();
  assert.equal(h.status(), 'ready');
  h.set({ source: undefined });
  assert.equal(h.button.acceptsPress, false);
  assert.equal(h.calls[2].source, undefined);
});

test('pausing immediately blocks presses while the native arm settles and resuming waits for disarm', async () => {
  const h = harness();
  h.set({ link: 'A', canConfigure: true, source: 'ring-recording' });
  h.set({ paused: true });
  assert.equal(h.status(), 'paused');
  assert.equal(h.button.acceptsPress, false);
  h.calls[0].finish();
  await settle();
  assert.equal(h.calls[1].source, undefined);
  h.button.nativeDisarmed();
  h.set({ paused: false });
  assert.equal(h.button.acceptsPress, false);
  h.calls[1].finish();
  await settle();
  assert.equal(h.calls[2].source, 'ring-recording');
  assert.equal(h.button.acceptsPress, true);
  h.calls[2].finish();
  await settle();
  assert.equal(h.status(), 'ready');
});

test('a stale reply from the old connection never arms the reconnected ring', async () => {
  const h = harness();
  h.set({ link: 'A', canConfigure: true, source: 'ring' });
  h.set({ link: undefined });
  assert.equal(h.status(), undefined);
  h.set({ link: 'A' });
  assert.equal(h.button.acceptsPress, false);
  h.calls[0].fail(new Error('old link disconnected'));
  await settle();
  assert.deepEqual(h.calls.map(call => call.source), ['ring', 'ring']);
  assert.equal(h.status(), 'preparing');
  h.calls[1].finish();
  await settle();
  assert.equal(h.status(), 'ready');
  assert.equal(h.message(), undefined);
});

test('a reported native disarm invalidates an outstanding successful arm reply', async () => {
  const h = harness();
  h.set({ link: 'A', canConfigure: true, source: 'ring' });
  h.set({ canConfigure: false });
  h.button.nativeDisarmed();
  assert.equal(h.button.acceptsPress, false);
  h.calls[0].finish();
  await settle();
  assert.equal(h.button.acceptsPress, false);
  assert.equal(h.status(), 'preparing');
  h.set({ canConfigure: true });
  assert.deepEqual(h.calls.map(call => call.source), ['ring', 'ring']);
  h.calls[1].finish();
  await settle();
  assert.equal(h.status(), 'ready');
});

test('preserves the native error across refreshes and issues a new request on explicit retry', async () => {
  const h = harness();
  h.set({ link: 'A', canConfigure: true, source: 'ring' });
  h.calls[0].fail(new Error('Touch reporting timed out.'));
  await settle();
  h.button.refresh();
  assert.equal(h.status(), 'error');
  assert.equal(h.message(), 'Touch reporting timed out.');
  assert.equal(h.button.acceptsPress, false);
  assert.equal(h.calls.length, 1);
  h.button.retry();
  assert.equal(h.status(), 'preparing');
  assert.equal(h.message(), undefined);
  h.calls[1].finish();
  await settle();
  assert.equal(h.button.acceptsPress, true);
  assert.equal(h.status(), 'ready');
});
