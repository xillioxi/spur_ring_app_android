import { access, copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const documents = ['PROTOCOL_LIVE.md', 'PROTOCOL_AUTH.md', 'PROTOCOL_RECORDINGS.md', 'THIRD_PARTY.md'];

async function collect(destination) {
  const licenses = path.join(destination, 'licenses');
  await mkdir(licenses, { recursive: true });
  for (const name of ['react', 'react-dom', 'ws', 'electron']) {
    const directory = path.join(project, 'node_modules', name);
    for (const entry of await readdir(directory)) {
      if (/^(license|copying|copyright)(\.|$)/i.test(entry)) {
        await copyFile(path.join(directory, entry), path.join(licenses, `${name}-${entry}`));
      }
    }
  }
  const chromium = path.join(project, 'node_modules/electron/dist/LICENSES.chromium.html');
  await access(chromium);
  await copyFile(chromium, path.join(licenses, 'Electron-LICENSES.chromium.html'));
  await copyFile(path.join(project, 'README.md'), path.join(destination, 'README.md'));
  for (const name of documents) {
    await copyFile(path.join(project, '../spur-ring-windows', name), path.join(destination, name));
  }
  const manifest = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
  await writeFile(path.join(destination, 'runtime-versions.json'), JSON.stringify({
    app: manifest.version, runtime: manifest.dependencies, tooling: manifest.devDependencies,
  }, null, 2) + '\n');
}

/** Runs before signing and DMG generation, so signed bundles are never patched. */
export default async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    const bundle = `${context.packager.appInfo.productFilename}.app`;
    await collect(path.join(context.appOutDir, bundle, 'Contents/Resources'));
  } else if (context.electronPlatformName === 'win32') {
    await collect(context.appOutDir);
  }
}

async function packagedDestinations() {
  const release = path.join(project, 'release');
  const result = [];
  let entries;
  try { entries = await readdir(release, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(release, entry.name);
    if (/^win(?:-[\w]+)?-unpacked$/.test(entry.name)) {
      result.push({ destination: directory, platform: 'win32' });
    } else if (/^mac(?:-(?:arm64|x64))?$/.test(entry.name)) {
      for (const app of await readdir(directory, { withFileTypes: true })) {
        if (app.isDirectory() && app.name.endsWith('.app')) {
          result.push({ destination: path.join(directory, app.name, 'Contents/Resources'), platform: 'darwin' });
        }
      }
    }
  }
  return result;
}

async function verify(destination) {
  for (const name of ['README.md', ...documents, 'runtime-versions.json', 'licenses/Electron-LICENSES.chromium.html']) {
    await access(path.join(destination, name));
  }
  for (const name of ['react', 'react-dom', 'ws', 'electron']) {
    const files = await readdir(path.join(destination, 'licenses'));
    if (!files.some(file => file.startsWith(`${name}-`))) throw new Error(`Missing ${name} license in ${destination}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--verify')) throw new Error('Usage: node scripts/collect-notices.mjs [--verify]');
  const destinations = await packagedDestinations();
  if (!destinations.length) throw new Error('No packaged Windows or macOS app found under release/.');
  for (const { destination, platform } of destinations) {
    // Preserve the existing Windows post-package command. macOS content was
    // included by afterPack; touching it after signing would break the signature.
    if (!args.includes('--verify') && platform === 'win32') await collect(destination);
    await verify(destination);
    console.log(`Notices verified: ${destination}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
