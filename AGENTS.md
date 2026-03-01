# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains runtime code for the local Markdown viewer.
- `src/server.js` is the CLI entry point and HTTP server.
- `src/file-indexer.js`, `src/path-guard.js`, and `src/watch.js` handle file discovery, safe path resolution, and live refresh.
- `src/public/` contains browser UI assets (`viewer-app.js`, `viewer.css`).
- `src/viewer-template.js` builds the HTML shell.
- `vendor/` stores bundled third-party browser assets (Markdown renderer, Mermaid).
- `scripts/build-sea.mjs` builds the single executable artifact.
- `dist/` is generated output; do not hand-edit files there.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm start`: run the viewer on default port `18094`.
- `npm run start:port`: run on an explicit local port config.
- `node src/server.js --foreground --root ./docs`: run in foreground and scan a specific docs root.
- `npm run check`: syntax-check all maintained JS entry files.
- `npm run build:sea`: produce a single-file executable in `dist/`.

## Coding Style & Naming Conventions
- Language/runtime: Node.js CommonJS (`require`, `module.exports`) with `'use strict';`.
- Formatting: 2-space indentation, semicolons, single quotes.
- Naming: `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants, descriptive module filenames (for example `path-guard.js`).
- Keep modules focused and side-effect-light; isolate browser code under `src/public/`.

## Testing Guidelines
- There is no dedicated test framework in this checkout yet.
- Minimum gate before PR: run `npm run check` and perform a manual smoke test:
  1. Launch server locally.
  2. Open `http://127.0.0.1:<port>`.
  3. Verify file listing, markdown rendering, and live refresh behavior.

## Commit & Pull Request Guidelines
- Git history is not available in this workspace snapshot, so no strict local convention can be inferred.
- Use clear, imperative commit messages (recommended pattern: `type: short summary`, e.g., `fix: guard invalid root path`).
- PRs should include: purpose, scope, local verification steps, and screenshots/GIFs for UI changes.
- Link related issues and call out behavior changes (ports, root scanning, daemon/foreground behavior).

## Security & Configuration Notes
- Preserve root-boundary checks in `path-guard.js`; never allow path traversal outside the configured root.
- Keep server binding local (`127.0.0.1`) unless there is an explicit requirement to expose it.
