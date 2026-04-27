#!/usr/bin/env bash
. "$(dirname "$0")/helpers.sh"
setup; trap teardown EXIT

PRE="$TMPROOT/repo/deploy/upgrade/steps/preflight.sh"

echo "preflight: passes with valid env and clean tree"
out="$(bash "$PRE" 2>&1)"; rc=$?
assert_exit_zero "$rc" "exits zero"
assert_contains "$out" "docker, git, compose available" "reports tools ok"
assert_contains "$out" "deploy/.env has required variables" "reports env ok"

echo "preflight: warns on dirty tree"
fake_dirty_tree
out="$(bash "$PRE" 2>&1)"; rc=$?
assert_exit_zero "$rc" "still passes"
assert_contains "$out" "uncommitted changes" "warns about dirty tree"

echo "preflight: fails when .env missing"
rm "$TMPROOT/repo/deploy/.env"
out="$(bash "$PRE" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "Missing" "explains the missing file"

echo "preflight: fails when POSTGRES_PASSWORD is empty"
cat > "$TMPROOT/repo/deploy/.env" <<'EOF'
POSTGRES_PASSWORD=
JWT_SECRET=test-secret
EOF
out="$(bash "$PRE" 2>&1)"; rc=$?
assert_exit_nonzero "$rc" "exits nonzero"
assert_contains "$out" "POSTGRES_PASSWORD" "names the missing variable"

exit $TEST_FAILED
