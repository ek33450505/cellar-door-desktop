#!/usr/bin/env bash
# Stress test: 10 concurrent cast-memory writes/sec for 30s while app is running.
# Run this while cellar-door-desktop is open and a chat is active.
# Verify: no SQLITE_BUSY errors appear in the Tauri dev console during the test.
set -euo pipefail
echo "Starting WAL stress test — 30s, 10 writes/sec"
end=$((SECONDS + 30))
count=0
while [[ $SECONDS -lt $end ]]; do
    bash ~/.claude/scripts/cast-memory-write.sh \
        "stress-agent" "stress-project" "stress-fact-$count" \
        "WAL stress test value $count" &
    count=$((count + 1))
    sleep 0.1
done
wait
echo "Stress test complete — $count writes sent"
echo "Check Tauri dev console for SQLITE_BUSY errors"
