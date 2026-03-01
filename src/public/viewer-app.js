(() => {
  const STORAGE_KEY = 'mdview.settings.v2';
  const ICON_SUN = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="4"></circle>' +
    '<path d="M12 2v2"></path>' +
    '<path d="M12 20v2"></path>' +
    '<path d="m4.93 4.93 1.41 1.41"></path>' +
    '<path d="m17.66 17.66 1.41 1.41"></path>' +
    '<path d="M2 12h2"></path>' +
    '<path d="M20 12h2"></path>' +
    '<path d="m6.34 17.66-1.41 1.41"></path>' +
    '<path d="m19.07 4.93-1.41 1.41"></path>' +
    '</svg>'
  );
  const ICON_MOON = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>' +
    '</svg>'
  );
  const DEFAULT_SETTINGS = Object.freeze({
    sidebarCollapsed: false,
    themeMode: 'dark'
  });
  const THEME_MODES = new Set(['dark', 'light']);

  const state = {
    files: [],
    filterText: '',
    currentPath: null,
    eventSource: null,
    mermaidInitialized: false,
    mermaidCounter: 0,
    mermaidTheme: null,
    settings: loadSettingsFromStorage()
  };

  const elements = {
    appShell: document.querySelector('.app-shell'),
    fileList: document.getElementById('fileList'),
    filterInput: document.getElementById('filterInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    preview: document.getElementById('preview'),
    currentFile: document.getElementById('currentFile'),
    status: document.getElementById('status')
  };

  function sanitizeSettings(raw) {
    const candidate = raw && typeof raw === 'object' ? raw : {};
    const themeMode = THEME_MODES.has(candidate.themeMode) ? candidate.themeMode : DEFAULT_SETTINGS.themeMode;

    return {
      sidebarCollapsed: Boolean(candidate.sidebarCollapsed),
      themeMode
    };
  }

  function loadSettingsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettingsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch {
      // Ignore storage errors in restricted browser mode.
    }
  }

  function mermaidThemeForCurrentMode() {
    return state.settings.themeMode === 'dark' ? 'dark' : 'default';
  }

  function updateSidebarToggleButton() {
    if (!elements.sidebarToggleBtn) {
      return;
    }

    const isCollapsed = state.settings.sidebarCollapsed;
    elements.sidebarToggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
    elements.sidebarToggleBtn.title = isCollapsed ? 'Show sidebar' : 'Hide sidebar';
    elements.sidebarToggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  }

  function updateThemeToggleButton() {
    if (!elements.themeToggleBtn) {
      return;
    }

    const isDark = state.settings.themeMode === 'dark';
    elements.themeToggleBtn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
    elements.themeToggleBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    elements.themeToggleBtn.setAttribute('aria-label', elements.themeToggleBtn.title);
    elements.themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }

  function applySettingsToUi() {
    const isDark = state.settings.themeMode === 'dark';
    document.body.classList.toggle('theme-dark', isDark);

    if (elements.appShell) {
      elements.appShell.classList.toggle('sidebar-collapsed', state.settings.sidebarCollapsed);
    }

    updateSidebarToggleButton();
    updateThemeToggleButton();
  }

  function updateSettings(patch, options = {}) {
    const { rerenderCurrent = false } = options;
    state.settings = sanitizeSettings({ ...state.settings, ...patch });
    applySettingsToUi();
    saveSettingsToStorage();

    if (rerenderCurrent && state.currentPath) {
      void openFile(state.currentPath, {
        updateHash: false,
        keepScroll: true,
        reason: 'theme'
      }).catch((err) => {
        setStatus('Theme update failed: ' + err.message);
      });
    }
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function setCurrentFileLabel(pathText) {
    elements.currentFile.textContent = pathText || 'Select a markdown file';
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  function filteredFiles() {
    const keyword = state.filterText.trim().toLowerCase();
    if (!keyword) {
      return state.files;
    }
    return state.files.filter((file) => file.toLowerCase().includes(keyword));
  }

  function renderFileList() {
    const files = filteredFiles();
    elements.fileList.innerHTML = '';

    if (files.length === 0) {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = '<button class="file-btn" disabled>No markdown files found</button>';
      elements.fileList.appendChild(li);
      return;
    }

    for (const file of files) {
      const li = document.createElement('li');
      li.className = 'file-item' + (file === state.currentPath ? ' active' : '');

      const btn = document.createElement('button');
      btn.className = 'file-btn';
      btn.type = 'button';
      btn.textContent = file;
      btn.title = file;
      btn.addEventListener('click', () => {
        openFile(file, { updateHash: true, keepScroll: false, reason: 'manual' }).catch((err) => {
          setStatus('Failed to open file: ' + err.message);
        });
      });

      li.appendChild(btn);
      elements.fileList.appendChild(li);
    }
  }

  async function loadFiles({ preserveSelection = true } = {}) {
    const data = await fetchJson('/api/files');
    state.files = Array.isArray(data.files) ? data.files : [];

    if (!preserveSelection || !state.currentPath || !state.files.includes(state.currentPath)) {
      state.currentPath = null;
    }

    renderFileList();
    setStatus(`${state.files.length} markdown file(s)`);
  }

  function showEmptyPreview() {
    elements.preview.innerHTML = '<div class="preview-empty">No file selected.</div>';
  }

  async function openFile(relativePath, options = {}) {
    const { updateHash = true, keepScroll = false, reason = 'manual' } = options;

    const scrollTop = keepScroll ? elements.preview.scrollTop : 0;
    setStatus('Loading ' + relativePath + ' ...');

    const data = await fetchJson('/api/file?path=' + encodeURIComponent(relativePath));
    const content = typeof data.content === 'string' ? data.content : '';

    state.currentPath = relativePath;
    setCurrentFileLabel(relativePath);

    if (typeof window.MarkdownLib === 'undefined') {
      elements.preview.innerHTML = '<div class="preview-empty">Renderer failed to load.</div>';
      throw new Error('MarkdownLib is not available');
    }

    // Disable built-in mermaid rendering from renderer bundle to avoid chunk dependencies.
    window.MarkdownLib.renderToSync('#preview', content, { mermaid: false });
    await renderStaticMermaid(elements.preview);

    if (keepScroll) {
      elements.preview.scrollTop = scrollTop;
    }

    if (updateHash) {
      location.hash = encodeURIComponent(relativePath);
    }

    subscribeLiveUpdates(relativePath);
    renderFileList();

    if (reason === 'watch') {
      setStatus('Auto-updated ' + relativePath);
    } else {
      setStatus('Loaded ' + relativePath);
    }
  }

  function initMermaidIfNeeded() {
    if (typeof window.mermaid === 'undefined') {
      return;
    }

    const nextTheme = mermaidThemeForCurrentMode();
    if (state.mermaidInitialized && state.mermaidTheme === nextTheme) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: nextTheme
    });

    state.mermaidInitialized = true;
    state.mermaidTheme = nextTheme;
  }

  async function renderStaticMermaid(container) {
    initMermaidIfNeeded();

    if (typeof window.mermaid === 'undefined') {
      return;
    }

    const blocks = container.querySelectorAll('pre > code.language-mermaid, pre > code.hljs.language-mermaid');

    for (const block of blocks) {
      const pre = block.closest('pre');
      if (!pre) {
        continue;
      }

      const source = (block.textContent || '').trim();
      if (!source) {
        continue;
      }

      const targetId = 'mdview-mermaid-' + Date.now() + '-' + (++state.mermaidCounter);

      try {
        const result = await window.mermaid.render(targetId, source);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = result.svg;
        pre.replaceWith(wrapper);
      } catch (err) {
        const errorBox = document.createElement('div');
        errorBox.className = 'mermaid-error';
        errorBox.textContent = 'Mermaid render failed: ' + (err && err.message ? err.message : String(err));
        pre.insertAdjacentElement('beforebegin', errorBox);
      }
    }
  }

  function subscribeLiveUpdates(relativePath) {
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }

    const es = new EventSource('/events?path=' + encodeURIComponent(relativePath));
    state.eventSource = es;

    es.addEventListener('changed', (event) => {
      if (state.currentPath !== relativePath) {
        return;
      }

      void openFile(relativePath, {
        updateHash: false,
        keepScroll: true,
        reason: 'watch'
      }).catch((err) => {
        setStatus('Auto-update failed: ' + err.message);
      });
    });

    es.onerror = () => {
      if (state.currentPath === relativePath) {
        setStatus('Waiting for live update reconnection ...');
      }
    };
  }

  function decodeHashPath() {
    const hash = location.hash.slice(1);
    if (!hash) {
      return null;
    }

    try {
      return decodeURIComponent(hash);
    } catch {
      return null;
    }
  }

  async function initialLoad() {
    await loadFiles({ preserveSelection: false });

    if (state.files.length === 0) {
      showEmptyPreview();
      return;
    }

    const hashPath = decodeHashPath();
    if (hashPath && state.files.includes(hashPath)) {
      await openFile(hashPath, { updateHash: false, keepScroll: false, reason: 'initial' });
      return;
    }

    await openFile(state.files[0], { updateHash: true, keepScroll: false, reason: 'initial' });
  }

  function bindUi() {
    if (elements.sidebarToggleBtn) {
      elements.sidebarToggleBtn.addEventListener('click', () => {
        updateSettings({ sidebarCollapsed: !state.settings.sidebarCollapsed });
      });
    }

    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', () => {
        const nextMode = state.settings.themeMode === 'dark' ? 'light' : 'dark';
        updateSettings({ themeMode: nextMode }, { rerenderCurrent: true });
      });
    }

    elements.filterInput.addEventListener('input', () => {
      state.filterText = elements.filterInput.value || '';
      renderFileList();
    });

    elements.refreshBtn.addEventListener('click', async () => {
      try {
        await loadFiles({ preserveSelection: true });
        if (state.currentPath && state.files.includes(state.currentPath)) {
          await openFile(state.currentPath, {
            updateHash: false,
            keepScroll: true,
            reason: 'manual-refresh'
          });
        }
      } catch (err) {
        setStatus('Refresh failed: ' + err.message);
      }
    });

    window.addEventListener('hashchange', () => {
      const hashPath = decodeHashPath();
      if (!hashPath || hashPath === state.currentPath) {
        return;
      }

      if (!state.files.includes(hashPath)) {
        setStatus('Hash file does not exist under root.');
        return;
      }

      void openFile(hashPath, { updateHash: false, keepScroll: false, reason: 'hash' }).catch((err) => {
        setStatus('Failed to load hash file: ' + err.message);
      });
    });

    window.addEventListener('beforeunload', () => {
      if (state.eventSource) {
        state.eventSource.close();
      }
    });
  }

  applySettingsToUi();
  bindUi();
  initialLoad().catch((err) => {
    setStatus('Initial load failed: ' + err.message);
    showEmptyPreview();
  });
})();
