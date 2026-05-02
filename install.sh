#!/usr/bin/env bash
# Run ./install.sh after any edit to scripts/ to keep the live hooks in sync.
set -euo pipefail

SCRIPTS_SRC="$(cd "$(dirname "$0")/scripts" && pwd)"
SCRIPTS_DEST="${HOME}/.claude/scripts/cellar-door"

mkdir -p "${SCRIPTS_DEST}"
cp "${SCRIPTS_SRC}/cast-memory-inject.py"     "${SCRIPTS_DEST}/cast-memory-inject.py"
cp "${SCRIPTS_SRC}/cast-memory-writeback.py"  "${SCRIPTS_DEST}/cast-memory-writeback.py"
cp "${SCRIPTS_SRC}/migrate_phase1_5.py"       "${SCRIPTS_DEST}/migrate_phase1_5.py"

echo "Cellar Door hook scripts installed to ${SCRIPTS_DEST}"
echo "  cast-memory-inject.py"
echo "  cast-memory-writeback.py"
echo "  migrate_phase1_5.py"
