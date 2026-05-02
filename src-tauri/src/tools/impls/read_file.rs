use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// Allowed root directories — same policy as list_dir.
const ALLOWED_ROOTS: &[&str] = &["~/Projects", "~/Documents"];

fn expand_root(root: &str) -> Option<PathBuf> {
    let expanded = shellexpand::tilde(root).to_string();
    Some(PathBuf::from(expanded))
}

/// Lexically normalize a path by collapsing `..` components.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components: Vec<_> = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                if !components.is_empty() {
                    components.pop();
                }
            }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    components.iter().collect()
}

/// Validate path is under ~/Projects or ~/Documents.
/// Canonicalizes if the path exists; falls back to lexical normalization otherwise.
fn validate_path(expanded: &str) -> Result<PathBuf, String> {
    let input = PathBuf::from(expanded);

    let resolved = if input.exists() {
        fs::canonicalize(&input).map_err(|e| format!("path error: {e}"))?
    } else {
        normalize_path(&input)
    };

    let allowed: Vec<PathBuf> = ALLOWED_ROOTS
        .iter()
        .filter_map(|r| expand_root(r))
        .collect();

    for root in &allowed {
        let canonical_root = if root.exists() {
            fs::canonicalize(root).unwrap_or_else(|_| root.clone())
        } else {
            root.clone()
        };
        if resolved.starts_with(&canonical_root) {
            return Ok(resolved);
        }
    }

    Err("path not allowed: must be under ~/Projects or ~/Documents".to_string())
}

/// Read the contents of a file.
///
/// Scope: ReadOnly — restricted to ~/Projects and ~/Documents.
/// Returns `Err("path not allowed")` for paths outside these roots.
pub fn run(args: Value) -> Result<Value, String> {
    let raw_path = args["path"]
        .as_str()
        .ok_or_else(|| "missing required param: path".to_string())?;

    let expanded = shellexpand::tilde(raw_path).to_string();
    let validated = validate_path(&expanded)?;

    let contents = fs::read_to_string(&validated)
        .map_err(|e| format!("read error: {e}"))?;

    Ok(json!({
        "path": validated.to_string_lossy(),
        "contents": contents,
        "bytes": contents.len()
    }))
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
        let result = run(json!({ "path": "../../etc/passwd" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path not allowed"));
    }

    #[test]
    fn absolute_system_path_returns_err() {
        let result = run(json!({ "path": "/usr/bin/env" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path not allowed"));
    }

    #[test]
    fn allowed_projects_path_passes_validation() {
        // Validate that ~/Projects prefix is accepted
        let expanded = shellexpand::tilde("~/Projects/some_file.txt").to_string();
        // Path doesn't exist — lexical normalization path; still should pass allow check
        let result = validate_path(&expanded);
        assert!(result.is_ok(), "unexpected err: {:?}", result);
    }
}
