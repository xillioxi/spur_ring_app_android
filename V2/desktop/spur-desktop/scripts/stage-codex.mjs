// Stage an explicitly installed native distribution from the pinned official release.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.argv[2] || '../../../.build-tools/codex-runtime/node_modules/@openai/codex-win32-x64');
const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const targets = {
  '0.172.0-win32-x64': 'x86_64-pc-windows-msvc',
  '0.172.0-darwin-arm64': 'aarch64-apple-darwin',
  '0.172.0-darwin-x64': 'x86_64-apple-darwin',
};
const target = targets[metadata.version];
if (metadata.name !== '@openai/codex' || !target) throw new Error('Expected a pinned official Codex 0.172.0 native package.');
const destination = process.argv[3] ? path.resolve(process.argv[3]) : path.join(project, 'resources/codex');
await mkdir(destination, { recursive: true });
await cp(path.join(source, 'vendor', target), destination, { recursive: true, verbatimSymlinks: true });
for (const name of ['LICENSE', 'NOTICE']) {
  const response = await fetch(`https://raw.githubusercontent.com/openai/codex/rust-v0.172.0/${name}`);
  if (!response.ok) throw new Error(`Could not obtain Codex ${name}: ${response.status}`);
  await writeFile(path.join(destination, name), await response.text());
}
await writeFile(path.join(destination, 'source.json'), JSON.stringify({ version: '0.172.0', source: 'https://github.com/openai/codex/tree/rust-v0.172.0', package: '@openai/codex@0.172.0', license: 'Apache-2.0' }, null, 2));
console.log('Staged Codex 0.172.0 with runtime resources and notices.');
