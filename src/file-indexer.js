'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.idea', '.vscode', 'dist']);
const DEFAULT_DOCS_DIR_NAME = 'docs';

async function listMarkdownFiles(rootRealPath, options = {}) {
  const mode = options.mode || 'recursive';
  const docsDirName = options.docsDirName || DEFAULT_DOCS_DIR_NAME;
  const output = new Set();

  if (mode === 'cwd-and-docs') {
    await collectMarkdownFilesFromRootLevel(rootRealPath, output);
    await collectMarkdownFilesFromDocsTree(rootRealPath, docsDirName, output);
  } else {
    await walk(rootRealPath, rootRealPath, output);
  }

  return Array.from(output).sort((a, b) => a.localeCompare(b));
}

async function collectMarkdownFilesFromRootLevel(rootRealPath, output) {
  let entries;

  try {
    entries = await fs.readdir(rootRealPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!isMarkdownFileName(entry.name)) {
      continue;
    }

    output.add(entry.name);
  }
}

async function collectMarkdownFilesFromDocsTree(rootRealPath, docsDirName, output) {
  const docsAbsolute = path.join(rootRealPath, docsDirName);
  let stats;

  try {
    stats = await fs.stat(docsAbsolute);
  } catch {
    return;
  }

  if (!stats.isDirectory()) {
    return;
  }

  await walk(rootRealPath, docsAbsolute, output);
}

async function walk(rootRealPath, currentDir, output) {
  let entries;

  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) {
        await walk(rootRealPath, absolute, output);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isMarkdownFileName(entry.name)) {
      continue;
    }

    const relative = path.relative(rootRealPath, absolute).split(path.sep).join('/');
    output.add(relative);
  }
}

function isMarkdownFileName(fileName) {
  return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.md');
}

module.exports = {
  listMarkdownFiles
};
