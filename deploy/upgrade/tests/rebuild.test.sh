#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

RB="$TMPROOT/repo/deploy/upgrade/steps/rebuild.sh"

echo "rebuild: builds and rolls api+web with --no-deps"
out="$(bash "$RB" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$(calls_grep 'build api web')" "build api web" "builds api+web"
assert_contains "$(calls_grep 'up -d --no-deps api web')" "up -d --no-deps api web" "rolls without touching postgres"

echo "rebuild: dry run prints commands but doesn't invoke them"
: > "$UPGRADE_LOG"
DRY_RUN=1 out="$(DRY_RUN=1 bash "$RB" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "DRY:" "logs DRY: prefix"
[ -z "$(calls_grep 'build api web')" ]
assert_exit_zero $? "doesn't actually call docker"

exit $TEST_FAILED
