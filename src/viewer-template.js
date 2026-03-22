function buildViewerHtml({
  pageTitle,
  rootDisplayPath,
  rendererCss,
  viewerCss,
  rendererJs,
  mermaidJs,
  viewerAppJs
}) {
  const title = escapeHtml(pageTitle || 'Markdown Viewer');
  const rootText = escapeHtml(rootDisplayPath || '.');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${title}</title>`,
    '  <style>',
    rendererCss,
    viewerCss,
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="app-shell">',
    '    <aside class="sidebar">',
    '      <div class="sidebar-header">',
    '        <div class="title-row">',
    '          <h1>Docs Viewer</h1>',
    '          <button id="refreshBtn" class="btn" title="Refresh file list">Refresh</button>',
    '        </div>',
    '        <div class="root-path" title="Current scan root">',
    `          <span>${rootText}</span>`,
    '        </div>',
    '        <input id="filterInput" type="search" placeholder="Filter .md files" autocomplete="off" />',
    '      </div>',
    '      <ul id="fileList" class="file-list"></ul>',
    '    </aside>',
    '    <main class="content">',
    '      <header class="content-header">',
    '        <div class="content-head-left">',
    '          <button id="sidebarToggleBtn" class="icon-btn" type="button" title="Toggle sidebar" aria-label="Toggle sidebar">Hide</button>',
    '          <button id="themeToggleBtn" class="icon-btn icon-only" type="button" title="Toggle theme" aria-label="Toggle theme"></button>',
    '          <div class="current-file" id="currentFile">Select a markdown file</div>',
    '        </div>',
    '        <div class="status" id="status">Ready</div>',
    '      </header>',
    '      <section id="preview" class="markdown-body preview"></section>',
    '    </main>',
    '  </div>',
    '  <script>',
    `  window.__MDVIEW_BOOT__ = ${JSON.stringify({ rootDisplayPath: rootDisplayPath || '.' })};`,
    '  </script>',
    '  <script>',
    escapeInlineScript(rendererJs),
    '  </script>',
    '  <script>',
    escapeInlineScript(mermaidJs),
    '  </script>',
    '  <script>',
    escapeInlineScript(viewerAppJs),
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
}

function escapeInlineScript(scriptText) {
  return String(scriptText || '').replace(/<\/(script)/gi, '<\\/$1');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { buildViewerHtml };
