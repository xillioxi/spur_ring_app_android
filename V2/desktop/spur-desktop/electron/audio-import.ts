import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readdir, rename, rmdir, stat, unlink, utimes } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

export const audioTypes: Record<string, string> = {
  ogg: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
};

function hasAudioHeader(ext: string, data: Buffer): boolean {
  const tag = (offset: number, length: number) => data.toString('ascii', offset, offset + length);
  if (ext === 'ogg' || ext === 'opus') return tag(0, 4) === 'OggS';
  if (ext === 'm4a') return tag(4, 4) === 'ftyp';
  if (ext === 'wav') return tag(0, 4) === 'RIFF' && tag(8, 4) === 'WAVE';
  if (ext === 'aac') return data[0] === 255 && (data[1] & 0xf6) === 0xf0;
  return ext === 'mp3' && (tag(0, 3) === 'ID3' || (data[0] === 255 && (data[1] & 0xe0) === 0xe0));
}

export async function importAudio(source: string, root: string): Promise<boolean> {
  const name = path.basename(source);
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!Object.hasOwn(audioTypes, ext)) throw new Error('Choose an audio file exported from AIZO.');
  const info = await stat(source);
  if (!info.isFile() || !info.size) throw new Error(`Empty or unreadable audio file: ${name}`);
  await mkdir(root, { recursive: true });
  const staging = await mkdtemp(path.join(root, '.import-'));
  const temporary = path.join(staging, name);
  try {
    const hash = createHash('sha256');
    const reader = createReadStream(source);
    let header = Buffer.alloc(0);
    reader.on('data', (chunk: Buffer | string) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(data);
      if (header.length < 12) header = Buffer.concat([header, data.subarray(0, 12 - header.length)]);
    });
    await pipeline(reader, createWriteStream(temporary, { flags: 'wx' }));
    if (!hasAudioHeader(ext, header)) throw new Error(`The contents of ${name} do not match its audio extension.`);
    await utimes(temporary, info.atime, info.mtime);
    const destination = path.join(root, hash.digest('hex'));
    try {
      await rename(staging, destination);
    } catch (error) {
      if ((await stat(destination).catch(() => undefined))?.isDirectory()) return false;
      throw error;
    }
    return true;
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(staging).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function importedAudio(root: string) {
  const folders = await readdir(root, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || !/^[0-9a-f]{64}$/.test(folder.name)) continue;
    const dir = path.join(root, folder.name);
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !Object.hasOwn(audioTypes, path.extname(entry.name).slice(1).toLowerCase())) continue;
      const file = path.join(dir, entry.name);
      const info = await stat(file);
      files.push({ path: file, name: entry.name, size: info.size, timestamp: info.mtimeMs / 1000 });
    }
  }
  return files;
}
