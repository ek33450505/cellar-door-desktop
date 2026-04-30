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
    Ok(conn)
}
