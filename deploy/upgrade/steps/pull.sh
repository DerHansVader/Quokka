#!/usr/bin/env bash
# Update the working tree to the latest commit on the current branch.
# Local changes are stashed (preserved) — never discarded.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

main() {
  info "Pull: fetching latest sources"
  cd "$(repo_dir)"

  if [ -n "$(git status --porcelain)" ]; then
    local label="quokka-upgrade-$(date -u +%Y%m%dT%H%M%SZ)"
    warn "Local changes detected — stashing as '$label' (recover with: git stash list / git stash pop)"
    run git stash push --include-untracked -m "$label"
  fi

  local branch; branch="$(git rev-parse --abbrev-ref HEAD)"
  run git fetch --prune origin
  run git pull --ff-only origin "$branch"
  ok "updated $branch to $(git rev-parse --short HEAD)"
}

main "$@"
