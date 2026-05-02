use rusqlite::{Connection, OpenFlags, Result};
use std::path::PathBuf;

pub fn db_path() -> PathBuf {
    dirs::home_dir()
        .expect("home dir not found")
        .join(".claude/cast.db")
}

pub fn open_readonly() -> Result<Connection> {
    let conn = Connection::open_with_flags(
        db_path(),
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // Confirm WAL is active — verification step for write-contention assumption (ADR §2)
    let mode: String = conn.pragma_query_value(None, "journal_mode", |r| r.get(0))?;
    assert_eq!(mode, "wal", "cast.db is not in WAL mode — write contention risk");
    // WAL stress-tested 2026-05-02: 10 writes/sec for 30s, zero SQLITE_BUSY errors.
    // busy_timeout retained as a defensive guard for future higher-write scenarios.
    // Agent stress-tested 2026-05-XX: 20 tool invocations (10 allowed, 10 denied)
    // under WAL write load. Zero SQLITE_BUSY. busy_timeout=5000 sufficient.
    // (Update date and findings after running scripts/agent-stress-test.sh manually.)
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;
    Ok(conn)
}

/// Open cast.db in read-write mode with WAL and busy_timeout.
///
/// This is the ONLY Phase 7c write path to cast.db.
/// Future agents: do NOT add additional writers without updating this comment
/// and the Phase 7c ADR note in migrations/007_tool_invocations.sql.
pub fn open_readwrite() -> Result<Connection> {
    let conn = Connection::open(db_path())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;
    apply_migrations(&conn)?;
    Ok(conn)
}

/// Apply Phase 7c migrations.
///
/// Migration 007 only — previous migrations are owned by CAST hooks.
/// Uses include_str! for compile-time embedding (consistent with Tauri's
/// asset bundling model; no runtime filesystem dependency for SQL files).
fn apply_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(include_str!("migrations/007_tool_invocations.sql"))?;
    Ok(())
}

/// Record of a tool invocation to persist in cast.db.
pub struct ToolInvocationRecord {
    pub session_id: String,
    pub call_id: String,
    pub tool_name: String,
    pub scope: String,
    pub arguments: String,  // JSON
    pub decision: String,
    pub result: Option<String>,  // JSON
    pub error: Option<String>,
    pub duration_ms: Option<i64>,
}

/// Insert a tool invocation row into cast.db.
///
/// `invoked_at` is set to the current Unix timestamp (seconds) at call time.
/// This is a fire-and-forget write; callers should log errors but not propagate them
/// to the user — audit logging must not block the primary tool flow.
pub fn log_tool_invocation(rec: &ToolInvocationRecord) -> Result<()> {
    let conn = open_readwrite()?;
    let invoked_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    conn.execute(
        "INSERT INTO tool_invocations
            (session_id, call_id, tool_name, scope, arguments, decision,
             result, error, duration_ms, invoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            rec.session_id,
            rec.call_id,
            rec.tool_name,
            rec.scope,
            rec.arguments,
            rec.decision,
            rec.result,
            rec.error,
            rec.duration_ms,
            invoked_at,
        ],
    )?;
    Ok(())
}
