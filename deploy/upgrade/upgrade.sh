#!/usr/bin/env bash
# Quokka upgrade orchestrator.
#
# Runs the steps in order, refusing to continue if any step fails:
#   1. preflight  - check tools and env
#   2. backup     - dump postgres into ./backups/
#   3. pull       - git pull --ff-only on the current branch (stashing local changes)
#   4. rebuild    - rebuild api+web images and roll them (postgres untouched)
#   5. verify     - wait for api health and confirm the metric hypertable
#
# Usage:
#   deploy/upgrade/upgrade.sh                # full upgrade
#   DRY_RUN=1 deploy/upgrade/upgrade.sh      # print what would run
#   SKIP_PULL=1 deploy/upgrade/upgrade.sh    # use already-checked-out code
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

run_step() {
  local name="$1"; local script="$SCRIPT_DIR/steps/$1.sh"
  [ -x "$script" ] || die "step missing or not executable: $script"
  printf '\n'
  bash "$script" || die "step '$name' failed — aborting upgrade"
}

main() {
  info "Quokka upgrade — starting$(is_dry_run && printf ' (DRY RUN)' || true)"
  run_step preflight
  run_step backup
  [ "${SKIP_PULL:-0}" = "1" ] || run_step pull
  run_step rebuild
  run_step verify
  printf '\n'
  ok "Upgrade complete."
}

main "$@"
