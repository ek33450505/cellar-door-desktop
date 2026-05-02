use serde_json::{json, Value};
use std::process::Command;

/// Commands allowed to execute at all.
/// Enforced BEFORE Command::new is called — never after.
const SHELL_ALLOWLIST: &[&str] = &["ollama", "cast", "git"];

/// Git subcommands that are permitted. All others (including "push") are rejected.
const GIT_ALLOWED_SUBCOMMANDS: &[&str] = &["status", "log"];

/// Run an allowed shell command.
///
/// Scope: ShellExec.
/// Allowlist: `ollama`, `cast`, `git` (only `git status` and `git log`).
/// The allowlist is checked BEFORE `Command::new` is called to prevent
/// time-of-check/time-of-use issues.
pub fn run(args: Value) -> Result<Value, String> {
    let command = args["command"]
        .as_str()
        .ok_or_else(|| "missing required param: command".to_string())?;

    // Collect extra args (default to empty array)
    let extra_args: Vec<String> = args["args"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    // --- ALLOWLIST CHECK (must happen before Command::new) ---
    if !SHELL_ALLOWLIST.contains(&command) {
        return Err(format!(
            "command not allowed: '{}'. Allowed commands: {}",
            command,
            SHELL_ALLOWLIST.join(", ")
        ));
    }

    // For `git`, enforce subcommand allowlist
    if command == "git" {
        let subcommand = extra_args
            .first()
            .map(|s| s.as_str())
            .unwrap_or("");
        if !GIT_ALLOWED_SUBCOMMANDS.contains(&subcommand) {
            return Err(format!(
                "git subcommand not allowed: '{}'. Allowed: {}",
                subcommand,
                GIT_ALLOWED_SUBCOMMANDS.join(", ")
            ));
        }
    }

    // --- Execute (allowlist already verified above) ---
    let output = Command::new(command)
        .args(&extra_args)
        .output()
        .map_err(|e| format!("exec error for '{}': {}", command, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(json!({
        "command": command,
        "args": extra_args,
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_command_returns_err() {
        let result = run(json!({}));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: command"));
    }

    #[test]
    fn non_allowlisted_command_returns_err() {
        let result = run(json!({ "command": "rm", "args": ["-rf", "/"] }));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("command not allowed"), "got: {msg}");
    }

    #[test]
    fn curl_not_allowed() {
        let result = run(json!({ "command": "curl", "args": ["https://example.com"] }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("command not allowed"));
    }

    #[test]
    fn bash_not_allowed() {
        let result = run(json!({ "command": "bash", "args": ["-c", "whoami"] }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("command not allowed"));
    }

    #[test]
    fn git_push_returns_err() {
        let result = run(json!({ "command": "git", "args": ["push"] }));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("git subcommand not allowed"), "got: {msg}");
    }

    #[test]
    fn git_reset_hard_returns_err() {
        let result = run(json!({ "command": "git", "args": ["reset", "--hard", "HEAD~1"] }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("git subcommand not allowed"));
    }

    #[test]
    fn git_no_subcommand_returns_err() {
        let result = run(json!({ "command": "git" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("git subcommand not allowed"));
    }

    #[test]
    fn git_status_is_allowed() {
        // Only validates the allowlist logic, not execution success
        let command = "git";
        let extra_args = vec!["status".to_string()];
        assert!(SHELL_ALLOWLIST.contains(&command));
        assert!(GIT_ALLOWED_SUBCOMMANDS.contains(&extra_args[0].as_str()));
    }

    #[test]
    fn git_log_is_allowed() {
        let command = "git";
        let subcommand = "log";
        assert!(SHELL_ALLOWLIST.contains(&command));
        assert!(GIT_ALLOWED_SUBCOMMANDS.contains(&subcommand));
    }
}
