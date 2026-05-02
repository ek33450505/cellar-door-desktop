use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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
        let _ = fs::write(&path, json);
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
    pub fn record(&mut self, tool_name: &str, grant: PermissionGrant) {
        match &grant {
            PermissionGrant::AllowAlways => {
                self.persistent
                    .insert(tool_name.to_string(), grant.clone());
                save_persistent(&self.persistent);
                self.session.insert(tool_name.to_string(), grant);
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
}
