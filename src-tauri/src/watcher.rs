use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Start the cast.db file watcher and return the watcher so the caller can
/// store it in AppState. The watcher must remain alive for as long as the app
/// runs — dropping it stops event delivery.
pub fn start_db_watcher(app: AppHandle) -> notify::Result<RecommendedWatcher> {
    let db_path = crate::db::db_path();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            if matches!(event.kind, notify::EventKind::Modify(_)) {
                let _ = app.emit("db-changed", ());
            }
        }
    })?;
    watcher.watch(&db_path, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}
