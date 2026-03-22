import fs from 'node:fs';
import path from 'node:path';

class CurrentFileWatchHub {
  constructor(rootRealPath, options = {}) {
    this.rootRealPath = rootRealPath;
    this.debounceMs = options.debounceMs || 200;
    this.watchers = [];
    this.pathSubscribers = new Map();
    this.debounceTimers = new Map();
    this.started = false;
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;

    try {
      // Recursive watch works on macOS and Windows.
      const watcher = fs.watch(this.rootRealPath, { recursive: true }, (eventType, filename) => {
        this.onFsEvent(eventType, filename);
      });

      watcher.on('error', () => {
        // Keep server alive if a watch event fails.
      });

      this.watchers.push(watcher);
    } catch {
      // Fallback: no watcher means live updates are disabled.
    }
  }

  subscribe(relativePath, res) {
    this.start();

    if (!this.pathSubscribers.has(relativePath)) {
      this.pathSubscribers.set(relativePath, new Set());
    }

    this.pathSubscribers.get(relativePath).add(res);
  }

  unsubscribe(relativePath, res) {
    const set = this.pathSubscribers.get(relativePath);
    if (!set) {
      return;
    }

    set.delete(res);
    if (set.size === 0) {
      this.pathSubscribers.delete(relativePath);
    }
  }

  close() {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors.
      }
    }

    this.watchers = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    for (const clients of this.pathSubscribers.values()) {
      for (const res of clients) {
        try {
          res.end();
        } catch {
          // Ignore close errors.
        }
      }
    }
    this.pathSubscribers.clear();
  }

  onFsEvent(_eventType, filename) {
    if (!filename) {
      for (const relativePath of this.pathSubscribers.keys()) {
        this.queueNotify(relativePath);
      }
      return;
    }

    const normalized = String(filename).replace(/\\/g, '/');

    for (const relativePath of this.pathSubscribers.keys()) {
      if (normalized === relativePath || normalized.endsWith('/' + relativePath) || relativePath.endsWith('/' + normalized)) {
        this.queueNotify(relativePath);
      }
    }
  }

  queueNotify(relativePath) {
    const existing = this.debounceTimers.get(relativePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(relativePath);
      const payload = await this.buildPayload(relativePath);
      this.emit(relativePath, payload);
    }, this.debounceMs);

    this.debounceTimers.set(relativePath, timer);
  }

  async buildPayload(relativePath) {
    const absolute = path.join(this.rootRealPath, relativePath.split('/').join(path.sep));

    try {
      const stat = await fs.promises.stat(absolute);
      return {
        path: relativePath,
        mtimeMs: stat.mtimeMs,
        exists: stat.isFile()
      };
    } catch {
      return {
        path: relativePath,
        mtimeMs: null,
        exists: false
      };
    }
  }

  emit(relativePath, payload) {
    const subscribers = this.pathSubscribers.get(relativePath);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const data = `event: changed\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const res of subscribers) {
      try {
        res.write(data);
      } catch {
        // Client disconnected, server close handler will cleanup.
      }
    }
  }
}

export { CurrentFileWatchHub };
