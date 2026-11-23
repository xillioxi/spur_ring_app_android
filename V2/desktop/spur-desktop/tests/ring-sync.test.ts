import assert from 'node:assert/strict';
import test from 'node:test';
import { syncRingRecordings } from '../electron/ring-sync';
import type { Recording, RingDevice } from '../src/types';

const selected: RingDevice = { id: 'AA:BB:CC:DD:EE:FF', name: 'AIZO RING', compatible: true, rssi: -70 };
const file: Recording = { id: 'first', name: 'first.ogg', path: 'first.ogg', timestamp: 100, size: 48 };
type Context = Parameters<typeof syncRingRecordings>[0];

function context(): Context {
  return {
    state: { busy: null, recordings: [], ringName: '', lastSync: 'previous attempt', progress: 100 },
    async request() { throw new Error('Unexpected service request'); },
    async refreshLibrary() {}, changed() {}, log() {},
  };
}

test('connect and sync hands the selected address to one native job and counts newly saved files', async () => {
  const ports = context();
  let calls = 0;
  ports.request = async (method, params, timeout) => {
    assert.equal(method, 'connectAndSync');
    assert.deepEqual(params, { address: selected.id });
    assert.equal(timeout, null);
    assert.equal(ports.state.busy, 'syncing recordings');
    assert.equal(ports.state.lastSync, undefined);
    assert.equal(ports.state.progress, 0);
    calls++;
    return { received: 1 };
  };
  ports.refreshLibrary = async () => { ports.state.recordings = calls ? [file] : []; };
  await syncRingRecordings(ports, selected);
  assert.equal(calls, 1);
  assert.equal(ports.state.ringAddress, selected.id);
  assert.match(ports.state.lastSync!, /Received 1 recording.*1 new/);
  assert.equal(ports.state.busy, null);
});

test('a connected ring uses its existing session and preserves native queue notices', async () => {
  const ports = context();
  ports.request = async (method, params, timeout) => {
    assert.equal(method, 'syncRecordings');
    assert.deepEqual(params, {});
    assert.equal(timeout, null);
    return { received: 0, notice: 'The stored recording queue is empty. Real-time queue unverified.' };
  };
  await syncRingRecordings(ports);
  assert.match(ports.state.lastSync!, /Real-time queue unverified/);
});

test('failed reconnect refreshes completed files, clears retry status and permits another sync', async () => {
  const ports = context();
  let transferStarted = false;
  ports.request = async () => {
    transferStarted = true;
    ports.state.syncRetryAddress = selected.id;
    throw new Error('The ring disconnected during transfer.');
  };
  ports.refreshLibrary = async () => { ports.state.recordings = transferStarted ? [file] : []; };
  await assert.rejects(syncRingRecordings(ports, selected), /disconnected during transfer/);
  assert.deepEqual(ports.state.recordings, [file]);
  assert.equal(ports.state.busy, null);
  assert.equal(ports.state.lastSync, undefined);
  assert.equal(ports.state.syncRetryAddress, undefined);
  ports.request = async () => ({ received: 1 });
  await syncRingRecordings(ports, selected);
  assert.match(ports.state.lastSync!, /0 new/);
});

test('an existing operation keeps its lock and selected address', async () => {
  const ports = context();
  ports.state.busy = 'scanning';
  await assert.rejects(syncRingRecordings(ports, selected), /scanning/);
  assert.equal(ports.state.busy, 'scanning');
  assert.equal(ports.state.ringAddress, undefined);
});
