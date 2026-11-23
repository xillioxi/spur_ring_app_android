import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverRings } from '../electron/discovery';
import type { RingDevice } from '../src/types';

const ring: RingDevice = { id: 'test-ring', name: 'AIZO-RING', compatible: true, rssi: -94 };

test('a weak compatible ring is returned immediately', async () => {
  assert.deepEqual(await discoverRings(async () => [ring], () => assert.fail('unexpected retry')), [ring]);
});

test('an empty scan gets one more opportunity to receive an advertisement', async () => {
  for (const second of [[], [ring]]) {
    const scans = [[], second];
    let retries = 0;
    assert.deepEqual(await discoverRings(async () => scans.shift()!, () => { retries++; }), second);
    assert.equal(retries, 1);
    assert.equal(scans.length, 0);
  }
});

test('adapter errors reach the caller immediately', async () => {
  await assert.rejects(discoverRings(async () => { throw new Error('Bluetooth off'); }, () => assert.fail('unexpected retry')), /Bluetooth off/);
});
