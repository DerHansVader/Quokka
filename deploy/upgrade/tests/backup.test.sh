#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

BK="$TMPROOT/repo/deploy/upgrade/steps/backup.sh"
BACKUP_DIR="$TMPROOT/backups"; export BACKUP_DIR

echo "backup: writes a timestamped file when postgres is up"
out="$(bash "$BK" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "backup written" "reports completion"
ls "$BACKUP_DIR"/upgrade_*.sql.gz >/dev/null 2>&1
assert_exit_zero $? "creates upgrade_*.sql.gz file"
assert_contains "$(calls_grep 'pg_dump')" "pg_dump" "calls pg_dump"

echo "backup: refuses to run when postgres is down"
fake_postgres_down
out="$(bash "$BK" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "not running" "explains why"

echo "backup: dry run prints the planned target without writing"
: > "$TMPROOT/postgres-up"
rm -rf "$BACKUP_DIR"
DRY_RUN=1 out="$(DRY_RUN=1 bash "$BK" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "DRY:" "logs DRY: prefix"
[ ! -d "$BACKUP_DIR" ]
assert_exit_zero $? "DRY_RUN doesn't create backup dir"

exit $TEST_FAILED
