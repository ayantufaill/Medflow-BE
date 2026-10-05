#!/usr/bin/env bash
# One-shot local UAT setup for the RBAC work (Docker stack).
#
#   bash scripts/setup-local-uat.sh
#
# What it does:
#   1. Points the API at the medflow_app role so row-level security is enforced
#      (as the owner/superuser, RLS is bypassed and branch isolation can't be tested).
#   2. Applies the RLS policies, the role permissions and the UAT test data
#      (12 accounts, 3 branches in 2 practice groups, 20 patients).
#   3. Restarts the API and confirms it runs as medflow_app.
#
# Safe to re-run. .env.docker is backed up to .env.docker.bak first.
set -euo pipefail

cd "$(dirname "$0")/.."

DOCKER="$(command -v docker || true)"
[ -z "$DOCKER" ] && [ -x "$HOME/.docker/bin/docker" ] && DOCKER="$HOME/.docker/bin/docker"
[ -z "$DOCKER" ] && { echo "Docker not found. Install/start Docker Desktop first."; exit 1; }

ENV_FILE=".env.docker"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found in $(pwd). Copy it from the team first."; exit 1; }

get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true; }

PG_USER="$(get POSTGRES_USER)"; PG_USER="${PG_USER:-medflow}"
PG_PASS="$(get POSTGRES_PASSWORD)"
PG_DB="$(get POSTGRES_DB)"; PG_DB="${PG_DB:-medflow}"
[ -z "$PG_PASS" ] && { echo "POSTGRES_PASSWORD is missing from $ENV_FILE."; exit 1; }

APP_PASS="$(get APP_DB_PASSWORD)"
if [ -z "$APP_PASS" ]; then
  APP_PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
fi

# Set KEY=VALUE in the env file, replacing an existing line or appending one.
set_var() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" 'BEGIN{done=0} $0 ~ "^"k"=" {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

cp "$ENV_FILE" "$ENV_FILE.bak"
set_var APP_DB_PASSWORD "$APP_PASS"
set_var DATABASE_URL "postgresql://medflow_app:${APP_PASS}@db:5432/${PG_DB}"
set_var DIRECT_DATABASE_URL "postgresql://${PG_USER}:${PG_PASS}@db:5432/${PG_DB}"
set_var RLS_STARTUP_LOG "true"
echo "✓ $ENV_FILE updated (backup: $ENV_FILE.bak)"

echo "→ Starting database and API…"
"$DOCKER" compose up -d db
"$DOCKER" compose up -d --force-recreate --no-deps api

wait_api() {
  for _ in $(seq 1 60); do
    "$DOCKER" compose exec -T api true >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "API container did not start. Check: $DOCKER compose logs api"; exit 1
}
wait_api

run() { echo "→ $*"; "$DOCKER" compose exec -T api npx tsx "$@"; }
run src/scripts/applyRls.ts
run src/scripts/seedNewModelRoles.ts
run src/scripts/syncLegacyRolePermissions.ts
run src/scripts/seedUatRbac.ts

echo "→ Restarting API…"
"$DOCKER" compose restart api >/dev/null

ok=0
for _ in $(seq 1 30); do
  if "$DOCKER" compose logs --since 2m api 2>/dev/null | grep -q "user=medflow_app"; then ok=1; break; fi
  sleep 2
done

if [ "$ok" = 1 ]; then
  echo ""
  echo "✅ Done. The API runs as medflow_app, so row-level security is enforced."
else
  echo ""
  echo "⚠️  Setup ran, but the API log does not show user=medflow_app yet."
  echo "    Check with: $DOCKER compose logs api | grep 'RLS check'"
fi
echo "   Frontend: cd ../Medflow-FE && npm install && npm run dev  →  http://localhost:5173"
echo "   Every UAT account uses the password MedFlow@Test1!"
