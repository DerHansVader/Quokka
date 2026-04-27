# Tiny test framework + binary mocks for the upgrade scripts.
# Each *.test.sh file sources this, calls setup() at the top, teardown() in trap.

set -u

UPGRADE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Counters used by every test process.
TEST_PASSED=0
TEST_FAILED=0

red()   { printf "\033[31m%s\033[0m" "$*"; }
green() { printf "\033[32m%s\033[0m" "$*"; }
dim()   { printf "\033[2m%s\033[0m" "$*"; }

assert_eq() {
  local actual="$1" expected="$2" msg="${3:-}"
  if [ "$actual" = "$expected" ]; then
    TEST_PASSED=$((TEST_PASSED + 1))
    printf "  %s %s\n" "$(green '✓')" "${msg:-eq}"
  else
    TEST_FAILED=$((TEST_FAILED + 1))
    printf "  %s %s\n      expected: %s\n      actual:   %s\n" \
      "$(red '✗')" "${msg:-eq}" "$expected" "$actual"
  fi
}

assert_contains() {
  local haystack="$1" needle="$2" msg="${3:-}"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    TEST_PASSED=$((TEST_PASSED + 1))
    printf "  %s %s\n" "$(green '✓')" "${msg:-contains}"
  else
    TEST_FAILED=$((TEST_FAILED + 1))
    printf "  %s %s\n      expected substring: %s\n      in: %s\n" \
      "$(red '✗')" "${msg:-contains}" "$needle" "$haystack"
  fi
}

assert_exit_zero() {
  local rc="$1" msg="${2:-}"
  if [ "$rc" = "0" ]; then
    TEST_PASSED=$((TEST_PASSED + 1))
    printf "  %s %s\n" "$(green '✓')" "${msg:-exit 0}"
  else
    TEST_FAILED=$((TEST_FAILED + 1))
    printf "  %s %s (got exit $rc)\n" "$(red '✗')" "${msg:-exit 0}"
  fi
}

assert_exit_nonzero() {
  local rc="$1" msg="${2:-}"
  if [ "$rc" != "0" ]; then
    TEST_PASSED=$((TEST_PASSED + 1))
    printf "  %s %s\n" "$(green '✓')" "${msg:-exit nonzero}"
  else
    TEST_FAILED=$((TEST_FAILED + 1))
    printf "  %s %s (unexpected success)\n" "$(red '✗')" "${msg:-exit nonzero}"
  fi
}

# Build an isolated playground for one test:
#   - $TMPROOT/repo: a fake repo with a deploy/.env, git history
#   - $TMPROOT/bin:  fake docker/git/gzip/du/wget that record their args
#   - $UPGRADE_LOG:  every fake binary appends one line "name|args..." here
setup() {
  TMPROOT="$(mktemp -d)"
  UPGRADE_LOG="$TMPROOT/calls.log"
  : > "$UPGRADE_LOG"

  # --- fake binaries ----------------------------------------------------
  mkdir -p "$TMPROOT/bin"
  cat > "$TMPROOT/bin/docker" <<EOF
#!/usr/bin/env bash
printf 'docker|%s\n' "\$*" >> "$UPGRADE_LOG"
ARGS="\$*"
case "\$ARGS" in
  *"compose version"*)
    echo "Docker Compose version v2.27.0" ;;
  *"compose -f"*"ps postgres"*|*"compose ps postgres"*)
    [ -f "$TMPROOT/postgres-up" ] && echo "Up 5 minutes" || true ;;
  *"postgres pg_dump"*)
    cat "$TMPROOT/pg-dump-output" 2>/dev/null || echo "-- fake dump --" ;;
  *"postgres psql"*)
    cat "$TMPROOT/psql-output" 2>/dev/null || echo "metric" ;;
  *"api wget"*)
    [ -f "$TMPROOT/api-healthy" ] && echo "ok" || exit 7 ;;
  *"compose build"*|*"compose -f"*"build"*) : ;;
  *"compose up"*|*"compose -f"*"up"*) : ;;
esac
exit 0
EOF
  chmod +x "$TMPROOT/bin/docker"

  cat > "$TMPROOT/bin/git" <<EOF
#!/usr/bin/env bash
printf 'git|%s\n' "\$*" >> "$UPGRADE_LOG"
case "\$1" in
  status)              [ -f "$TMPROOT/dirty" ] && echo " M file" || true ;;
  rev-parse)
    case "\$*" in
      *"--abbrev-ref"*) echo "main" ;;
      *"--short HEAD"*) echo "abc1234" ;;
      *)                echo "abc1234" ;;
    esac ;;
  fetch|pull|stash|checkout) : ;;
  *) : ;;
esac
exit 0
EOF
  chmod +x "$TMPROOT/bin/git"

  cat > "$TMPROOT/bin/gzip" <<EOF
#!/usr/bin/env bash
printf 'gzip|%s\n' "\$*" >> "$UPGRADE_LOG"
cat > /dev/null
echo gz > "\$1" 2>/dev/null || true
EOF
  chmod +x "$TMPROOT/bin/gzip"

  cat > "$TMPROOT/bin/du" <<EOF
#!/usr/bin/env bash
echo "1.2K	\$2"
EOF
  chmod +x "$TMPROOT/bin/du"

  PATH="$TMPROOT/bin:$PATH"
  export PATH UPGRADE_LOG TMPROOT

  # --- fake repo layout -------------------------------------------------
  mkdir -p "$TMPROOT/repo/deploy/upgrade/steps"
  mkdir -p "$TMPROOT/repo/deploy/upgrade/tests"
  cp "$UPGRADE_DIR/lib.sh"            "$TMPROOT/repo/deploy/upgrade/lib.sh"
  cp "$UPGRADE_DIR/upgrade.sh"        "$TMPROOT/repo/deploy/upgrade/upgrade.sh"
  cp "$UPGRADE_DIR/steps/"*.sh        "$TMPROOT/repo/deploy/upgrade/steps/"
  chmod +x "$TMPROOT/repo/deploy/upgrade/upgrade.sh" \
           "$TMPROOT/repo/deploy/upgrade/steps/"*.sh

  cat > "$TMPROOT/repo/deploy/.env" <<'EOF'
POSTGRES_PASSWORD=test-pw
JWT_SECRET=test-secret
POSTGRES_USER=quokka
POSTGRES_DB=quokka
EOF

  : > "$TMPROOT/repo/deploy/docker-compose.yml"

  # Disable colors for cleaner assertions.
  NO_COLOR=1; export NO_COLOR

  # Default state: clean tree, postgres up, api healthy, psql returns "metric"
  : > "$TMPROOT/postgres-up"
  : > "$TMPROOT/api-healthy"
  printf 'metric\n' > "$TMPROOT/psql-output"
}

teardown() {
  [ -n "${TMPROOT:-}" ] && [ -d "$TMPROOT" ] && rm -rf "$TMPROOT"
}

# Read everything fakes recorded.
calls()      { cat "$UPGRADE_LOG"; }
calls_grep() { grep -F -- "$1" "$UPGRADE_LOG" || true; }

# Make the fake postgres look like it's not running.
fake_postgres_down() { rm -f "$TMPROOT/postgres-up"; }
# Make the fake api look unhealthy (wget exits nonzero).
fake_api_unhealthy() { rm -f "$TMPROOT/api-healthy"; }
# Make psql return something other than "metric".
fake_metric_missing() { printf '\n' > "$TMPROOT/psql-output"; }
# Make git status show dirty tree.
fake_dirty_tree() { : > "$TMPROOT/dirty"; }
