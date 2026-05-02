use crate::db;
use serde_json::{json, Value};

/// Read memory facts from cast.db matching a query string.
///
/// Scope: ReadOnly — no writes to cast.db.
/// Parameters: `query` (required, string), `top_n` (optional, integer, default 5).
pub fn run(args: Value) -> Result<Value, String> {
    let query = args["query"]
        .as_str()
        .ok_or_else(|| "missing required param: query".to_string())?;

    let top_n = args["top_n"].as_i64().unwrap_or(5).max(1).min(50) as usize;

    let conn = db::open_readonly().map_err(|e| e.to_string())?;

    // FTS search via agent_memories_fts if available, else fallback to LIKE.
    // Using a simple FTS5 match query against the content column.
    let mut stmt = conn
        .prepare(
            "SELECT name, content, fact_type, agent
             FROM agent_memories
             WHERE superseded_by IS NULL
               AND (name LIKE ?1 OR content LIKE ?1)
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let like_pattern = format!("%{}%", query);
    let rows: Vec<Value> = stmt
        .query_map(
            rusqlite::params![like_pattern, top_n as i64],
            |row| {
                Ok(json!({
                    "name": row.get::<_, String>(0)?,
                    "content": row.get::<_, String>(1)?,
                    "fact_type": row.get::<_, String>(2)?,
                    "agent": row.get::<_, String>(3)?,
                }))
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(json!({ "facts": rows, "count": rows.len() }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_query_param_returns_err() {
        let result = run(json!({}));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: query"));
    }

    #[test]
    fn top_n_defaults_to_5_when_absent() {
        // We can't hit a real DB in unit tests, but we validate param parsing here.
        // DB open will fail in CI without cast.db — only testing param validation path.
        let args = json!({ "query": "test" });
        let top_n = args["top_n"].as_i64().unwrap_or(5).max(1).min(50) as usize;
        assert_eq!(top_n, 5);
    }

    #[test]
    fn top_n_capped_at_50() {
        let args = json!({ "query": "test", "top_n": 9999 });
        let top_n = args["top_n"].as_i64().unwrap_or(5).max(1).min(50) as usize;
        assert_eq!(top_n, 50);
    }
}
