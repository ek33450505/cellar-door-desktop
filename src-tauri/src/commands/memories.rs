use crate::db;
use rusqlite::params;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MemoryRow {
    pub id: i64,
    pub agent: String,
    pub name: String,
    pub memory_type: String,
    pub content: String,
    pub source_type: String,
    pub valid_from: String,
    pub valid_to: Option<String>,
    /// Derived: true when superseded_by IS NOT NULL
    pub superseded: bool,
}

/// Map a rusqlite Row into MemoryRow.
/// SELECT must alias `type AS memory_type` and include superseded_by.
fn row_to_memory(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryRow> {
    let superseded_by: Option<i64> = row.get(8)?;
    Ok(MemoryRow {
        id: row.get(0)?,
        agent: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        memory_type: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        content: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
        source_type: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
        valid_from: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        valid_to: row.get(7)?,
        superseded: superseded_by.is_some(),
    })
}

const BASE_SELECT: &str =
    "SELECT id, agent, name, type AS memory_type, content, source_type, valid_from, valid_to, superseded_by \
     FROM agent_memories";

#[tauri::command]
pub fn list_memories(
    agent: Option<String>,
    memory_type: Option<String>,
    source_type: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<MemoryRow>, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(200);

    let mut conditions: Vec<&str> = Vec::new();
    if agent.is_some() {
        conditions.push("agent = ?1");
    }
    if memory_type.is_some() {
        conditions.push("type = ?2");
    }
    if source_type.is_some() {
        conditions.push("source_type = ?3");
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let sql = format!("{}{} ORDER BY valid_from DESC LIMIT ?4", BASE_SELECT, where_clause);

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![agent, memory_type, source_type, lim],
            row_to_memory,
        )
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
pub fn supersession_chain(name: String, agent: String) -> Result<Vec<MemoryRow>, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE name = ?1 AND agent = ?2 ORDER BY valid_from DESC",
        BASE_SELECT
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![name, agent], row_to_memory)
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
pub fn memories_at(timestamp: String, agent: Option<String>) -> Result<Vec<MemoryRow>, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;

    let where_clause = if agent.is_some() {
        "WHERE valid_from <= ?1 AND (valid_to IS NULL OR valid_to > ?1) AND agent = ?2"
    } else {
        "WHERE valid_from <= ?1 AND (valid_to IS NULL OR valid_to > ?1)"
    };

    let sql = format!("{} {} ORDER BY valid_from DESC", BASE_SELECT, where_clause);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![timestamp, agent], row_to_memory)
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
pub fn fts_search(query: String, limit: Option<i64>) -> Result<Vec<MemoryRow>, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(50);
    // Parameterized binding — no string interpolation of user input (security requirement)
    let sql = format!(
        "SELECT m.id, m.agent, m.name, m.type AS memory_type, m.content, m.source_type, \
         m.valid_from, m.valid_to, m.superseded_by \
         FROM agent_memories_fts f \
         JOIN agent_memories m ON m.id = f.rowid \
         WHERE f MATCH ?1 \
         LIMIT ?2"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![query, lim], row_to_memory)
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}
