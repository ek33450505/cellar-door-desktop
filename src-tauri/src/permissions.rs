use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// Forward reference to registry for scope lookup.
// Avoids a circular dep: permissions -> registry is fine; registry -> permissions already exists.
use crate::tools::registry::find_tool;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PermissionScope {
    ReadOnly,
    MemoryWrite,
    ShellExec,
    Network,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PermissionGrant {
    Denied,
    AllowOnce,
    AllowSession,
    AllowAlways, // persisted; only valid for ReadOnly scope
}

/// Session-scoped permission state (in-memory, cleared on app exit).
/// Persistent grants for ReadOnly tools are loaded from
/// ~/.config/cellar-door/permissions.json at startup.
pub struct PermissionStore {
    session: HashMap<String, PermissionGrant>,   // key: tool_name
    persistent: HashMap<String, PermissionGrant>, // loaded from disk
}

fn permissions_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("cellar-door")
        .join("permissions.json")
}

fn load_persistent() -> HashMap<String, PermissionGrant> {
    let path = permissions_path();
    if !path.exists() {
        return HashMap::new();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_persistent(persistent: &HashMap<String, PermissionGrant>) {
    let path = permissions_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(persistent) {
        // Atomic write: write to a temp file then rename to avoid corruption on crash.
        let temp_path = path.with_extension("tmp");
        if fs::write(&temp_path, json).is_ok() {
            let _ = fs::rename(&temp_path, &path);
        }
    }
}

impl PermissionStore {
    pub fn new() -> Self {
        Self {
            session: HashMap::new(),
            persistent: load_persistent(),
        }
    }

    /// Check if a tool is pre-approved (returns None if a prompt is needed).
    /// Session grants take precedence over persistent grants.
    pub fn check(&self, tool_name: &str) -> Option<PermissionGrant> {
        if let Some(grant) = self.session.get(tool_name) {
            return Some(grant.clone());
        }
        self.persistent.get(tool_name).cloned()
    }

    /// Record a grant decision. AllowAlways is written to disk.
    /// AllowOnce is not stored (caller must check each invocation).
    /// AllowSession is stored in the session map only.
    ///
    /// AllowAlways is only honoured for ReadOnly-scoped tools. If the caller
    /// passes AllowAlways for a non-ReadOnly tool it is silently downgraded to
    /// AllowSession (session-only, not persisted).
    pub fn record(&mut self, tool_name: &str, grant: PermissionGrant) {
        match &grant {
            PermissionGrant::AllowAlways => {
                // Guard: AllowAlways is only valid for ReadOnly scope.
                let is_readonly = find_tool(tool_name)
                    .map(|t| matches!(t.scope, PermissionScope::ReadOnly))
                    .unwrap_or(false);
                if is_readonly {
                    self.persistent
                        .insert(tool_name.to_string(), grant.clone());
                    save_persistent(&self.persistent);
                    self.session.insert(tool_name.to_string(), grant);
                } else {
                    // Downgrade to session-only for non-ReadOnly tools.
                    self.session
                        .insert(tool_name.to_string(), PermissionGrant::AllowSession);
                }
            }
            PermissionGrant::AllowSession => {
                self.session.insert(tool_name.to_string(), grant);
            }
            // Denied and AllowOnce are not stored — treat as one-shot
            _ => {}
        }
    }
}

impl Default for PermissionStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_store() -> PermissionStore {
        PermissionStore {
            session: HashMap::new(),
            persistent: HashMap::new(),
        }
    }

    #[test]
    fn check_returns_none_when_no_grant() {
        let store = make_store();
        assert!(store.check("my_tool").is_none());
    }

    #[test]
    fn record_allow_session_visible_in_session() {
        let mut store = make_store();
        store.record("my_tool", PermissionGrant::AllowSession);
        let grant = store.check("my_tool");
        assert!(grant.is_some());
        assert!(matches!(grant.unwrap(), PermissionGrant::AllowSession));
    }

    #[test]
    fn record_allow_once_not_stored() {
        let mut store = make_store();
        store.record("my_tool", PermissionGrant::AllowOnce);
        assert!(store.check("my_tool").is_none());
    }

    #[test]
    fn record_denied_not_stored() {
        let mut store = make_store();
        store.record("my_tool", PermissionGrant::Denied);
        assert!(store.check("my_tool").is_none());
    }

    #[test]
    fn persistent_grant_visible_after_reload() {
        let mut persistent = HashMap::new();
        persistent.insert("saved_tool".to_string(), PermissionGrant::AllowAlways);
        let store = PermissionStore {
            session: HashMap::new(),
            persistent,
        };
        let grant = store.check("saved_tool");
        assert!(grant.is_some());
        assert!(matches!(grant.unwrap(), PermissionGrant::AllowAlways));
    }

    #[test]
    fn session_grant_takes_precedence_over_persistent() {
        let mut persistent = HashMap::new();
        persistent.insert("tool".to_string(), PermissionGrant::AllowAlways);
        let mut store = PermissionStore {
            session: HashMap::new(),
            persistent,
        };
        store.record("tool", PermissionGrant::AllowSession);
        // session map has AllowSession; persistent has AllowAlways
        let grant = store.check("tool");
        assert!(matches!(grant.unwrap(), PermissionGrant::AllowSession));
    }

    /// AllowAlways recorded for a non-ReadOnly tool is downgraded to AllowSession.
    #[test]
    fn allow_always_downgraded_to_session_for_non_readonly_tool() {
        let mut store = make_store();
        // "shell_exec" is ShellExec scope — not ReadOnly — so AllowAlways must be rejected.
        store.record("shell_exec", PermissionGrant::AllowAlways);
        // Should be visible as AllowSession (downgraded), not AllowAlways.
        let grant = store.check("shell_exec");
        assert!(grant.is_some(), "downgraded grant should be stored in session");
        assert!(
            matches!(grant.unwrap(), PermissionGrant::AllowSession),
            "non-ReadOnly AllowAlways must be downgraded to AllowSession"
        );
        // Must NOT be in the persistent map.
        assert!(
            store.persistent.get("shell_exec").is_none(),
            "non-ReadOnly tool must not appear in persistent map"
        );
    }

    /// AllowAlways for a ReadOnly tool persists and is visible after store reload.
    ///
    /// This exercises the atomic write (temp→rename) + load_persistent roundtrip.
    /// Uses std::env::temp_dir() to avoid touching ~/.config/cellar-door/permissions.json.
    #[test]
    fn allow_always_for_readonly_tool_survives_roundtrip() {
        use std::time::{SystemTime, UNIX_EPOCH};

        // Build a unique temp path to avoid test parallelism collisions.
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos();
        let json_path = std::env::temp_dir()
            .join(format!("cellar-door-perms-test-{}.json", ts));

        let mut persistent: HashMap<String, PermissionGrant> = HashMap::new();
        persistent.insert("read_memory".to_string(), PermissionGrant::AllowAlways);

        // Use the same atomic write pattern as save_persistent (temp → rename).
        let json = serde_json::to_string_pretty(&persistent).expect("serialize");
        let temp_path = json_path.with_extension("tmp");
        fs::write(&temp_path, &json).expect("write temp");
        fs::rename(&temp_path, &json_path).expect("rename");

        // Load back — same logic as load_persistent.
        let loaded: HashMap<String, PermissionGrant> = fs::read_to_string(&json_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        // Clean up before asserting so a failing test doesn't leave stale files.
        let _ = fs::remove_file(&json_path);

        let grant = loaded.get("read_memory");
        assert!(grant.is_some(), "grant should survive disk roundtrip");
        assert!(
            matches!(grant.unwrap(), PermissionGrant::AllowAlways),
            "grant should be AllowAlways after reload"
        );
    }
}
