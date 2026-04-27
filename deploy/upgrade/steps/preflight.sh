#!/usr/bin/env bash
# Verify the host is ready before we touch anything.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

main() {
  info "Preflight: checking host"
  require_command docker
  require_command git
  detect_compose >/dev/null || die "docker compose CLI not found"
  ok "docker, git, compose available"

  local env_file="$(deploy_dir)/.env"
  [ -f "$env_file" ] || die "Missing $env_file (copy deploy/.env.example to deploy/.env first)"
  load_env "$env_file"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in deploy/.env}"
  : "${JWT_SECRET:?JWT_SECRET must be set in deploy/.env}"
  ok "deploy/.env has required variables"

  if [ -n "$(cd "$(repo_dir)" && git status --porcelain)" ]; then
    warn "Working tree has uncommitted changes — they will be stashed by the pull step."
  fi
}

main "$@"
