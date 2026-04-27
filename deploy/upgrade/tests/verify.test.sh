#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

V="$TMPROOT/repo/deploy/upgrade/steps/verify.sh"

echo "verify: passes when api healthy and metric table exists"
out="$(WAIT_SECONDS=2 bash "$V" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "api is healthy" "reports api healthy"
assert_contains "$out" "metric hypertable present" "reports metric ok"

echo "verify: fails fast when api never becomes healthy"
fake_api_unhealthy
out="$(WAIT_SECONDS=2 bash "$V" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "did not become healthy" "explains api timeout"

echo "verify: fails when metric hypertable is missing (CRITICAL guard)"
: > "$TMPROOT/api-healthy"
fake_metric_missing
out="$(WAIT_SECONDS=2 bash "$V" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "metric hypertable is missing" "raises the alarm"
assert_contains "$out" "restore" "tells operator to restore"

exit $TEST_FAILED
