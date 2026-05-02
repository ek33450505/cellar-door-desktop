# Tauri + React + Typescript

## Prerequisites

- [CAST](https://github.com/ek33450505/claude-agent-team) installed (`~/.claude/cast.db` must exist)
- [Ollama](https://ollama.ai) installed: `brew install ollama`
- At least one model pulled: `ollama pull mistral`

The app will attempt to start `ollama serve` automatically on launch. If Ollama is not installed, the Chat view will show an error banner.

Chat integration tests are run manually (requires Ollama). CI runs unit tests only.

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Agent Mode (Phase 7c)

Enable Agent Mode in the Chat view to allow the AI to call tools. Each tool call
requires explicit approval. All tool invocations are logged to cast.db and
viewable in the Tool Log page.

Available tools: read_memory, write_memory, list_dir, read_file, shell_exec (allowlist only), fetch_url (localhost only).

Agent mode is opt-in and does not affect normal chat mode.

**Permission model:** Every tool call surfaces a modal with the tool name, scope, and
arguments before execution. You can Allow or Deny each call individually. Denied calls
are logged with `decision='denied'` but do not stop the agent loop — the agent receives
the denial and continues.

**Audit log:** All tool invocations (allowed and denied) are written to
`~/.claude/cast.db → tool_invocations`. View them in the app at the Tool Log page,
or query directly:

```sql
SELECT tool_name, decision, invoked_at FROM tool_invocations ORDER BY invoked_at DESC LIMIT 20;
```

**Safety:** `shell_exec` is restricted to an explicit allowlist of safe commands.
`fetch_url` is restricted to `localhost` origins only. No network or filesystem access
outside these scopes is possible through agent mode.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
