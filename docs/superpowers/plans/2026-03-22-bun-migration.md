# Node.js SEA → Bun Compile 전환 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Node.js SEA(Single Executable Application) 기반 빌드를 `bun build --compile` 기반으로 전환하여 더 작고 빠른 단일 바이너리를 생성한다.

**Architecture:** 모듈 시스템을 CJS → ESM으로 전환하고, `node:sea` 런타임 에셋 로딩을 빌드 타임 인라이닝으로 대체한다. 빌드 스크립트는 `bun build --compile`을 활용하는 새 스크립트로 교체한다. HTTP 서버(`node:http`)는 Bun 호환이므로 유지한다.

**Tech Stack:** Bun 1.x, ESM, `bun build --compile`

---

## 현재 구조 요약

```
src/
  server.js          ← CJS 진입점, node:sea 에셋 로딩, http.createServer
  file-indexer.js    ← CJS, node:fs/promises
  path-guard.js      ← CJS, node:fs sync
  watch.js           ← CJS, node:fs.watch({ recursive: true })
  viewer-template.js ← CJS, 순수 문자열 빌더
  public/
    viewer-app.js    ← 브라우저 전용 (변경 불필요)
    viewer.css       ← 브라우저 전용 (변경 불필요)
vendor/
  markdown-renderer.js   ← 3.8MB 번들 (에셋)
  markdown-renderer.css  ← 8KB (에셋)
  mermaid.min.js         ← 2.6MB (에셋)
scripts/
  build-sea.mjs      ← ESM, Node SEA 전용 빌드 스크립트
```

## 변경 파일 맵

| 파일 | 작업 | 핵심 변경 |
|------|------|-----------|
| `package.json` | 수정 | `"type": "module"`, scripts 갱신, devDeps 제거 |
| `src/server.js` | 수정 | CJS→ESM, `node:sea` 제거, `Atomics.wait` → `Bun.sleepSync` |
| `src/file-indexer.js` | 수정 | CJS→ESM |
| `src/path-guard.js` | 수정 | CJS→ESM |
| `src/watch.js` | 수정 | CJS→ESM |
| `src/viewer-template.js` | 수정 | CJS→ESM |
| `scripts/build-bun.js` | 생성 | `bun build --compile` 기반 빌드 스크립트 |
| `scripts/build-sea.mjs` | 삭제 | Node SEA 빌드 스크립트 제거 |

---

### Task 1: package.json ESM 전환 및 scripts 갱신

**Files:**
- Modify: `package.json`

- [ ] **Step 1: package.json 수정**

`"type"` 을 `"module"`로 변경하고, scripts와 devDependencies를 갱신한다.

```json
{
  "name": "project-docs-markdown-viewer",
  "version": "0.1.0",
  "private": true,
  "description": "Local markdown docs viewer with live refresh for current file",
  "type": "module",
  "bin": {
    "mdview": "./src/server.js"
  },
  "scripts": {
    "start": "bun src/server.js",
    "start:port": "bun src/server.js --port 18094",
    "check": "bun --check src/server.js && bun --check src/file-indexer.js && bun --check src/path-guard.js && bun --check src/watch.js && bun --check src/viewer-template.js && bun --check src/public/viewer-app.js",
    "build": "bun scripts/build-bun.js"
  }
}
```

- devDependencies(`esbuild`, `postject`)는 삭제한다.
- `build:sea` 스크립트를 `build`로 교체한다.

- [ ] **Step 2: node_modules 제거 및 불필요 lockfile 정리**

Run: `rm -rf node_modules package-lock.json`

- [ ] **Step 3: Commit**

```bash
git add package.json
git rm -r node_modules package-lock.json 2>/dev/null || true
git commit -m "chore: convert package.json to ESM and update scripts for Bun"
```

---

### Task 2: viewer-template.js CJS → ESM 전환

가장 단순한 모듈(의존성 없음)부터 시작한다.

**Files:**
- Modify: `src/viewer-template.js`

- [ ] **Step 1: CJS를 ESM으로 변환**

```javascript
// 변경 전
module.exports = { buildViewerHtml };

// 변경 후
export { buildViewerHtml };
```

`'use strict';`는 ESM에서 기본이므로 제거한다.

- [ ] **Step 2: 문법 검증**

Run: `bun --check src/viewer-template.js`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/viewer-template.js
git commit -m "refactor: convert viewer-template.js to ESM"
```

---

### Task 3: file-indexer.js CJS → ESM 전환

**Files:**
- Modify: `src/file-indexer.js`

- [ ] **Step 1: CJS를 ESM으로 변환**

```javascript
// 변경 전
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
// ...
module.exports = { listMarkdownFiles };

// 변경 후
import fs from 'node:fs/promises';
import path from 'node:path';
// ...
export { listMarkdownFiles };
```

- [ ] **Step 2: 문법 검증**

Run: `bun --check src/file-indexer.js`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/file-indexer.js
git commit -m "refactor: convert file-indexer.js to ESM"
```

---

### Task 4: path-guard.js CJS → ESM 전환

**Files:**
- Modify: `src/path-guard.js`

- [ ] **Step 1: CJS를 ESM으로 변환**

```javascript
// 변경 전
'use strict';
const fs = require('node:fs');
const path = require('node:path');
// ...
module.exports = { resolveRoot, resolvePathInRoot, normalizeRelativePath, isInsideRoot };

// 변경 후
import fs from 'node:fs';
import path from 'node:path';
// ...
export { resolveRoot, resolvePathInRoot, normalizeRelativePath, isInsideRoot };
```

- [ ] **Step 2: 문법 검증**

Run: `bun --check src/path-guard.js`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/path-guard.js
git commit -m "refactor: convert path-guard.js to ESM"
```

---

### Task 5: watch.js CJS → ESM 전환

**Files:**
- Modify: `src/watch.js`

- [ ] **Step 1: CJS를 ESM으로 변환**

```javascript
// 변경 전
'use strict';
const fs = require('node:fs');
const path = require('node:path');
// ...
module.exports = { CurrentFileWatchHub };

// 변경 후
import fs from 'node:fs';
import path from 'node:path';
// ...
export { CurrentFileWatchHub };
```

- [ ] **Step 2: 문법 검증**

Run: `bun --check src/watch.js`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/watch.js
git commit -m "refactor: convert watch.js to ESM"
```

---

### Task 6: server.js CJS → ESM 전환 및 node:sea 제거

핵심 전환 작업. 3가지 변경이 포함된다:
1. CJS → ESM 모듈 변환
2. `node:sea` 에셋 로딩 제거 → 빌드 타임 인라이닝 준비
3. `Atomics.wait` → `Bun.sleepSync` 전환

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: import 문 전환**

```javascript
// 변경 전 (lines 1-13)
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
const { listMarkdownFiles } = require('./file-indexer');
const { resolveRoot, resolvePathInRoot, normalizeRelativePath } = require('./path-guard');
const { CurrentFileWatchHub } = require('./watch');
const { buildViewerHtml } = require('./viewer-template');

// 변경 후
#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { listMarkdownFiles } from './file-indexer.js';
import { resolveRoot, resolvePathInRoot, normalizeRelativePath } from './path-guard.js';
import { CurrentFileWatchHub } from './watch.js';
import { buildViewerHtml } from './viewer-template.js';
```

- ESM에서는 `node:url`의 `URL`이 글로벌이므로 import 불필요.
- 상대 경로 import에 `.js` 확장자를 명시한다.

- [ ] **Step 2: node:sea 관련 코드 제거 및 loadAssets 단순화**

`node:sea` 에셋 로딩을 제거하고, 개발 모드(디스크 로딩)만 남긴다. 컴파일 바이너리에서는 빌드 타임에 에셋이 번들에 인라이닝되므로 런타임 분기가 불필요하다.

```javascript
// 삭제할 코드 (lines 18-19)
const seaApi = safeRequireSea();
const isSeaMode = Boolean(seaApi && typeof seaApi.isSea === 'function' && seaApi.isSea());

// 삭제할 함수 (lines 508-514)
function safeRequireSea() { ... }

// loadTextAsset 단순화 (lines 103-113)
// 변경 전: snake_case 에셋 키(`renderer_js` 등)로 node:sea API 호출
function loadTextAsset(assetKey, diskPath) {
  if (isSeaMode && seaApi && typeof seaApi.getAsset === 'function') {
    const arrayBuffer = seaApi.getAsset(assetKey);
    if (!arrayBuffer) {
      throw new Error(`SEA asset not found: ${assetKey}`);
    }
    return Buffer.from(arrayBuffer).toString('utf8');
  }
  return fs.readFileSync(diskPath, 'utf8');
}

// loadAssets (lines 85-101)에서의 호출도 함께 변경 필요:
// 변경 전: snake_case 키로 호출 (SEA config와 일치)
//   loadTextAsset('renderer_js', assetMap.rendererJs)
// 변경 후: camelCase 키로 통일 (Task 7의 globalThis.__MDVIEW_ASSETS__ 키와 일치)
//   loadTextAsset('rendererJs', assetMap.rendererJs)

// 변경 후 (이 단계에서는 디스크 로딩만 유지, Task 7에서 인라인 에셋 로딩 추가)
function loadTextAsset(_assetKey, diskPath) {
  return fs.readFileSync(diskPath, 'utf8');
}
```

- [ ] **Step 3: `__dirname` ESM 대체**

ESM에서는 `__dirname`이 없다. Bun에서는 `import.meta.dir`을 사용한다.

```javascript
// 변경 전 (line 29)
const projectRoot = path.resolve(__dirname, '..');

// 변경 후
const projectRoot = path.resolve(import.meta.dir, '..');
```

- [ ] **Step 4: Atomics.wait → Bun.sleepSync 전환**

```javascript
// 변경 전 (lines 477-479)
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 변경 후
function sleep(ms) {
  Bun.sleepSync(ms);
}
```

- [ ] **Step 5: 문법 검증 및 실행 테스트**

Run: `bun src/server.js --foreground --port 18095`
Expected: 서버가 정상 시작되고 브라우저에서 접속 가능

> **Note:** `Bun.sleepSync`는 Bun 전용 API로, 이 변경 이후 Node.js에서는 실행 불가능하다. 이는 의도된 설계이다.

- [ ] **Step 6: Commit**

```bash
git add src/server.js
git commit -m "refactor: convert server.js to ESM, remove node:sea, use Bun.sleepSync"
```

---

### Task 7: Bun 빌드 스크립트 작성

`bun build --compile` 기반의 새 빌드 스크립트를 작성한다.

**핵심 전략:** `bun build --compile`은 import된 모든 모듈을 번들에 포함한다. vendor 에셋(3.8MB + 2.6MB + CSS)은 빌드 스크립트가 임시 진입점 파일을 생성하여 에셋을 문자열 상수로 인라이닝한 뒤 컴파일한다.

**Files:**
- Create: `scripts/build-bun.js`
- Delete: `scripts/build-sea.mjs`

- [ ] **Step 1: 빌드 스크립트 작성**

`scripts/build-bun.js`:

```javascript
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

// 에셋 경로 정의
const assets = {
  rendererJs:  path.join(projectRoot, 'vendor', 'markdown-renderer.js'),
  rendererCss: path.join(projectRoot, 'vendor', 'markdown-renderer.css'),
  mermaidJs:   path.join(projectRoot, 'vendor', 'mermaid.min.js'),
  viewerCss:   path.join(projectRoot, 'src', 'public', 'viewer.css'),
  viewerAppJs: path.join(projectRoot, 'src', 'public', 'viewer-app.js'),
};

// 에셋 존재 확인
for (const [key, filePath] of Object.entries(assets)) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing asset '${key}': ${filePath}`);
  }
}

if (!fs.existsSync(mainScript)) {
  fail(`Missing main script: ${mainScript}`);
}

// dist 초기화
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// 임시 진입점 생성: 에셋을 문자열 상수로 인라이닝
const tempEntry = path.join(distDir, '_entry.js');
const assetInlines = Object.entries(assets).map(([key, filePath]) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const escaped = JSON.stringify(content);
  return `globalThis.__MDVIEW_ASSETS__ = globalThis.__MDVIEW_ASSETS__ || {};\nglobalThis.__MDVIEW_ASSETS__['${key}'] = ${escaped};`;
}).join('\n');

// static import로 생성하여 번들러가 확실히 포함하도록 한다
const relativeMain = path.relative(distDir, mainScript);
const entryContent = `${assetInlines}\nimport '${relativeMain}';\n`;
fs.writeFileSync(tempEntry, entryContent);

// bun build --compile
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

// 정리
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
```

- [ ] **Step 2: server.js에서 인라인 에셋 우선 로딩 적용**

`loadAssets` 함수가 `globalThis.__MDVIEW_ASSETS__`를 먼저 확인하도록 수정한다.

```javascript
// loadTextAsset 수정 (src/server.js)
function loadTextAsset(assetKey, diskPath) {
  // 컴파일 바이너리: 빌드 타임에 globalThis에 인라이닝된 에셋 사용
  const inlined = globalThis.__MDVIEW_ASSETS__?.[assetKey];
  if (inlined !== undefined) {
    return inlined;
  }
  // 개발 모드: 디스크에서 로딩
  return fs.readFileSync(diskPath, 'utf8');
}
```

`loadAssets`의 에셋 키를 `__MDVIEW_ASSETS__` 키와 일치시킨다:

```javascript
function loadAssets(projectRoot) {
  const assetMap = {
    rendererJs:  path.join(projectRoot, 'vendor', 'markdown-renderer.js'),
    rendererCss: path.join(projectRoot, 'vendor', 'markdown-renderer.css'),
    mermaidJs:   path.join(projectRoot, 'vendor', 'mermaid.min.js'),
    viewerCss:   path.join(projectRoot, 'src', 'public', 'viewer.css'),
    viewerAppJs: path.join(projectRoot, 'src', 'public', 'viewer-app.js'),
  };

  return {
    rendererJs:  loadTextAsset('rendererJs',  assetMap.rendererJs),
    rendererCss: loadTextAsset('rendererCss', assetMap.rendererCss),
    mermaidJs:   loadTextAsset('mermaidJs',   assetMap.mermaidJs),
    viewerCss:   loadTextAsset('viewerCss',   assetMap.viewerCss),
    viewerAppJs: loadTextAsset('viewerAppJs', assetMap.viewerAppJs),
  };
}
```

- [ ] **Step 3: 빌드 실행 및 검증**

Run: `bun scripts/build-bun.js`
Expected: `dist/mdview` 바이너리 생성

Run: `./dist/mdview --foreground --port 18096`
Expected: 컴파일된 바이너리로 서버 정상 시작

Run: `ls -lh dist/mdview`
Expected: Node SEA(~116MB)보다 훨씬 작은 바이너리 (~30-50MB 예상)

- [ ] **Step 4: 데몬 모드 검증**

컴파일된 바이너리에서 `process.execPath`가 바이너리 자체를 가리키므로 데몬 re-spawn이 정상 동작하는지 확인한다.

Run: `./dist/mdview --daemon --port 18096`
Expected: 데몬 프로세스가 백그라운드에서 시작되고, `curl http://127.0.0.1:18096/api/info` 응답 정상

Run: `./dist/mdview --foreground --port 18096` (기존 데몬 kill 후 재시작 확인)
Expected: 기존 포트 점유 프로세스 종료 후 정상 시작

- [ ] **Step 5: Commit**

```bash
git add scripts/build-bun.js src/server.js
git commit -m "feat: add bun build --compile script with inlined assets"
```

---

### Task 8: Node SEA 빌드 스크립트 제거 및 정리

**Files:**
- Delete: `scripts/build-sea.mjs`

- [ ] **Step 1: SEA 빌드 스크립트 삭제**

Run: `git rm scripts/build-sea.mjs`

- [ ] **Step 2: dist 디렉토리 정리**

Run: `rm -rf dist/`

- [ ] **Step 3: 최종 빌드 + 실행 검증**

Run: `bun run build && ./dist/mdview --foreground --port 18097`
Expected: 빌드부터 실행까지 전체 워크플로우 정상 동작

- [ ] **Step 4: Commit**

```bash
git rm scripts/build-sea.mjs
git commit -m "chore: remove Node.js SEA build script and devDependencies"
```

---

## 전환 요약

| 항목 | Before (Node SEA) | After (Bun Compile) |
|------|-------------------|---------------------|
| 모듈 시스템 | CommonJS | ESM |
| 빌드 도구 | esbuild + postject + node SEA | `bun build --compile` |
| 에셋 로딩 | `node:sea` getAsset() | 빌드 타임 globalThis 인라이닝 |
| 동기 sleep | `Atomics.wait(SharedArrayBuffer)` | `Bun.sleepSync()` |
| shebang | `#!/usr/bin/env node` | `#!/usr/bin/env bun` |
| 런타임 의존성 | 0 | 0 |
| 개발 의존성 | esbuild, postject | 없음 |
| 바이너리 크기 | ~116MB | ~30-50MB (예상) |

## 변경하지 않는 것

- `node:http` 서버 (`Bun.serve()` 전환은 별도 작업)
- `fs.watch({ recursive: true })` 파일 감시 로직
- `viewer-app.js`, `viewer.css` 브라우저 코드
- vendor 에셋 파일들
- CLI 인자 파싱 로직
- 데몬 모드/프로세스 관리 로직 (Bun 호환)
