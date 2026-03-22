#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

import { listMarkdownFiles } from './file-indexer.js';
import { resolveRoot, resolvePathInRoot, normalizeRelativePath } from './path-guard.js';
import { CurrentFileWatchHub } from './watch.js';
import { buildViewerHtml } from './viewer-template.js';

const DEFAULT_PORT = 18094;
const HOST = '127.0.0.1';

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  maybeDaemonize(cli);

  const cwd = process.cwd();
  const rootRealPath = resolveRoot(cwd, cli.root);
  const scanMode = cli.root ? 'recursive-root' : 'cwd-and-docs';

  const projectRoot = path.resolve(import.meta.dir, '..');
  const assets = loadAssets(projectRoot);

  const rootDisplayPath = makeDisplayPath(cwd, rootRealPath, scanMode);
  const viewerHtml = buildViewerHtml({
    pageTitle: 'Markdown Docs Viewer',
    rootDisplayPath,
    rendererCss: assets.rendererCss,
    viewerCss: assets.viewerCss,
    rendererJs: assets.rendererJs,
    mermaidJs: assets.mermaidJs,
    viewerAppJs: assets.viewerAppJs
  });

  const watchHub = new CurrentFileWatchHub(rootRealPath, { debounceMs: 200 });
  const server = http.createServer((req, res) => {
    handleRequest(req, res, {
      cwd,
      rootRealPath,
      rootDisplayPath,
      scanMode,
      viewerHtml,
      watchHub
    }).catch((error) => {
      sendJson(res, 500, { success: false, message: error.message || 'Internal server error' });
    });
  });

  killExistingPortListeners(cli.port);

  server.listen(cli.port, HOST, () => {
    const listenPort = getServerPort(server, cli.port);
    const viewerUrl = `http://${HOST}:${listenPort}`;

    process.stdout.write(
      [
        `mdview listening on ${viewerUrl}`,
        `Root: ${rootRealPath}`,
        scanMode === 'cwd-and-docs'
          ? 'Scan: current directory top-level .md/.MD + docs/**'
          : 'Scan: recursive under --root',
        'Press Ctrl+C to stop.'
      ].join('\n') + '\n'
    );

    openBrowser(viewerUrl);
  });

  server.on('error', (error) => {
    process.stderr.write(`Server error: ${error.message}\n`);
    process.exit(1);
  });

  installShutdownHandlers(server, watchHub);
}

function loadAssets(projectRoot) {
  const assetMap = {
    rendererJs: path.join(projectRoot, 'vendor', 'markdown-renderer.js'),
    rendererCss: path.join(projectRoot, 'vendor', 'markdown-renderer.css'),
    mermaidJs: path.join(projectRoot, 'vendor', 'mermaid.min.js'),
    viewerCss: path.join(projectRoot, 'src', 'public', 'viewer.css'),
    viewerAppJs: path.join(projectRoot, 'src', 'public', 'viewer-app.js')
  };

  return {
    rendererJs: loadTextAsset('rendererJs', assetMap.rendererJs),
    rendererCss: loadTextAsset('rendererCss', assetMap.rendererCss),
    mermaidJs: loadTextAsset('mermaidJs', assetMap.mermaidJs),
    viewerCss: loadTextAsset('viewerCss', assetMap.viewerCss),
    viewerAppJs: loadTextAsset('viewerAppJs', assetMap.viewerAppJs)
  };
}

function loadTextAsset(assetKey, diskPath) {
  const inlined = globalThis.__MDVIEW_ASSETS__?.[assetKey];
  if (inlined !== undefined) {
    return inlined;
  }
  return fs.readFileSync(diskPath, 'utf8');
}

function parseArgs(argv) {
  let port = DEFAULT_PORT;
  let root = null;
  let daemon = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    if (arg === '--port') {
      const value = argv[i + 1];
      if (!value) {
        printHelpAndExit(1, '--port requires a value.');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        printHelpAndExit(1, 'Port must be an integer between 1 and 65535.');
      }
      port = parsed;
      i += 1;
      continue;
    }

    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) {
        printHelpAndExit(1, '--root requires a value.');
      }
      root = value;
      i += 1;
      continue;
    }

    if (arg === '--daemon') {
      daemon = true;
      continue;
    }

    if (arg === '--foreground') {
      daemon = false;
      continue;
    }

    printHelpAndExit(1, `Unknown argument: ${arg}`);
  }

  return { port, root, daemon };
}

function printHelpAndExit(code, message) {
  if (message) {
    process.stderr.write(`${message}\n\n`);
  }

  process.stdout.write(
    [
      'Usage: mdview [--port <port>] [--root <path>]',
      '',
      'Options:',
      '  --port <port>   HTTP port (default: 18094)',
      '  --root <path>   Root directory to scan for .md files',
      '                  If omitted, scans current directory top-level .md/.MD and ./docs recursively.',
      '  --daemon        Run in background mode (default).',
      '  --foreground    Run in current terminal process.',
      '  --help          Show this help.'
    ].join('\n') + '\n'
  );

  process.exit(code);
}

function makeDisplayPath(cwd, rootRealPath, scanMode) {
  if (scanMode === 'cwd-and-docs') {
    return './*.md + ./docs/**';
  }

  const relative = path.relative(cwd, rootRealPath);
  if (!relative) {
    return '.';
  }
  return relative.split(path.sep).join('/');
}

async function handleRequest(req, res, context) {
  const requestUrl = new URL(req.url || '/', `http://${HOST}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    sendHtml(res, 200, context.viewerHtml);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/info') {
    sendJson(res, 200, {
      success: true,
      root: context.rootRealPath,
      rootDisplayPath: context.rootDisplayPath
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/files') {
    const files = await listMarkdownFiles(context.rootRealPath, {
      mode: context.scanMode
    });
    sendJson(res, 200, { success: true, files });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/file') {
    const pathParam = requestUrl.searchParams.get('path');
    if (!pathParam) {
      sendJson(res, 400, { success: false, message: 'path query is required.' });
      return;
    }

    let resolved;
    try {
      resolved = resolvePathInRoot(context.rootRealPath, pathParam);
    } catch (error) {
      sendJson(res, 400, { success: false, message: error.message });
      return;
    }

    if (!resolved.normalizedRelative.toLowerCase().endsWith('.md')) {
      sendJson(res, 400, { success: false, message: 'Only .md files are allowed.' });
      return;
    }

    try {
      const stat = await fs.promises.stat(resolved.absolute);
      if (!stat.isFile()) {
        sendJson(res, 404, { success: false, message: 'File not found.' });
        return;
      }

      const content = await fs.promises.readFile(resolved.absolute, 'utf8');
      sendJson(res, 200, {
        success: true,
        path: resolved.normalizedRelative,
        content,
        mtimeMs: stat.mtimeMs
      });
      return;
    } catch {
      sendJson(res, 404, { success: false, message: 'File not found.' });
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/events') {
    const pathParam = requestUrl.searchParams.get('path');
    if (!pathParam) {
      sendJson(res, 400, { success: false, message: 'path query is required.' });
      return;
    }

    let normalized;
    try {
      normalized = normalizeRelativePath(pathParam);
      resolvePathInRoot(context.rootRealPath, normalized);
    } catch (error) {
      sendJson(res, 400, { success: false, message: error.message });
      return;
    }

    if (!normalized.toLowerCase().endsWith('.md')) {
      sendJson(res, 400, { success: false, message: 'Only .md files are allowed.' });
      return;
    }

    openSse(res, normalized, context.watchHub, req);
    return;
  }

  sendJson(res, 404, { success: false, message: 'Not found.' });
}

function openSse(res, normalizedPath, watchHub, req) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write('retry: 1000\n\n');
  watchHub.subscribe(normalizedPath, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      // Ignored.
    }
  }, 25000);

  const close = () => {
    clearInterval(heartbeat);
    watchHub.unsubscribe(normalizedPath, res);
    try {
      res.end();
    } catch {
      // Ignored.
    }
  };

  req.on('close', close);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(html);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function installShutdownHandlers(server, watchHub) {
  const shutdown = () => {
    watchHub.close();
    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function maybeDaemonize(cli) {
  if (!cli.daemon) {
    return;
  }

  if (process.env.MDVIEW_DAEMON_CHILD === '1') {
    return;
  }

  const childArgs = buildChildArgs(process.argv.slice(2));
  const childEnv = { ...process.env, MDVIEW_DAEMON_CHILD: '1' };
  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: 'ignore',
    env: childEnv
  });

  child.unref();
  process.stdout.write('mdview daemon started in background.\n');
  process.exit(0);
}

function buildChildArgs(rawArgs) {
  const out = [];

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--daemon') {
      continue;
    }
    out.push(arg);
  }

  if (!out.includes('--foreground')) {
    out.push('--foreground');
  }

  return out;
}

function killExistingPortListeners(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return;
  }

  const pids = findListeningPids(port).filter((pid) => pid !== process.pid);
  if (pids.length === 0) {
    return;
  }

  for (const pid of pids) {
    terminatePid(pid);
  }
}

function findListeningPids(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  });

  if (result.error) {
    process.stderr.write(`Warning: failed to query port ${port}: ${result.error.message}\n`);
    return [];
  }

  if (result.status !== 0 && !result.stdout) {
    return [];
  }

  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function terminatePid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    process.stderr.write(`Warning: failed to SIGTERM pid ${pid}: ${error.message}\n`);
    return;
  }

  if (waitForExit(pid, 800)) {
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    process.stderr.write(`Warning: failed to SIGKILL pid ${pid}: ${error.message}\n`);
    return;
  }

  waitForExit(pid, 800);
}

function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return true;
    }
    sleep(80);
  }
  return !isPidAlive(pid);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  Bun.sleepSync(ms);
}

function getServerPort(server, fallbackPort) {
  const address = server.address();
  if (!address || typeof address === 'string') {
    return fallbackPort;
  }
  return address.port || fallbackPort;
}

function openBrowser(url) {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    const child = spawn('open', [url], {
      stdio: 'ignore',
      detached: true
    });
    child.on('error', (error) => {
      process.stderr.write(`Failed to run open command: ${error.message}\n`);
    });
    child.unref();
  } catch (error) {
    process.stderr.write(`Failed to run open command: ${error.message}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Failed to start mdview: ${error.message}\n`);
  process.exit(1);
});
