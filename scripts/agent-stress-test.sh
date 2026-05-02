#!/usr/bin/env bash
# Agent loop stress test: 20 rapid tool invocations (10 allowed, 10 denied)
# Run while the app is in agent mode and the WAL stress test is also running.
# Expected: no SQLITE_BUSY in Tauri console, no deadlock, chat-done fires.
#
# This script is documentation of the manual procedure, not automated.
# Pieces that require the running app are marked # MANUAL: and cannot be scripted.
#
# Usage:
#   bash scripts/agent-stress-test.sh           -- prints procedure and exits 0
#   bash -n scripts/agent-stress-test.sh        -- syntax check only

set -euo pipefail

echo "=============================================="
echo "Agent Mode Stress Test — Phase 7c"
echo "=============================================="
echo ""
echo "Purpose:"
echo "  Verify that 20 rapid tool_invocations (10 allowed, 10 denied) do not"
echo "  cause SQLITE_BUSY under concurrent WAL write load, and that denied tool"
echo "  calls do not deadlock the agent loop."
echo ""
echo "Prerequisites:"
echo "  1. ollama is installed: brew install ollama"
echo "  2. At least one model pulled: ollama pull mistral"
echo "  3. cast.db exists at ~/.claude/cast.db with migration 007 applied."
echo "     To verify: sqlite3 ~/.claude/cast.db '.schema tool_invocations' | grep -q tool_name"
echo "  4. The cellar-door-desktop app is NOT currently running."
echo ""

# AUTOMATED: Verify cast.db exists and has the tool_invocations table
if [[ ! -f "$HOME/.claude/cast.db" ]]; then
    echo "ERROR: cast.db not found at ~/.claude/cast.db"
    echo "  Install CAST first: https://github.com/ek33450505/claude-agent-team"
    exit 1
fi

SCHEMA_CHECK=$(sqlite3 "$HOME/.claude/cast.db" "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_invocations';" 2>/dev/null || true)
if [[ -z "$SCHEMA_CHECK" ]]; then
    echo "ERROR: tool_invocations table not found in cast.db."
    echo "  Run the app once to apply migration 007, or:"
    echo "  sqlite3 ~/.claude/cast.db < src-tauri/src/migrations/007_tool_invocations.sql"
    exit 1
fi

echo "cast.db: OK (tool_invocations table present)"
echo ""
echo "=============================================="
echo "MANUAL PROCEDURE (requires running app)"
echo "=============================================="
echo ""
echo "Step 1: Start the app in dev mode"
echo "  # MANUAL: npm run tauri dev"
echo "  Wait until you see 'ollama-ready' or 'Ollama not installed' in the console."
echo ""
echo "Step 2: Navigate to the Chat view and enable Agent Mode"
echo "  # MANUAL: Open http://localhost:1420 in the Tauri WebView"
echo "  # MANUAL: Toggle 'Agent Mode' on in the Chat view UI"
echo ""
echo "Step 3: Send a message that triggers 10+ tool calls"
echo "  # MANUAL: Type a prompt such as:"
echo "  #   'List my memories, read the first 5 files in ~/.claude/agent-memory-local/,"
echo "  #    then fetch http://localhost:3001/api/memories and summarize.'"
echo "  This should trigger at least 10 tool calls across list_dir, read_file, and fetch_url."
echo ""
echo "Step 4: In the permission modal — alternate Allow / Deny for each call"
echo "  # MANUAL: For each of the 20 tool permission modals:"
echo "  #   - Click Allow for odd-numbered calls (1, 3, 5, 7, 9, 11, 13, 15, 17, 19)"
echo "  #   - Click Deny  for even-numbered calls (2, 4, 6, 8, 10, 12, 14, 16, 18, 20)"
echo ""
echo "Step 5: Simultaneously run the WAL stress test in a second terminal"
echo "  # MANUAL (second terminal): bash scripts/wal-stress-test.sh"
echo "  This creates concurrent write pressure while the agent loop is active."
echo ""
echo "Step 6: Validation queries — run after the agent turn completes"

# AUTOMATED VALIDATION: Run once Step 4-5 are done manually

SESSION_ID="${AGENT_STRESS_SESSION_ID:-}"
if [[ -n "$SESSION_ID" ]]; then
    echo ""
    echo "Running validation queries for session_id: $SESSION_ID"
    TOTAL=$(sqlite3 "$HOME/.claude/cast.db" \
        "SELECT COUNT(*) FROM tool_invocations WHERE session_id='$SESSION_ID';" 2>/dev/null || echo "0")
    ALLOWED=$(sqlite3 "$HOME/.claude/cast.db" \
        "SELECT COUNT(*) FROM tool_invocations WHERE session_id='$SESSION_ID' AND decision='allowed';" 2>/dev/null || echo "0")
    DENIED=$(sqlite3 "$HOME/.claude/cast.db" \
        "SELECT COUNT(*) FROM tool_invocations WHERE session_id='$SESSION_ID' AND decision='denied';" 2>/dev/null || echo "0")
    echo "  Total rows:   $TOTAL (expect >= 20)"
    echo "  Allowed:      $ALLOWED (expect ~10)"
    echo "  Denied:       $DENIED (expect ~10)"
    if [[ "$TOTAL" -ge 20 ]]; then
        echo "  RESULT: PASS — 20+ rows written under concurrent WAL load."
    else
        echo "  RESULT: FAIL — fewer than 20 rows. Check Tauri console for SQLITE_BUSY."
    fi
else
    echo ""
    echo "  # MANUAL validation (run after the agent turn completes):"
    echo "  sqlite3 ~/.claude/cast.db \\"
    echo "    \"SELECT decision, COUNT(*) FROM tool_invocations"
    echo "     GROUP BY decision ORDER BY decision;\""
    echo ""
    echo "  Expected: ~10 rows with decision='allowed', ~10 with decision='denied'"
    echo "  Expected: zero SQLITE_BUSY errors in the Tauri dev console"
    echo "  Expected: chat-done event fires (agent loop completes cleanly)"
    echo ""
    echo "  To run with automated validation, set AGENT_STRESS_SESSION_ID"
    echo "  to the session_id used during the test:"
    echo "    AGENT_STRESS_SESSION_ID=<session-id> bash scripts/agent-stress-test.sh"
fi

echo ""
echo "Step 7: Record results in src-tauri/src/db.rs"
echo "  # MANUAL: Update the stress test comment in db.rs with today's date and findings."
echo ""
echo "=============================================="
echo "Script complete. Manual steps remain above."
echo "See scripts/wal-stress-test.sh for the concurrent WAL load side."
echo "=============================================="

exit 0
