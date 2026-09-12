const fs = require('fs');
const path = require('path');

// npm already knows the exact Node executable that is running this script.
// NODE_BINARY can override it for IDE/CI environments. Forward slashes keep
// the generated Groovy strings valid on Windows as well as macOS/Linux.
const configuredNodeBinary =
  process.env.NODE_BINARY || process.env.npm_node_execpath || process.execPath;
const nodeBinary = configuredNodeBinary.replace(/\\/g, '/');

if (!fs.existsSync(configuredNodeBinary)) {
  throw new Error(`Android Gradle Node binary does not exist: ${configuredNodeBinary}`);
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
    .replace(/commandLine\("[^"]*node(?:\.exe)?",/g, `commandLine("${nodeBinary}",`)
    .replace(/commandLine\('[^']*node(?:\.exe)?',/g, `commandLine('${nodeBinary}',`)
    .replaceAll('commandLine("node",', `commandLine("${nodeBinary}",`)
    .replaceAll("commandLine('node',", `commandLine('${nodeBinary}',`)
    .replaceAll('commandLine("/opt/homebrew/bin/node",', `commandLine("${nodeBinary}",`)
    .replaceAll("commandLine('/opt/homebrew/bin/node',", `commandLine('${nodeBinary}',`);

  if (patched !== original) fs.writeFileSync(file, patched);
}

console.log(`[android-node] Gradle Node binary: ${nodeBinary}`);
