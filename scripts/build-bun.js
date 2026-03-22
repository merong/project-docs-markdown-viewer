#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dir, '..');
const distDir = path.join(projectRoot, 'dist');
const mainScript = path.join(projectRoot, 'src', 'server.js');

const isWindows = process.platform === 'win32';
const outputName = isWindows ? 'mdview.exe' : 'mdview';
const outputPath = path.join(distDir, outputName);

const assets = {
  rendererJs:  path.join(projectRoot, 'vendor', 'markdown-renderer.js'),
  rendererCss: path.join(projectRoot, 'vendor', 'markdown-renderer.css'),
  mermaidJs:   path.join(projectRoot, 'vendor', 'mermaid.min.js'),
  viewerCss:   path.join(projectRoot, 'src', 'public', 'viewer.css'),
  viewerAppJs: path.join(projectRoot, 'src', 'public', 'viewer-app.js'),
};

for (const [key, filePath] of Object.entries(assets)) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing asset '${key}': ${filePath}`);
  }
}

if (!fs.existsSync(mainScript)) {
  fail(`Missing main script: ${mainScript}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Generate temp entry: inline assets as string constants, then static import server.js
const tempEntry = path.join(distDir, '_entry.js');
const assetInlines = Object.entries(assets).map(([key, filePath]) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const escaped = JSON.stringify(content);
  return `globalThis.__MDVIEW_ASSETS__ = globalThis.__MDVIEW_ASSETS__ || {};\nglobalThis.__MDVIEW_ASSETS__['${key}'] = ${escaped};`;
}).join('\n');

const relativeMain = path.relative(distDir, mainScript);
const entryContent = `${assetInlines}\nawait import('${relativeMain}');\n`;
fs.writeFileSync(tempEntry, entryContent);

const result = spawnSync('bun', [
  'build',
  tempEntry,
  '--compile',
  '--outfile', outputPath,
], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  fail('bun build --compile failed');
}

safeUnlink(tempEntry);

if (!isWindows) {
  fs.chmodSync(outputPath, 0o755);
}

process.stdout.write([
  'Bun build completed.',
  `Output: ${outputPath}`,
  `Platform: ${os.platform()} ${os.arch()}`,
].join('\n') + '\n');

function fail(message) {
  process.stderr.write(`build error: ${message}\n`);
  process.exit(1);
}

function safeUnlink(targetPath) {
  try { fs.unlinkSync(targetPath); } catch { /* ignore */ }
}
