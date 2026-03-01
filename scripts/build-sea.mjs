#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const isWindows = process.platform === 'win32';
const outputName = isWindows ? 'mdview.exe' : 'mdview';
const outputPath = path.join(distDir, outputName);
const blobPath = path.join(distDir, 'sea-prep.blob');
const seaConfigPath = path.join(distDir, 'sea-config.json');
const bundlePath = path.join(distDir, 'sea-entry.cjs');

const mainScript = path.join(projectRoot, 'src', 'server.js');

const assets = {
  renderer_js: path.join(projectRoot, 'vendor', 'markdown-renderer.js'),
  renderer_css: path.join(projectRoot, 'vendor', 'markdown-renderer.css'),
  mermaid_js: path.join(projectRoot, 'vendor', 'mermaid.min.js'),
  viewer_css: path.join(projectRoot, 'src', 'public', 'viewer.css'),
  viewer_app_js: path.join(projectRoot, 'src', 'public', 'viewer-app.js')
};

for (const [key, value] of Object.entries(assets)) {
  if (!fs.existsSync(value)) {
    fail(`Missing asset '${key}': ${value}`);
  }
}

if (!fs.existsSync(mainScript)) {
  fail(`Missing main script: ${mainScript}`);
}

// Keep output contract strict: dist contains a single executable only.
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

run('npx', [
  'esbuild',
  mainScript,
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node24',
  '--outfile=' + bundlePath
], projectRoot);

const seaConfig = {
  main: bundlePath,
  output: blobPath,
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  assets
};

fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

run(process.execPath, ['--experimental-sea-config', seaConfigPath], projectRoot);

if (fs.existsSync(outputPath)) {
  try {
    fs.chmodSync(outputPath, 0o755);
  } catch {
    // Ignore chmod failures and try unlink directly.
  }
  fs.unlinkSync(outputPath);
}

fs.copyFileSync(process.execPath, outputPath);
fs.chmodSync(outputPath, 0o755);

if (process.platform === 'darwin') {
  run('codesign', ['--remove-signature', outputPath], projectRoot, true);
}

const postjectArgs = [
  'postject',
  outputPath,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
];

if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}

run('npx', postjectArgs, projectRoot);

if (process.platform === 'darwin') {
  run('codesign', ['--sign', '-', '--force', outputPath], projectRoot, true);
}

if (!isWindows) {
  fs.chmodSync(outputPath, 0o755);
}

// Remove intermediate SEA artifacts so distribution remains a single binary.
safeUnlink(bundlePath);
safeUnlink(blobPath);
safeUnlink(seaConfigPath);

process.stdout.write([
  'SEA build completed.',
  `Output: ${outputPath}`,
  `Platform: ${os.platform()} ${os.arch()}`
].join('\n') + '\n');

function run(command, args, cwd, ignoreFailure = false) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0 && !ignoreFailure) {
    fail(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function fail(message) {
  process.stderr.write(`build:sea error: ${message}\n`);
  process.exit(1);
}

function safeUnlink(targetPath) {
  try {
    fs.unlinkSync(targetPath);
  } catch {
    // Ignore cleanup failures.
  }
}
