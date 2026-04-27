#!/usr/bin/env bash
# Dump postgres to a timestamped, gzipped file on the host before any change.
# This is the single most important non-destructive guarantee.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

main() {
  info "Backup: snapshotting database"
  load_env

  local out_dir="${BACKUP_DIR:-$(repo_dir)/backups}"
  local stamp; stamp="$(date +%Y%m%d_%H%M%S)"
  local target="$out_dir/upgrade_${stamp}.sql.gz"
  run mkdir -p "$out_dir"

  if ! compose ps postgres --format '{{.Status}}' 2>/dev/null | grep -q '^Up'; then
    die "postgres container is not running. Start the stack first (docker compose up -d) so we can dump from it."
  fi

  if is_dry_run; then
    log "DRY: compose exec -T postgres pg_dump … > $target"
    printf '%s\n' "$target"
    return 0
  fi

  compose exec -T postgres pg_dump --no-owner --no-acl \
    -U "${POSTGRES_USER:-quokka}" "${POSTGRES_DB:-quokka}" \
    | gzip > "$target"

  local size; size="$(du -h "$target" | awk '{print $1}')"
  ok "backup written -> $target ($size)"
  printf '%s\n' "$target"
}

main "$@"
