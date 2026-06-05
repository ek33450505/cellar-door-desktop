# Changelog

## [0.1.1] — 2026-06-05

### Fixed
- `scripts/cast-memory-router.py`: fix `sys.path` to use `~/.claude/scripts` explicitly so the script works after `install.sh` deploys it to `~/.claude/scripts/cellar-door/` where `cast_db.py` is absent (was causing silent `ModuleNotFoundError` on first invocation)
- `scripts/cast-memory-router.py`: port `_is_safe_url` guard to prevent SSRF via crafted `OLLAMA_EMBED_URL`
- `scripts/cast-memory-router.py`: port `_log_injection` for injection_log telemetry observability
- `scripts/cast-memory-router.py`: port `agent_type`/lightweight-agent filtering (`commit`, `push`, `merge`, `code-reviewer` exclude `project`/`reference` memory types); preserve existing `project_filter` param
- `src-tauri/Cargo.toml`: replace placeholder `authors = ["you"]` and `description = "A Tauri App"` with real values
- `README.md`: replace Tauri scaffold title and remove boilerplate template paragraph
- `src-tauri/src/db.rs`: remove `2026-05-XX` placeholder date
- `src-tauri/src/agent_loop.rs`: remove `(was _top_k TODO stub)` stale comment
- `src-tauri/tauri.conf.json`: remove empty `pubkey: ""` updater block

### Changed
- Bump version 0.1.0 → 0.1.1 across `package.json`, `tauri.conf.json`, `Cargo.toml`
