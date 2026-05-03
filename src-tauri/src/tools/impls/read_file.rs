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
///
/// Relative path handling (Task E-15):
/// - If `path` is absolute or tilde-prefixed: expand tilde, then validate as before.
/// - If `path` is relative AND `_workspace` is present: resolve workspace/path, then
///   validate against ALLOWED_ROOTS AND verify the result is within the workspace.
/// - If `path` is relative AND `_workspace` is absent: return a user-visible error.
///
/// `_workspace` is an orchestrator-injected key — never model-supplied. Any `_workspace`
/// key in model-supplied args is stripped by `process_tool_calls` before this call.
pub fn run(args: Value) -> Result<Value, String> {
    let raw_path = args["path"]
        .as_str()
        .ok_or_else(|| "missing required param: path".to_string())?;

    // E-15: Determine if path is relative (not absolute and not tilde-prefixed).
    let workspace = args["_workspace"].as_str();
    let expanded = if !raw_path.starts_with('/') && !raw_path.starts_with('~') {
        // Relative path
        match workspace {
            Some(ws) => format!("{}/{}", ws, raw_path),
            None => return Err(
                "This chat has no workspace. Pin a folder via the chat header to use relative paths."
                    .to_string()
            ),
        }
    } else {
        shellexpand::tilde(raw_path).to_string()
    };

    let validated = validate_path(&expanded)?;

    // E-15: For relative paths with a workspace, also verify the result is workspace-bound.
    // This is defense-in-depth: ALLOWED_ROOTS check passed above, now check workspace containment.
    if !raw_path.starts_with('/') && !raw_path.starts_with('~') {
        if let Some(ws) = workspace {
            let ws_path = PathBuf::from(ws);
            // Canonicalize workspace path for comparison (resolves symlinks in workspace itself).
            let canonical_ws = if ws_path.exists() {
                std::fs::canonicalize(&ws_path).unwrap_or(ws_path)
            } else {
                ws_path
            };
            if !validated.starts_with(&canonical_ws) {
                return Err("path escapes pinned workspace".to_string());
            }
        }
    }

    // Re-canonicalize at read time to close symlink-swap TOCTOU window (B-5).
    let final_path = std::fs::canonicalize(&validated)
        .map_err(|e| format!("path error at read time: {e}"))?;
    // Re-check after re-canonicalization (symlink may now point outside allowed roots).
    let _ = validate_path(&final_path.to_string_lossy())?;

    // Gate 3 (post-canonicalize workspace bound): re-check workspace containment against
    // final_path so that a symlink inside the workspace pointing outside it is rejected.
    // The pre-canonicalize check (above, against `validated`) is not sufficient because
    // `validated` may not yet have symlinks resolved.
    if !raw_path.starts_with('/') && !raw_path.starts_with('~') {
        if let Some(ws) = workspace {
            let ws_path = PathBuf::from(ws);
            let canonical_ws = if ws_path.exists() {
                std::fs::canonicalize(&ws_path).unwrap_or(ws_path)
            } else {
                ws_path
            };
            if !final_path.starts_with(&canonical_ws) {
                return Err("path escapes pinned workspace after canonicalization".to_string());
            }
        }
    }

    let contents = fs::read_to_string(&final_path)
        .map_err(|e| format!("read error: {e}"))?;

    Ok(json!({
        "path": final_path.to_string_lossy(),
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
        // A relative path with ../.. traversal and no workspace now returns the
        // "no workspace" error (relative path branch). This is still an error —
        // the traversal is blocked, just at the workspace-check stage.
        let result = run(json!({ "path": "../../etc/passwd" }));
        assert!(result.is_err());
        // Either "path not allowed" (absolute path resolution) or "no workspace" error.
        let msg = result.unwrap_err();
        assert!(
            msg.contains("path not allowed") || msg.contains("This chat has no workspace"),
            "expected traversal to be rejected, got: {msg}"
        );
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

    // -------------------------------------------------------------------------
    // E-15: Relative path resolution tests
    // -------------------------------------------------------------------------

    #[test]
    fn relative_path_without_workspace_returns_err() {
        let result = run(json!({ "path": "relative/file.txt" }));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("This chat has no workspace"),
            "expected no-workspace error, got: {msg}"
        );
    }

    #[test]
    fn relative_path_with_workspace_outside_allowed_roots_returns_err() {
        // Workspace is outside ALLOWED_ROOTS — should fail validate_path
        let result = run(json!({
            "path": "file.txt",
            "_workspace": "/tmp"
        }));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        // Fails either at validate_path (not allowed) or path error at read time (doesn't exist)
        assert!(
            msg.contains("path not allowed") || msg.contains("path error at read time"),
            "expected path-not-allowed or read-time error, got: {msg}"
        );
    }

    #[test]
    fn relative_path_traversal_with_workspace_returns_err() {
        // A traversal that would escape the workspace via ../../ should be rejected.
        // Even if the expanded path starts with a valid root, workspace-bound check rejects it.
        let workspace = shellexpand::tilde("~/Projects").to_string();
        let result = run(json!({
            "path": "../../etc/passwd",
            "_workspace": workspace
        }));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("path not allowed")
                || msg.contains("path escapes pinned workspace")
                || msg.contains("path error at read time"),
            "expected traversal rejection, got: {msg}"
        );
    }

    /// Regression test for the post-canonicalize workspace symlink-escape bug.
    ///
    /// Topology:
    ///   ALLOWED_ROOT/workspace/          <- the pinned workspace (inside ALLOWED_ROOTS)
    ///   ALLOWED_ROOT/sibling/target.txt  <- sibling dir also within ALLOWED_ROOTS but outside workspace
    ///   ALLOWED_ROOT/workspace/link.txt  <- symlink inside workspace → ../sibling/target.txt
    ///
    /// Before the fix, `validated.starts_with(workspace)` passed (link.txt IS inside workspace)
    /// and `validate_path(final_path)` passed (target.txt is inside ALLOWED_ROOTS).
    /// The workspace containment was never re-checked against `final_path`, so the read
    /// succeeded. After the fix, Gate 3 catches the escape.
    #[cfg(unix)]
    #[test]
    fn symlink_escape_from_workspace_is_rejected() {
        use std::os::unix::fs::symlink;
        use tempfile::TempDir;

        // Create a temp dir rooted inside ~/Projects so all paths pass ALLOWED_ROOTS.
        let projects_dir = shellexpand::tilde("~/Projects").to_string();
        let base = TempDir::new_in(&projects_dir)
            .expect("failed to create temp dir in ~/Projects");

        // workspace/ and sibling/ both live under base (inside ALLOWED_ROOTS).
        let workspace = base.path().join("workspace");
        let sibling = base.path().join("sibling");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&sibling).unwrap();

        // Write a real file in the sibling directory.
        let target = sibling.join("secret.txt");
        std::fs::write(&target, "secret content").unwrap();

        // Place a symlink inside the workspace that points to the sibling file.
        let link = workspace.join("link.txt");
        symlink(&target, &link).expect("symlink creation failed");

        // Attempt to read the symlink using a relative path inside the workspace.
        // Gate 3 must reject this because final_path (after canonicalize) resolves
        // to sibling/secret.txt, which is outside the workspace.
        let result = run(json!({
            "path": "link.txt",
            "_workspace": workspace.to_string_lossy().as_ref()
        }));

        assert!(result.is_err(), "expected symlink-escape to be rejected, got Ok");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("path escapes pinned workspace"),
            "expected workspace-escape error, got: {msg}"
        );
    }
}
