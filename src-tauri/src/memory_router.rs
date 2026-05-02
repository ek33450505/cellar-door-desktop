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
///       --mode retrieve --agent <agent> --prompt <prompt> --top-n <n> --fts-only
///
/// Retrieve mode emits a JSON array on stdout by default.
/// `--fts-only` skips the Ollama embed call (cosine_sim=0.0) so latency stays
/// in the 10–30 ms range, matching the Phase 2 <100 ms p95 budget.
///
/// `top_n` is capped at 50 to prevent a caller from issuing an unbounded
/// subprocess invocation (DOS guard — security review finding).
pub fn query_relevant_facts(
    prompt: &str,
    top_n: usize,
    agent: &str,
) -> Result<Vec<MemoryFact>, String> {
    let top_n = top_n.min(50);  // DOS guard — security review finding
    let router_path =
        shellexpand::tilde("~/.claude/scripts/cast-memory-router.py").to_string();
    let output = Command::new("python3")
        .arg(&router_path)
        .arg("--mode")
        .arg("retrieve")
        .arg("--agent")
        .arg(agent)
        .arg("--prompt")
        .arg(prompt)
        .arg("--top-n")
        .arg(top_n.to_string())
        .arg("--fts-only")
        .output()
        .map_err(|e| format!("failed to spawn router: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("router exited non-zero: {stderr}"));
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

/// Expose memory context retrieval to the frontend for debugging/inspection.
#[tauri::command]
pub fn get_memory_context(
    prompt: String,
    top_n: usize,
    agent: String,
) -> Result<Vec<MemoryFact>, String> {
    query_relevant_facts(&prompt, top_n, &agent)
}
