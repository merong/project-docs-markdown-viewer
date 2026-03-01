# mdview

`mdview` is a local Markdown viewer for terminal-first (TUI) workflows.
It lets you stay in the shell for navigation and commands, while opening a browser tab for clean rendered output (Markdown + Mermaid), instead of reading raw `.md` text in the terminal.

## Documentation
- Korean README: [README-ko.md](./README-ko.md)
- Contributor Guide: [AGENTS.md](./AGENTS.md)
- License: [LICENSE](./LICENSE)

## Project Purpose
This project is designed for developers working mostly in terminal environments who still need high-quality document rendering.

- Read project docs with headings, tables, code blocks, and Mermaid diagrams rendered correctly
- Keep docs local and private (server binds to `127.0.0.1`)
- See updates quickly with live refresh for the currently open file
- Use simple CLI options to point at the current project or a dedicated docs folder

Default scan behavior is:
- top-level `./*.md`
- recursive `./docs/**`

## Key Features
- Local HTTP viewer with file list and content preview
- Optional custom scan root via `--root`
- Live reload using SSE + file watching
- Foreground/background execution modes
- Single executable build with Node SEA

## Requirements
- Node.js 20+
- npm

## Development Run
```bash
npm install
npm start
```
Open `http://127.0.0.1:18094`.

Useful options:
```bash
node src/server.js --port 18081
node src/server.js --root ./docs
node src/server.js --foreground
```

## Validate
```bash
npm run check
```
This runs syntax checks for the main server/client JavaScript files.

## Build
```bash
npm run build:sea
```
Build output:
- macOS/Linux: `dist/mdview`
- Windows: `dist/mdview.exe`

## Install Binary to `~/bin` and Use via `$PATH`
After building:

```bash
mkdir -p "$HOME/bin"
cp dist/mdview "$HOME/bin/mdview"
chmod +x "$HOME/bin/mdview"
```

Add `~/bin` to PATH (zsh):
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Add `~/bin` to PATH (bash):
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Verify:
```bash
which mdview
mdview --help
```

## Typical Usage
```bash
# From any project directory
mdview

# Use a specific docs root and port
mdview --root ./docs --port 18094
```

## Project Structure
- `src/`: server, file indexing, path guard, watcher, UI assets
- `scripts/`: build scripts (including SEA packaging)
- `vendor/`: bundled third-party browser assets
- `dist/`: generated build artifacts
