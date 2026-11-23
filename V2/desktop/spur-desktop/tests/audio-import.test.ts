import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { importAudio, importedAudio } from '../electron/audio-import';

test('AIZO exports retain bytes and names, deduplicate copies and reject invalid audio', async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'spur-import-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'library');
  const source = path.join(temp, 'Voice.WAV');
  const renamed = path.join(temp, 'copy.wav');
  const wav = Buffer.from('524946462600000057415645666d74201000000001000100803e0000007d00000200100064617461020000000000', 'hex');
  await writeFile(source, wav);
  await writeFile(renamed, wav);
  assert.equal(await importAudio(source, root), true);
  assert.equal(await importAudio(renamed, root), false);
  const files = await importedAudio(root);
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'Voice.WAV');
  assert.deepEqual(await readFile(files[0].path), wav);
  await writeFile(renamed, 'bad contents');
  await assert.rejects(importAudio(renamed, root), /contents/);
  assert.equal((await readdir(root)).length, 1);
});
