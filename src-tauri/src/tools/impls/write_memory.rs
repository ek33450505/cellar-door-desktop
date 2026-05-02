use crate::db;
use serde_json::{json, Value};

/// Write a new fact to agent_memories in cast.db.
///
/// Scope: MemoryWrite — this is the second write path to cast.db in Phase 7c.
/// The first write path is `db::log_tool_invocation` (tool_invocations table).
/// Both paths use `db::open_readwrite()` which applies Phase 7c migrations.
///
/// Parameters: `name` (required), `content` (required, must be non-empty),
///             `fact_type` (required).
pub fn run(args: Value) -> Result<Value, String> {
    let name = args["name"]
        .as_str()
        .ok_or_else(|| "missing required param: name".to_string())?;

    let content = args["content"]
        .as_str()
        .ok_or_else(|| "missing required param: content".to_string())?;

    let fact_type = args["fact_type"]
        .as_str()
        .ok_or_else(|| "missing required param: fact_type".to_string())?;

    // Validate content length > 0
    if content.is_empty() {
        return Err("content must not be empty".to_string());
    }

    let conn = db::open_readwrite().map_err(|e| e.to_string())?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO agent_memories (name, content, fact_type, agent, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name, content, fact_type, "cellar-door-desktop", now],
    )
    .map_err(|e| e.to_string())?;

    let row_id = conn.last_insert_rowid();
    Ok(json!({ "inserted_id": row_id, "name": name }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_name_returns_err() {
        let result = run(json!({ "content": "hello", "fact_type": "user" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: name"));
    }

    #[test]
    fn missing_content_returns_err() {
        let result = run(json!({ "name": "test", "fact_type": "user" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: content"));
    }

    #[test]
    fn empty_content_returns_err() {
        let result = run(json!({ "name": "test", "content": "", "fact_type": "user" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("content must not be empty"));
    }

    #[test]
    fn missing_fact_type_returns_err() {
        let result = run(json!({ "name": "test", "content": "hello" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: fact_type"));
    }
}
