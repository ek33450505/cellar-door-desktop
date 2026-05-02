use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// Allowed root directories. Paths must resolve under one of these.
const ALLOWED_ROOTS: &[&str] = &["~/Projects", "~/Documents"];

/// Expand and canonicalize an allowed root for prefix comparison.
fn expand_root(root: &str) -> Option<PathBuf> {
    let expanded = shellexpand::tilde(root).to_string();
    // Use PathBuf for the prefix — don't require the directory to exist on disk
    Some(PathBuf::from(expanded))
}

/// Validate that `path` (already expanded) starts with one of the allowed roots.
/// Uses `Path::starts_with` on canonical components to defeat `../` traversal.
///
/// Note: We canonicalize the input path via `fs::canonicalize` which resolves
/// symlinks. If the path does not yet exist, we fall back to a lexical prefix
/// check after normalizing `..` components. This is conservative: a non-existent
/// path under an allowed root is permitted to proceed to the filesystem call
/// which will return a "not found" error naturally.
fn validate_path(expanded: &str) -> Result<PathBuf, String> {
    let input = PathBuf::from(expanded);

    // Attempt canonical resolution (requires path to exist).
    let resolved = if input.exists() {
        fs::canonicalize(&input).map_err(|e| format!("path error: {e}"))?
    } else {
        // Lexical normalization for non-existent paths: walk components and
        // collapse `..` to prevent traversal without requiring existence.
        normalize_path(&input)
    };

    let allowed: Vec<PathBuf> = ALLOWED_ROOTS
        .iter()
        .filter_map(|r| expand_root(r))
        .collect();

    for root in &allowed {
        // Canonicalize the allowed root too (it must exist)
        let canonical_root = if root.exists() {
            fs::canonicalize(root).unwrap_or_else(|_| root.clone())
        } else {
            root.clone()
        };
        if resolved.starts_with(&canonical_root) {
            return Ok(resolved);
        }
    }

    Err(format!(
        "path not allowed: must be under ~/Projects or ~/Documents"
    ))
}

/// Lexically normalize a path by resolving `..` components without I/O.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components: Vec<_> = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                // Pop last component if possible; if at root, ignore
                if !components.is_empty() {
                    components.pop();
                }
            }
            std::path::Component::CurDir => { /* skip */ }
            other => components.push(other),
        }
    }
    components.iter().collect()
}

/// List files and directories under a given path.
///
/// Scope: ReadOnly — restricted to ~/Projects and ~/Documents.
/// Returns `Err("path not allowed")` for any path outside these roots,
/// including `../` traversal attempts.
pub fn run(args: Value) -> Result<Value, String> {
    let raw_path = args["path"]
        .as_str()
        .ok_or_else(|| "missing required param: path".to_string())?;

    let expanded = shellexpand::tilde(raw_path).to_string();
    let validated = validate_path(&expanded)?;

    // Re-canonicalize at read time to close symlink-swap TOCTOU window.
    let final_path = std::fs::canonicalize(&validated)
        .map_err(|e| format!("path error at read time: {e}"))?;
    // Re-check after re-canonicalization (symlink may now point outside allowed roots).
    let _ = validate_path(&final_path.to_string_lossy())?;

    let entries: Vec<Value> = fs::read_dir(&final_path)
        .map_err(|e| format!("read_dir error: {e}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().ok()?.is_dir();
            Some(json!({ "name": name, "is_dir": is_dir }))
        })
        .collect();

    Ok(json!({ "path": final_path.to_string_lossy(), "entries": entries }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_path_param_returns_err() {
        let result = run(json!({}));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: path"));
    }

    #[test]
    fn etc_passwd_returns_err() {
        let result = run(json!({ "path": "/etc/passwd" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path not allowed"));
    }

    #[test]
    fn dotdot_traversal_returns_err() {
        // Attempt to escape via ../ from a nominally allowed path
        let result = run(json!({ "path": "../../etc/passwd" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path not allowed"));
    }

    #[test]
    fn absolute_etc_returns_err() {
        let result = run(json!({ "path": "/etc" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path not allowed"));
    }

    #[test]
    fn normalize_path_collapses_dotdot() {
        let p = normalize_path(Path::new("/home/user/Projects/../../../etc"));
        // After collapsing: /etc
        let s = p.to_string_lossy();
        assert!(!s.starts_with("/home"), "got: {s}");
    }

    #[test]
    fn allowed_projects_path_passes_validation() {
        // ~/Projects itself should pass (existence check is separate from allow check)
        let expanded = shellexpand::tilde("~/Projects").to_string();
        // validate_path checks prefix — if ~/Projects exists this should pass
        if PathBuf::from(&expanded).exists() {
            let result = validate_path(&expanded);
            assert!(result.is_ok(), "unexpected err: {:?}", result);
        }
    }
}
