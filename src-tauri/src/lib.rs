mod commands;
mod db;

use commands::injection_log::list_injections;
use commands::memories::{fts_search, list_memories, memories_at, supersession_chain};

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
        .invoke_handler(tauri::generate_handler![
            ping_db,
            list_memories,
            supersession_chain,
            memories_at,
            fts_search,
            list_injections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
