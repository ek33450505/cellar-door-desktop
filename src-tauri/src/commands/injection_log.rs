use crate::db;
use rusqlite::params;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InjectionRow {
    pub id: i64,
    pub session_id: String,
    pub agent: String,
    pub injected_at: String,
    pub memory_id: i64,
    pub memory_name: String,
    pub memory_content: String,
}

#[tauri::command]
pub fn list_injections(
    session_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<InjectionRow>, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(100);

    // injection_log uses fact_id; JOIN agent_memories for name + content.
    // agent_memories has no agent column in injection_log — derive from joined table.
    let base_sql = "SELECT il.id, \
         COALESCE(il.session_id, '') AS session_id, \
         COALESCE(m.agent, '') AS agent, \
         il.injected_at, \
         il.fact_id AS memory_id, \
         COALESCE(m.name, '') AS memory_name, \
         COALESCE(m.content, '') AS memory_content \
         FROM injection_log il \
         LEFT JOIN agent_memories m ON m.id = il.fact_id";

    let sql = if session_id.is_some() {
        format!("{} WHERE il.session_id = ?1 ORDER BY il.injected_at DESC LIMIT ?2", base_sql)
    } else {
        format!("{} ORDER BY il.injected_at DESC LIMIT ?2", base_sql)
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id, lim], |row| {
            Ok(InjectionRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                agent: row.get(2)?,
                injected_at: row.get(3)?,
                memory_id: row.get(4)?,
                memory_name: row.get(5)?,
                memory_content: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}
