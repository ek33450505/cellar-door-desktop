use std::process::Command;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct MemoryFact {
    pub score: f64,
    pub agent: String,
    pub name: String,
    pub content: String,
    #[serde(rename = "type")]
    pub fact_type: String,
}

/// Call cast-memory-router.py as a subprocess and return top-N facts.
///
/// Router path: ~/.claude/scripts/cast-memory-router.py
/// Invoked as:
///   python3 ~/.claude/scripts/cast-memory-router.py \
///       --mode retrieve --agent <agent> --prompt <prompt> --top-n <n> \
///       [--project <project>] --fts-only
///
/// Retrieve mode emits a JSON array on stdout by default.
/// `--fts-only` skips the Ollama embed call (cosine_sim=0.0) so latency stays
/// in the 10–30 ms range, matching the Phase 2 <100 ms p95 budget.
///
/// `top_n` is capped at 50 to prevent a caller from issuing an unbounded
/// subprocess invocation (DOS guard — security review finding).
///
/// `project` is an optional project filter derived from workspace basename (Task E-16).
/// When `Some(p)`, `--project p` is passed to the router before `--fts-only`.
pub fn query_relevant_facts(
    prompt: &str,
    top_n: usize,
    agent: &str,
    project: Option<&str>,
) -> Result<Vec<MemoryFact>, String> {
    let top_n = top_n.min(50);  // DOS guard — security review finding
    let router_path =
        shellexpand::tilde("~/.claude/scripts/cast-memory-router.py").to_string();
    let mut cmd = Command::new("python3");
    cmd.arg(&router_path)
        .arg("--mode")
        .arg("retrieve")
        .arg("--agent")
        .arg(agent)
        .arg("--prompt")
        .arg(prompt)
        .arg("--top-n")
        .arg(top_n.to_string());
    // E-16: pass --project when a workspace-derived project name is available.
    if let Some(p) = project {
        if !p.is_empty() {
            cmd.arg("--project").arg(p);
        }
    }
    cmd.arg("--fts-only");
    let output = cmd
        .output()
        .map_err(|e| format!("failed to spawn router: {e}"))?;

    if !output.status.success() {
        let stderr_text = String::from_utf8_lossy(&output.stderr);
        eprintln!("memory router stderr: {}", stderr_text);
        return Err("memory router unavailable".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<Vec<MemoryFact>>(&stdout)
        .map_err(|e| format!("router JSON parse error: {e}"))
}

/// Format facts as a system message string for Ollama.
///
/// Empty input → empty string.
/// Otherwise prepends a context header followed by one line per fact:
/// `- [<type>] <name>: <content>`.
pub fn facts_to_system_prompt(facts: &[MemoryFact]) -> String {
    if facts.is_empty() {
        return String::new();
    }
    let mut lines = vec![
        "You have access to the following relevant memory facts about this user's AI agent \
         system (CAST). Use these to provide context-aware responses:"
            .to_string(),
    ];
    for f in facts {
        lines.push(format!("- [{}] {}: {}", f.fact_type, f.name, f.content));
    }
    lines.join("\n")
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

/// Agent names permitted to query memory context.
/// Reject any agent not in this list — security finding from Phase 7b review.
const ALLOWED_AGENTS: &[&str] = &["shared", "cellar-door-desktop"];

/// Expose memory context retrieval to the frontend for debugging/inspection.
///
/// `project` — optional workspace-derived project name for memory scoping (Task E-16).
/// When provided, passed as `--project` to the router subprocess.
#[tauri::command]
pub fn get_memory_context(
    prompt: String,
    top_n: usize,
    agent: String,
    project: Option<String>,
) -> Result<Vec<MemoryFact>, String> {
    if !ALLOWED_AGENTS.contains(&agent.as_str()) {
        return Err(format!("agent '{}' not in allowlist", agent));
    }
    query_relevant_facts(&prompt, top_n, &agent, project.as_deref())
}
