#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

PULL="$TMPROOT/repo/deploy/upgrade/steps/pull.sh"

echo "pull: clean tree fetches and pulls"
out="$(bash "$PULL" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$(calls_grep 'fetch')" "fetch" "runs git fetch"
assert_contains "$(calls_grep 'pull --ff-only')" "pull --ff-only" "fast-forward only"
[ -z "$(calls_grep 'stash push')" ]
assert_exit_zero $? "no stash on clean tree"

echo "pull: dirty tree gets stashed before pull"
: > "$UPGRADE_LOG"
fake_dirty_tree
out="$(bash "$PULL" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$(calls_grep 'stash push')" "stash push" "stashes local changes"
assert_contains "$(calls_grep 'pull --ff-only')" "pull --ff-only" "still pulls"

exit $TEST_FAILED
