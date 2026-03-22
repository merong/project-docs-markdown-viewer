# mdview

`mdview` is a local Markdown viewer for terminal-first (TUI) workflows.
It lets you stay in the shell for navigation and commands, while opening a browser tab for clean rendered output (Markdown + Mermaid), instead of reading raw `.md` text in the terminal.

## Screenshots
### Main Viewer
![mdview main viewer](./mdview.png)

### Mermaid Rendering
![mdview mermaid rendering](./mdview-mermaid.png)

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
- Single executable build with `bun build --compile`

## Requirements
- [Bun](https://bun.sh/) 1.x+

## Development Run
```bash
bun start
```
Open `http://127.0.0.1:18094`.

Useful options:
```bash
bun src/server.js --port 18081
bun src/server.js --root ./docs
bun src/server.js --foreground
```

## Build
```bash
bun run build
```
Build output:
- macOS/Linux: `dist/mdview`
- Windows: `dist/mdview.exe`

## Deploy
Build and install to `~/bin`:
```bash
bun run deploy
```

If `~/bin` is not yet in your PATH:
```bash
# zsh
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
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
- `scripts/`: build script (`bun build --compile` packaging)
- `vendor/`: bundled third-party browser assets
- `dist/`: generated build artifacts
