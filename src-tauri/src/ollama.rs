// macOS-first: Ollama is assumed to be installed by the user via `brew install ollama`.
// Ollama is NOT bundled with this app. Linux/Windows paths are not supported.
// See README.md Prerequisites section.

use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;

const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";
const HEALTH_URL: &str = "http://127.0.0.1:11434/api/tags";
const NOT_INSTALLED_MSG: &str =
    "Ollama is not installed. Install Ollama from https://ollama.com \
     (brew install ollama). Cellar Door Desktop assumes Ollama is installed; \
     it is not bundled.";

/// Holds the spawned `ollama serve` child process.
/// Dropping this struct kills the child process — no zombies.
pub struct OllamaSidecar {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

impl OllamaSidecar {
    /// Spawn `ollama serve` via tauri-plugin-shell.
    /// Returns Err with installation guidance if `ollama` is not on PATH.
    pub fn spawn(app: &AppHandle) -> Result<OllamaSidecar, String> {
        let shell = app.shell();
        let (mut rx, child) = shell
            .command("ollama")
            .args(["serve"])
            .spawn()
            .map_err(|e| {
                // If the binary is not found, provide installation guidance.
                if e.to_string().contains("No such file")
                    || e.to_string().contains("not found")
                    || e.to_string().contains("os error 2")
                {
                    NOT_INSTALLED_MSG.to_string()
                } else {
                    format!("Failed to spawn ollama serve: {e}")
                }
            })?;

        // Drain the child output channel in a background task to avoid blocking.
        // We don't need to process output from `ollama serve` — it logs to its own stderr.
        tauri::async_runtime::spawn(async move {
            while rx.recv().await.is_some() {}
        });

        Ok(OllamaSidecar {
            child: Mutex::new(Some(child)),
        })
    }

    /// Poll `GET /api/tags` until 200 OK or timeout.
    /// Returns Err with descriptive message if Ollama is not responding.
    pub async fn health_check(&self, timeout: Duration) -> Result<(), String> {
        let client = reqwest::Client::new();
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            match client.get(HEALTH_URL).send().await {
                Ok(resp) if resp.status().is_success() => return Ok(()),
                _ => {}
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(format!(
                    "Ollama health check timed out after {}s. \
                     Ensure `ollama serve` is running or install from https://ollama.com.",
                    timeout.as_secs()
                ));
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }

    /// Kill the child process explicitly. Called on app exit.
    pub fn kill(&self) {
        let mut guard = self.child.lock().unwrap();
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }
}

impl Drop for OllamaSidecar {
    fn drop(&mut self) {
        self.kill();
    }
}

/// Check whether Ollama is already running by hitting the base URL.
pub async fn is_ollama_running() -> bool {
    reqwest::get(OLLAMA_BASE_URL).await.is_ok()
}

/// GET /api/tags and return model names.
pub async fn list_models() -> Result<Vec<String>, String> {
    let resp = reqwest::get(HEALTH_URL)
        .await
        .map_err(|e| format!("Failed to reach Ollama: {e}"))?;
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama tags response: {e}"))?;
    let models = json["models"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| m["name"].as_str().map(String::from))
        .collect();
    Ok(models)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Returns true if Ollama is running and responding.
#[tauri::command]
pub async fn ollama_health() -> Result<bool, String> {
    Ok(is_ollama_running().await)
}

/// Returns the list of locally-pulled model names.
#[tauri::command]
pub async fn ollama_models() -> Result<Vec<String>, String> {
    list_models().await
}

// ---------------------------------------------------------------------------
// App-level lifecycle helpers
// ---------------------------------------------------------------------------

/// Spawn ollama if not already running, then run a health check.
/// Emits `ollama-ready` on success, `ollama-failed` (with reason) on failure.
/// This is called once from lib.rs setup — must not block the main thread.
pub fn start_ollama(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if is_ollama_running().await {
            let _ = app.emit("ollama-ready", ());
            // Even if already running we still launch the polling loop below.
        } else {
            match OllamaSidecar::spawn(&app) {
                Err(e) => {
                    let _ = app.emit(
                        "ollama-failed",
                        serde_json::json!({ "reason": e }),
                    );
                    // State already initialized with None in lib.rs setup — nothing to update.
                    return;
                }
                Ok(sidecar) => {
                    // Run health check — up to 10 seconds.
                    match sidecar.health_check(Duration::from_secs(10)).await {
                        Ok(()) => {
                            let _ = app.emit("ollama-ready", ());
                            // Store the sidecar so AppState keeps it alive.
                            let state = app.state::<crate::AppState>();
                            let mut guard = state.ollama.lock().unwrap();
                            *guard = Some(sidecar);
                        }
                        Err(reason) => {
                            let _ = app.emit(
                                "ollama-failed",
                                serde_json::json!({ "reason": reason }),
                            );
                        }
                    }
                }
            }
        }

        // Background polling loop: check health every 5s.
        // First failure → attempt one re-spawn. Second failure → emit dead.
        let poll_app = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut failure_count = 0u8;
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                if is_ollama_running().await {
                    failure_count = 0;
                    continue;
                }
                failure_count += 1;
                if failure_count == 1 {
                    // First failure — attempt one re-spawn.
                    match OllamaSidecar::spawn(&poll_app) {
                        Err(e) => {
                            let _ = poll_app.emit(
                                "ollama-failed",
                                serde_json::json!({ "reason": e }),
                            );
                        }
                        Ok(sidecar) => {
                            // Wait briefly for the new process to start.
                            tokio::time::sleep(Duration::from_secs(3)).await;
                            if is_ollama_running().await {
                                let _ = poll_app.emit("ollama-ready", ());
                                let state = poll_app.state::<crate::AppState>();
                                let mut guard = state.ollama.lock().unwrap();
                                *guard = Some(sidecar);
                                failure_count = 0;
                            } else {
                                let _ = poll_app.emit(
                                    "ollama-failed",
                                    serde_json::json!({
                                        "reason": "Ollama re-spawn failed — health check did not pass"
                                    }),
                                );
                            }
                        }
                    }
                } else {
                    // Second consecutive failure → dead.
                    let _ = poll_app.emit(
                        "ollama-failed",
                        serde_json::json!({
                            "reason": "Ollama is not responding after re-spawn attempt"
                        }),
                    );
                    // Reset counter to avoid infinite dead-event spam — back off.
                    failure_count = 0;
                }
            }
        });
    });
}
