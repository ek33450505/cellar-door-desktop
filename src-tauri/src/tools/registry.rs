use crate::permissions::PermissionScope;
use serde_json::{json, Value};

pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub scope: PermissionScope,
    /// JSON Schema string for Ollama tools param block.
    pub parameters_schema: &'static str,
}

pub static TOOL_REGISTRY: &[ToolDef] = &[
    ToolDef {
        name: "read_memory",
        description: "Retrieve memory facts from cast.db for a given query.",
        scope: PermissionScope::ReadOnly,
        parameters_schema: r#"{"type":"object","properties":{"query":{"type":"string"},"top_n":{"type":"integer","default":5}},"required":["query"]}"#,
    },
    ToolDef {
        name: "write_memory",
        description: "Write a new fact to agent_memories in cast.db.",
        scope: PermissionScope::MemoryWrite,
        parameters_schema: r#"{"type":"object","properties":{"name":{"type":"string"},"content":{"type":"string"},"fact_type":{"type":"string"}},"required":["name","content","fact_type"]}"#,
    },
    ToolDef {
        name: "list_dir",
        description: "List files in a directory (restricted to ~/Projects and ~/Documents).",
        scope: PermissionScope::ReadOnly,
        parameters_schema: r#"{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}"#,
    },
    ToolDef {
        name: "read_file",
        description: "Read the contents of a file (restricted to ~/Projects and ~/Documents).",
        scope: PermissionScope::ReadOnly,
        parameters_schema: r#"{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}"#,
    },
    ToolDef {
        name: "shell_exec",
        description: "Run an allowed shell command (allowlist: ollama, cast, git status, git log).",
        scope: PermissionScope::ShellExec,
        parameters_schema: r#"{"type":"object","properties":{"command":{"type":"string"},"args":{"type":"array","items":{"type":"string"}}},"required":["command"]}"#,
    },
    ToolDef {
        name: "fetch_url",
        description: "HTTP GET a URL (localhost only in 7c).",
        scope: PermissionScope::Network,
        parameters_schema: r#"{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}"#,
    },
];

/// Look up a tool by name. Returns None for hallucinated names.
pub fn find_tool(name: &str) -> Option<&'static ToolDef> {
    TOOL_REGISTRY.iter().find(|t| t.name == name)
}

/// Produce the Ollama `tools` array from TOOL_REGISTRY.
///
/// Architectural Decision 2 (Phase 7c plan): Ollama tool envelope is:
///   `{"type": "function", "function": {"name", "description", "parameters"}}`
/// where `parameters` is the parsed JSON Schema object.
pub fn ollama_tools_json() -> Vec<Value> {
    TOOL_REGISTRY
        .iter()
        .map(|t| {
            // parameters_schema is a compile-time &'static str — parse is infallible
            // for our controlled inputs. Fall back to an empty object on malformed JSON.
            let params: Value = serde_json::from_str(t.parameters_schema)
                .unwrap_or_else(|_| json!({"type": "object", "properties": {}}));
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": params
                }
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_tool_returns_some_for_known_names() {
        for def in TOOL_REGISTRY {
            assert!(find_tool(def.name).is_some(), "missing: {}", def.name);
        }
    }

    #[test]
    fn find_tool_returns_none_for_hallucinated_name() {
        assert!(find_tool("nonexistent_tool").is_none());
    }

    #[test]
    fn ollama_tools_json_has_correct_count() {
        let tools = ollama_tools_json();
        assert_eq!(tools.len(), TOOL_REGISTRY.len());
    }

    #[test]
    fn ollama_tools_json_envelope_shape() {
        let tools = ollama_tools_json();
        let first = &tools[0];
        assert_eq!(first["type"], "function");
        assert!(first["function"]["name"].is_string());
        assert!(first["function"]["description"].is_string());
        assert!(first["function"]["parameters"].is_object());
    }
}
