import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRingLabels, ringLabelEntry } from '../electron/ring-labels';

test('ring labels use the Bluetooth address even when names match or are missing', () => {
  assert.deepEqual(readRingLabels({
    'aa:00:00:00:00:10': '  工作戒指  ',
    'aa:00:00:00:00:11': 'Travel ring',
    'aa:00:00:00:00:12': '',
  }), {
    'AA:00:00:00:00:10': '工作戒指',
    'AA:00:00:00:00:11': 'Travel ring',
  });
  assert.deepEqual(ringLabelEntry('aa:00:00:00:00:10', '  '), ['AA:00:00:00:00:10', '']);
});

test('only valid Windows ring addresses and single-line names can be saved', () => {
  const address = 'AA:00:00:00:00:10';
  assert.throws(() => ringLabelEntry('__proto__', 'Work'));
  assert.throws(() => ringLabelEntry(address, 'Work\nring'));
  assert.throws(() => ringLabelEntry(address, 'x'.repeat(65)));
  assert.equal(ringLabelEntry(address, 'x'.repeat(64))[1].length, 64);
});
