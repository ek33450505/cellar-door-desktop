use crate::memory_router::{facts_to_system_prompt, query_relevant_facts};
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

#[derive(serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Send a chat message to Ollama with memory-injected system context.
///
/// Steps:
/// 1. Extract the latest user message from `messages` for memory retrieval.
/// 2. Query the memory router for the top-K relevant facts (graceful
///    degradation: chat works even if the router is unavailable).
/// 3. Build a system message from the retrieved facts.
/// 4. POST to Ollama /api/chat with the full message history (system first).
/// 5. Stream NDJSON chunks back as `chat-token` Tauri events.
#[tauri::command]
pub async fn send_chat(
    app: AppHandle,
    model: String,
    messages: Vec<ChatMessage>,
    top_k: usize,
) -> Result<(), String> {
    // 1. Extract latest user message for memory query
    let user_prompt = messages
        .last()
        .filter(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    // 2. Memory injection — graceful degradation on failure
    // No project scoping for the non-agent chat path (no workspace in this command).
    let facts = query_relevant_facts(user_prompt, top_k, "shared", None).unwrap_or_default();
    let system_content = facts_to_system_prompt(&facts);

    // 3. Build Ollama request — prepend system message only when facts are present
    let mut ollama_messages: Vec<serde_json::Value> = Vec::new();
    if !system_content.is_empty() {
        ollama_messages.push(serde_json::json!({
            "role": "system",
            "content": system_content
        }));
    }
    for m in &messages {
        ollama_messages.push(serde_json::json!({
            "role": m.role,
            "content": m.content
        }));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": ollama_messages,
        "stream": true
    });

    // 4. POST to Ollama /api/chat and stream response
    let client = reqwest::Client::new();
    let mut stream = client
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes_stream();

    // 5. Emit chat-token events for each NDJSON chunk
    while let Some(chunk) = stream.next().await {
        let chunk_bytes = chunk.map_err(|e| e.to_string())?;
        let line = match std::str::from_utf8(&chunk_bytes) {
            Ok(s) => s.trim().to_string(),
            Err(_e) => {
                eprintln!("chat: malformed UTF-8 chunk, len={}", chunk_bytes.len());
                continue;
            }
        };
        if line.is_empty() {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            let token = json["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let done = json["done"].as_bool().unwrap_or(false);
            let _ = app.emit("chat-token", serde_json::json!({ "token": token, "done": done }));
            if done {
                break;
            }
        }
    }

    Ok(())
}
