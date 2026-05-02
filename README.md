# Tauri + React + Typescript

## Prerequisites

- [CAST](https://github.com/ek33450505/claude-agent-team) installed (`~/.claude/cast.db` must exist)
- [Ollama](https://ollama.ai) installed: `brew install ollama`
- At least one model pulled: `ollama pull mistral`

The app will attempt to start `ollama serve` automatically on launch. If Ollama is not installed, the Chat view will show an error banner.

Chat integration tests are run manually (requires Ollama). CI runs unit tests only.

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
