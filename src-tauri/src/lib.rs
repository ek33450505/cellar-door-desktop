mod commands;
mod db;
mod memory_router;
mod ollama;
pub mod permissions;
mod watcher;

use commands::chat::send_chat;
use commands::injection_log::list_injections;
use commands::memories::{fts_search, list_memories, memories_at, supersession_chain};
use memory_router::get_memory_context;
use notify::RecommendedWatcher;
use ollama::{ollama_health, ollama_models, OllamaSidecar};
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    /// Holds the spawned `ollama serve` child process.
    /// None if Ollama was already running when the app started (we didn't spawn it),
    /// or if Ollama is not installed.
    pub ollama: Mutex<Option<OllamaSidecar>>,
}

#[tauri::command]
fn ping_db() -> Result<String, String> {
    let conn = db::open_readonly().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM agent_memories", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!("agent_memories row count: {count}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            ping_db,
            list_memories,
            supersession_chain,
            memories_at,
            fts_search,
            list_injections,
            ollama_health,
            ollama_models,
            get_memory_context,
            send_chat,
        ])
        .setup(|app| {
            let watcher = crate::watcher::start_db_watcher(app.handle().clone())
                .expect("db watcher init failed");
            app.manage(AppState {
                watcher: Mutex::new(Some(watcher)),
                ollama: Mutex::new(None),
            });
            // Spawn ollama in a background async task — must not block setup.
            // Emits `ollama-ready` on success, `ollama-failed` (with reason) on failure.
            // If Ollama is not installed the app remains fully launchable —
            // inspector views from Phase 7a are unaffected.
            ollama::start_ollama(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
