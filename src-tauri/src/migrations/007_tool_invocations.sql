-- Migration 007: tool_invocations audit log
-- This is the ONLY new write path Phase 7c adds to cast.db.
-- No other table is written by Phase 7c code.

CREATE TABLE IF NOT EXISTS tool_invocations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,  -- Tauri session UUID (set at app start)
    call_id     TEXT    NOT NULL,  -- UUID per tool call (frontend correlation)
    tool_name   TEXT    NOT NULL,
    scope       TEXT    NOT NULL,  -- ReadOnly | MemoryWrite | ShellExec | Network
    arguments   TEXT    NOT NULL,  -- JSON string
    decision    TEXT    NOT NULL,  -- deny | once | session | always
    result      TEXT,              -- JSON string, NULL if denied
    error       TEXT,              -- error message if execution failed
    duration_ms INTEGER,           -- execution time in milliseconds
    invoked_at  INTEGER NOT NULL   -- Unix timestamp (seconds)
);

CREATE INDEX IF NOT EXISTS idx_tool_inv_session ON tool_invocations(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_inv_at ON tool_invocations(invoked_at);
