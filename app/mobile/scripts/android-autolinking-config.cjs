const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const shortProjectRoot = path.resolve(process.argv[2]);
const canonicalProjectRoot = fs.realpathSync.native(shortProjectRoot);

const result = spawnSync(
  process.execPath,
  [
    '--no-warnings',
    '--eval',
    "require('expo/bin/autolinking')",
    'expo-modules-autolinking',
    'react-native-config',
    '--platform',
    'android',
    '--json',
    '--project-root',
    shortProjectRoot,
    '--source-dir',
    path.join(shortProjectRoot, 'android'),
  ],
  {
    cwd: shortProjectRoot,
    encoding: 'utf8',
    env: process.env,
  }
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Expo autolinking failed.\n');
  process.exit(result.status || 1);
}

const replaceCanonicalRoot = (value) => {
  if (typeof value === 'string') {
    return value
      .replaceAll(canonicalProjectRoot, shortProjectRoot)
      .replaceAll(
        canonicalProjectRoot.replaceAll('\\', '/'),
        shortProjectRoot.replaceAll('\\', '/')
      );
  }
  if (Array.isArray(value)) return value.map(replaceCanonicalRoot);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceCanonicalRoot(item)])
    );
  }
  return value;
};

const config = replaceCanonicalRoot(JSON.parse(result.stdout));
process.stdout.write(JSON.stringify(config));
