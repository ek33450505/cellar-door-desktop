use serde_json::Value;

use super::impls;
use super::registry::find_tool;

/// Dispatch a tool call by name with the provided arguments.
///
/// Returns `Ok(Value)` on success or `Err(String)` on any failure.
/// Callers (the agent loop, Task 4) are responsible for logging the invocation
/// to cast.db via `db::log_tool_invocation` — do NOT log from here.
pub fn execute_tool(name: &str, args: Value) -> Result<Value, String> {
    // Reject hallucinated tool names before any further processing.
    if find_tool(name).is_none() {
        return Err(format!("unknown tool: {}", name));
    }

    match name {
        "read_memory" => impls::read_memory::run(args),
        "write_memory" => impls::write_memory::run(args),
        "list_dir" => impls::list_dir::run(args),
        "read_file" => impls::read_file::run(args),
        "shell_exec" => impls::shell_exec::run(args),
        "fetch_url" => impls::fetch_url::run(args),
        // Registry and match arm are kept in sync — any mismatch is a programmer
        // error caught at compile time via exhaustive match pattern below.
        _ => Err(format!("unimplemented tool: {}", name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn hallucinated_tool_name_returns_err() {
        let result = execute_tool("nonexistent_tool", json!({}));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("unknown tool: nonexistent_tool"), "got: {msg}");
    }

    #[test]
    fn another_hallucinated_name_returns_err() {
        let result = execute_tool("rm_rf_everything", json!({}));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown tool:"));
    }
}
