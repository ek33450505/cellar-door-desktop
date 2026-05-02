/// Stub Tauri command for listing tool invocations from cast.db.
///
/// Full query implementation lands in Task 7.
/// This stub satisfies the type contract so the frontend can be wired early.

#[derive(Debug, serde::Serialize, serde::Deserialize)]
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

/// List tool invocations from cast.db, optionally filtered by session_id.
///
/// STUB — returns empty Vec until Task 7 wires the query.
#[tauri::command]
pub fn list_tool_invocations(
    session_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<ToolInvocationRow>, String> {
    // Suppress unused-variable warnings until Task 7 implements the real query.
    let _ = session_id;
    let _ = limit;
    Ok(vec![])
}
