const fs = require('fs');
const path = require('path');

const candidates = [
  '/opt/homebrew/opt/node@20/bin/node',
  '/opt/homebrew/bin/node',
  '/usr/local/bin/node'
];
const nodeBinary = candidates.find(fs.existsSync);

if (!nodeBinary) {
  throw new Error(`Android Gradle requires an absolute Node path. Checked: ${candidates.join(', ')}`);
}

const gradleFiles = [
  'node_modules/expo/android/build.gradle',
  'node_modules/expo-av/android/build.gradle'
];

for (const relativeFile of gradleFiles) {
  const file = path.join(__dirname, '..', relativeFile);
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, 'utf8');
  const patched = original
    .replaceAll('commandLine("node",', `commandLine("${nodeBinary}",`)
    .replaceAll("commandLine('node',", `commandLine('${nodeBinary}',`)
    .replaceAll('commandLine("/opt/homebrew/bin/node",', `commandLine("${nodeBinary}",`)
    .replaceAll("commandLine('/opt/homebrew/bin/node',", `commandLine('${nodeBinary}',`);

  if (patched !== original) fs.writeFileSync(file, patched);
}

console.log(`[android-node] Gradle Node binary: ${nodeBinary}`);
