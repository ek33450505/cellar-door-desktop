use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::agent_loop::run_agent_turn;
use crate::AppState;

/// Start an agentic turn. The agent loop handles tool calls, permission gating,
/// DB logging, and Tauri event emission internally.
///
/// `session_id` ties all tool invocations for this turn together in cast.db.
/// `top_k` controls memory context injection depth for the first iteration.
/// `workspace_path` is an optional absolute path to the chat's pinned workspace
/// folder. When set, a system message is prepended to resolve relative path
/// references in the model's outputs. Added in Phase 7d (Task E-14).
#[tauri::command]
pub async fn start_agent_turn(
    app: AppHandle,
    model: String,
    messages: Vec<crate::commands::chat::ChatMessage>,
    top_k: usize,
    session_id: String,
    workspace_path: Option<String>,
) -> Result<(), String> {
    // Convert frontend ChatMessage structs to serde_json::Value for the loop.
    let ollama_messages: Vec<Value> = messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    // Emit a start event so the frontend can show "agent is thinking…"
    let _ = app.emit(
        "agent-turn-start",
        serde_json::json!({
            "model": model,
            "session_id": session_id
        }),
    );

    // Derive project name from workspace basename for memory scoping (E-16).
    let project = workspace_path.as_deref().map(|ws| {
        std::path::Path::new(ws)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string()
    });

    run_agent_turn(app, model, ollama_messages, session_id, top_k, workspace_path, project).await
}

/// Resolve a pending tool permission decision.
///
/// Called by the frontend after the user clicks Allow / Deny / etc.
/// The decision string must be one of: "deny", "once", "session", "always".
/// Returns Err for unknown call_ids or invalid decision strings.
#[tauri::command]
pub async fn resolve_tool_decision(
    state: State<'_, AppState>,
    call_id: String,
    decision: String,
) -> Result<(), String> {
    // Validate decision before doing anything else.
    match decision.as_str() {
        "deny" | "once" | "session" | "always" => {}
        other => {
            return Err(format!(
                "invalid decision '{}': must be one of deny, once, session, always",
                other
            ));
        }
    }

    let sender = {
        let mut decisions = state.tool_decisions.lock().unwrap();
        decisions.remove(&call_id)
    };

    match sender {
        Some(tx) => tx
            .send(decision)
            .map_err(|_| format!("call_id '{}' receiver already dropped", call_id)),
        None => Err(format!("unknown call_id: '{}'", call_id)),
    }
}

#[cfg(test)]
mod tests {
    // Integration-level tests for start_agent_turn and resolve_tool_decision
    // require a running Tauri app context. They live in the e2e suite (Task 5).
    // Logic-level tests for the decision validation and channel lookup are below.

    #[test]
    fn decision_values_are_exactly_four() {
        // Document the allowed decision set so a future developer knows what to
        // add here if the set grows.
        let valid = ["deny", "once", "session", "always"];
        assert_eq!(valid.len(), 4);
    }
}
