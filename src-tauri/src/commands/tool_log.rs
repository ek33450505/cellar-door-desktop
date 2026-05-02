/// Tauri command for listing tool invocations from cast.db.
///
/// Uses `db::open_readonly()` — this is a read-only query; no migration or
/// write-side overhead needed. The read-only opener is the correct path for
/// audit log reads (consistent with how `list_injections` and `list_memories`
/// are implemented in the adjacent commands).

use crate::db;

const DEFAULT_LIMIT: usize = 50;
const MAX_LIMIT: usize = 200;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInvocationRow {
    pub id: i64,
    pub session_id: String,
    pub call_id: String,
    pub tool_name: String,
    pub scope: String,
    pub arguments: String,
    pub decision: String,
    pub result: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i64>,
    pub invoked_at: i64,
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ToolInvocationRow> {
    Ok(ToolInvocationRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        call_id: row.get(2)?,
        tool_name: row.get(3)?,
        scope: row.get(4)?,
        arguments: row.get(5)?,
        decision: row.get(6)?,
        result: row.get(7)?,
        error: row.get(8)?,
        duration_ms: row.get(9)?,
        invoked_at: row.get(10)?,
    })
}

/// List tool invocations from cast.db, optionally filtered by session_id.
///
/// - `session_id`: when Some, filters to that session only; None returns all sessions.
/// - `limit`: capped at MAX_LIMIT (200); defaults to DEFAULT_LIMIT (50).
/// - Results are ordered newest-first (invoked_at DESC).
#[tauri::command]
pub fn list_tool_invocations(
    session_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<ToolInvocationRow>, String> {
    let effective_limit = limit
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT) as i64;

    let conn = db::open_readonly().map_err(|e| e.to_string())?;

    if let Some(ref sid) = session_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, session_id, call_id, tool_name, scope, arguments,
                        decision, result, error, duration_ms, invoked_at
                   FROM tool_invocations
                  WHERE session_id = ?1
                  ORDER BY invoked_at DESC
                  LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let rows: Vec<ToolInvocationRow> = stmt
            .query_map(rusqlite::params![sid, effective_limit], map_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, session_id, call_id, tool_name, scope, arguments,
                        decision, result, error, duration_ms, invoked_at
                   FROM tool_invocations
                  ORDER BY invoked_at DESC
                  LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;

        let rows: Vec<ToolInvocationRow> = stmt
            .query_map(rusqlite::params![effective_limit], map_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }
}
