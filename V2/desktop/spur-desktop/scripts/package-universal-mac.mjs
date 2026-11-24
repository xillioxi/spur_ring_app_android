import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Arch } from 'builder-util';
import plist from 'plist';
import collectNotices from './collect-notices.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const architectures = ['x64', 'arm64'];
const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));
const run = (cmd, args, options) => execFileSync(cmd, args, { stdio: 'inherit', cwd: project, ...options });

// electron-builder calls this hook twice on thin intermediate apps, then on
// the merged app before signing. Keep native sidecars intact, including
// PyInstaller's appended Python archive, framework symlinks and SDK signatures.
export default async function afterPack(context) {
  if (context.arch !== Arch.universal) return;
  await collectNotices(context);
  const resources = path.join(context.appOutDir, 'Spur Desktop.app/Contents/Resources');
  for (const arch of architectures) {
    const payload = path.join(process.env.SPUR_MAC_NATIVE_ROOT, arch);
    for (const group of ['ring-service', 'codex', 'claude']) {
      const destination = group === 'claude'
        ? path.join(resources, 'app.asar.unpacked/node_modules/@anthropic-ai', 'claude-agent-sdk-darwin-' + arch)
        : path.join(resources, group, arch);
      mkdirSync(path.dirname(destination), { recursive: true });
      renameSync(path.join(payload, group, arch), destination);
    }
  }
}

async function main() {
  if (process.platform !== 'darwin' || process.argv.length !== 4) {
    throw new Error('On a Mac run node scripts/package-universal-mac.mjs native-x64.tar native-arm64.tar');
  }
  const archives = process.argv.slice(2).map(value => path.resolve(value));
  const buildRoot = path.join(project, 'build');
  mkdirSync(buildRoot, { recursive: true });
  const temporary = mkdtempSync(path.join(buildRoot, 'universal-'));
  try {
    const version = readJSON(path.join(project, 'package.json')).version;
    for (const [index, arch] of architectures.entries()) {
      const stage = path.join(temporary, arch);
      mkdirSync(stage);
      run('tar', ['-xf', archives[index], '-C', stage]);
      const stamp = readJSON(path.join(stage, 'ring-service', arch, 'native-build.json'));
      if (stamp.arch !== arch || stamp.version !== version || (process.env.GITHUB_SHA && stamp.commit !== process.env.GITHUB_SHA)) {
        throw new Error('Native payload belongs to a different architecture or build: ' + arch);
      }
    }
    const config = readJSON(path.join(project, 'electron-builder.json'));
    // Native Claude distributions are provided by the post-merge hook at
    // the external path used by the SDK launcher. The JS SDK stays in app.asar.
    config.files.push('!**/node_modules/@anthropic-ai/claude-agent-sdk-*/**/*');
    config.asarUnpack = [];
    config.extraResources = [];
    config.afterPack = './scripts/package-universal-mac.mjs';
    config.publish = null;
    const entitlements = path.join(temporary, 'entitlements.plist');
    writeFileSync(entitlements, plist.build({
      'com.apple.security.cs.allow-jit': true,
      'com.apple.security.device.audio-input': true,
      'com.apple.security.device.bluetooth': true,
    }));
    Object.assign(config.mac, {
      identity: '-', forceCodeSigning: true, hardenedRuntime: false, notarize: false,
      binaries: [], entitlements, entitlementsInherit: entitlements,
      // These executables were signed before staging. Their embedded payloads
      // include executable data that vendor-specific signers lay out.
      signIgnore: ['/Contents/Resources/(ring-service|codex|app[.]asar[.]unpacked)/'],
    });
    const configuration = path.join(temporary, 'electron-builder.json');
    writeFileSync(configuration, JSON.stringify(config));
    run(process.execPath, ['node_modules/electron-builder/cli.js', '--mac', 'dmg', '--universal', '--config', configuration, '--publish', 'never'],
      { env: { ...process.env, SPUR_MAC_NATIVE_ROOT: temporary } });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
