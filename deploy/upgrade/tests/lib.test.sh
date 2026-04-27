#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

. "$TMPROOT/repo/deploy/upgrade/lib.sh"

echo "lib: detect_compose"
result="$(detect_compose)"
assert_eq "$result" "docker compose" "detects docker compose v2"

echo "lib: dry run skips execution"
DRY_RUN=1 run mkdir "$TMPROOT/should-not-exist"
[ ! -e "$TMPROOT/should-not-exist" ]
assert_exit_zero $? "DRY_RUN=1 doesn't create directories"

echo "lib: real run executes"
run mkdir "$TMPROOT/real-dir"
[ -d "$TMPROOT/real-dir" ]
assert_exit_zero $? "DRY_RUN unset runs the command"

echo "lib: load_env exposes vars"
( load_env "$TMPROOT/repo/deploy/.env"; [ "$POSTGRES_PASSWORD" = "test-pw" ] )
assert_exit_zero $? "load_env exports POSTGRES_PASSWORD"

echo "lib: require_command on missing binary fails"
( require_command quokka-no-such-binary ) >/dev/null 2>&1
assert_exit_nonzero $? "require_command exits nonzero for missing binary"

exit $TEST_FAILED
