#!/usr/bin/env bash
# Rebuild and roll only the api + web containers. Postgres is intentionally
# untouched (--no-deps) so volumes and connections survive.
# The api container's own CMD runs `prisma migrate deploy` on boot, so any
# new migrations apply automatically.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

main() {
  info "Rebuild: building api and web images"
  run compose build api web
  ok "images rebuilt"

  info "Restart: rolling api and web (postgres untouched)"
  run compose up -d --no-deps api web
  ok "containers up — migrations run automatically on api startup"
}

main "$@"
