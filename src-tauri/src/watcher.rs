use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

pub fn start_db_watcher(app: AppHandle) {
    let db_path = crate::db::db_path();
    let mut watcher = match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            if matches!(event.kind, notify::EventKind::Modify(_)) {
                let _ = app.emit("db-changed", ());
            }
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("watcher init failed: {e}");
            return;
        }
    };
    if let Err(e) = watcher.watch(&db_path, RecursiveMode::NonRecursive) {
        eprintln!("watch failed (cast.db may not exist yet): {e}");
        return;
    }
    // TODO 7b: store in AppState instead of leaking. For 7a, this is intentional.
    std::mem::forget(watcher);
}
