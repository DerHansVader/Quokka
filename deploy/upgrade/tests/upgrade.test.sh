#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

UP="$TMPROOT/repo/deploy/upgrade/upgrade.sh"

echo "upgrade: full happy path runs every step in order"
BACKUP_DIR="$TMPROOT/backups" WAIT_SECONDS=2 \
  out="$(BACKUP_DIR="$TMPROOT/backups" WAIT_SECONDS=2 bash "$UP" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "Preflight"   "runs preflight"
assert_contains "$out" "Backup"      "runs backup"
assert_contains "$out" "Pull"        "runs pull"
assert_contains "$out" "Rebuild"     "runs rebuild"
assert_contains "$out" "Verify"      "runs verify"
assert_contains "$out" "Upgrade complete." "prints final ok"

echo "upgrade: aborts when verify catches a missing metric hypertable"
: > "$UPGRADE_LOG"
fake_metric_missing
out="$(BACKUP_DIR="$TMPROOT/backups" WAIT_SECONDS=2 bash "$UP" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "metric hypertable is missing" "raises the alarm"
[ -z "$(printf '%s' "$out" | grep -F 'Upgrade complete.')" ]
assert_exit_zero $? "does not print final success"

echo "upgrade: SKIP_PULL=1 skips the pull step but runs everything else"
: > "$UPGRADE_LOG"
printf 'metric\n' > "$TMPROOT/psql-output"
out="$(SKIP_PULL=1 BACKUP_DIR="$TMPROOT/backups2" WAIT_SECONDS=2 bash "$UP" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
[ -z "$(calls_grep 'fetch')" ]
assert_exit_zero $? "no git fetch when SKIP_PULL=1"
assert_contains "$out" "Backup"  "still runs backup"
assert_contains "$out" "Rebuild" "still runs rebuild"

echo "upgrade: aborts cleanly when preflight fails"
: > "$UPGRADE_LOG"
rm "$TMPROOT/repo/deploy/.env"
out="$(BACKUP_DIR="$TMPROOT/backups3" bash "$UP" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "preflight" "names the failed step"
[ -z "$(calls_grep 'pg_dump')" ]
assert_exit_zero $? "never reaches backup"

exit $TEST_FAILED
