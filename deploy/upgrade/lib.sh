# Shared helpers for upgrade scripts. Source-only — never executed directly.
# Every step script sources this first; tests can also source it in isolation.

set -u

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_DIM="\033[2m"; C_RED="\033[31m"; C_YEL="\033[33m"; C_GRN="\033[32m"; C_BLU="\033[34m"; C_RST="\033[0m"
else
  C_DIM=""; C_RED=""; C_YEL=""; C_GRN=""; C_BLU=""; C_RST=""
fi

log()  { printf "%b\n" "${C_DIM}$*${C_RST}" >&2; }
info() { printf "%b\n" "${C_BLU}→ $*${C_RST}" >&2; }
ok()   { printf "%b\n" "${C_GRN}✓ $*${C_RST}" >&2; }
warn() { printf "%b\n" "${C_YEL}! $*${C_RST}" >&2; }
err()  { printf "%b\n" "${C_RED}✗ $*${C_RST}" >&2; }
die()  { err "$*"; exit 1; }

upgrade_dir() { (cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); }
deploy_dir()  { (cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd); }
repo_dir()    { (cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd); }

# Detect compose CLI (v2 plugin or legacy binary).
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose'
  elif command -v docker-compose >/dev/null 2>&1; then
    printf 'docker-compose'
  else
    return 1
  fi
}

# Run compose with the right file/project. Override via $COMPOSE_FILE / $COMPOSE_PROJECT.
compose() {
  local cf="${COMPOSE_FILE:-$(deploy_dir)/docker-compose.yml}"
  local pf="${COMPOSE_PROJECT:-quokka}"
  local cmd
  cmd="$(detect_compose)" || die "docker compose CLI not found"
  # shellcheck disable=SC2086 # $cmd may be two words
  $cmd -f "$cf" -p "$pf" "$@"
}

is_dry_run() { [ "${DRY_RUN:-0}" = "1" ]; }

# Run a command, or print it under DRY_RUN=1.
run() {
  if is_dry_run; then
    log "DRY: $*"
    return 0
  fi
  "$@"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

load_env() {
  local f="${1:-$(deploy_dir)/.env}"
  [ -f "$f" ] || die "Missing env file: $f"
  set -a; . "$f"; set +a
}
