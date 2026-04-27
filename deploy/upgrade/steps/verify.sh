#!/usr/bin/env bash
# Confirm the upgrade actually worked: api is healthy and the metric
# hypertable still exists. Failing here means the operator should restore
# from the backup written earlier.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

WAIT_SECONDS="${WAIT_SECONDS:-90}"

wait_for_api() {
  local i=0
  while [ "$i" -lt "$WAIT_SECONDS" ]; do
    if compose exec -T api wget -qO- http://localhost:4000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 1; i=$((i + 1))
  done
  return 1
}

assert_metric_table() {
  load_env
  local result
  result="$(compose exec -T postgres psql \
    -U "${POSTGRES_USER:-quokka}" -d "${POSTGRES_DB:-quokka}" \
    -tAc "SELECT to_regclass('public.metric')::text;" 2>/dev/null \
    | tr -d '[:space:]')"
  [ "$result" = "metric" ]
}

main() {
  info "Verify: waiting for api to become healthy (timeout ${WAIT_SECONDS}s)"
  if is_dry_run; then
    log "DRY: would poll /api/health"
  else
    wait_for_api || die "API did not become healthy within ${WAIT_SECONDS}s"
  fi
  ok "api is healthy"

  info "Verify: checking metric hypertable still exists"
  if is_dry_run; then
    log "DRY: would query metric table"
  else
    assert_metric_table || die "metric hypertable is missing — restore the latest backup immediately!"
  fi
  ok "metric hypertable present"
}

main "$@"
