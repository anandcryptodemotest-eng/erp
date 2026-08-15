#!/usr/bin/env bash
# CI E2E gate — postgres + docker stack + seed + API marathon suites.
# Suites: greenfield, gst, portal, saas, capture. Fail the job if any suite fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JWT_SECRET="${JWT_SECRET:-ci-validation-jwt-secret}"
export SERVICE_SECRET="${SERVICE_SECRET:-ci-validation-service-secret}"
export INTEGRATION_ENCRYPTION_KEY="${INTEGRATION_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export OTP_PEPPER="${OTP_PEPPER:-$INTEGRATION_ENCRYPTION_KEY}"
export OTEL_SDK_DISABLED="${OTEL_SDK_DISABLED:-true}"
export BASE_URL="${BASE_URL:-http://localhost:3010/admin}"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

PG_URL="postgresql://erp:erp_dev_password@127.0.0.1:5432"
SERVICES=(gateway sales inventory accounting hr procurement delivery)

log() { echo "[ci-e2e] $*"; }

dump_logs() {
  log "Compose status"
  docker compose ps -a || true
  docker compose logs --no-color --tail=200 postgres "${SERVICES[@]}" || true
}

on_err() {
  log "FAILED — dumping logs"
  dump_logs
}
trap on_err ERR

push_schema() {
  local filter="$1"
  local db="$2"
  log "db push $filter ($db)"
  DATABASE_URL="${PG_URL}/${db}" pnpm --filter "$filter" exec prisma generate
  DATABASE_URL="${PG_URL}/${db}" pnpm --filter "$filter" exec prisma db push --accept-data-loss
}

wait_http() {
  local url="$1"
  local label="$2"
  local tries="${3:-60}"
  for ((i = 1; i <= tries; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "$label ready"
      return 0
    fi
    sleep 5
  done
  log "ERROR: $label not ready after $((tries * 5))s ($url)"
  return 1
}

log "Starting postgres"
docker compose up -d postgres
for ((i = 1; i <= 30; i++)); do
  if docker compose exec -T postgres pg_isready -U erp >/dev/null 2>&1; then
    log "postgres ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    log "ERROR: postgres not ready"
    exit 1
  fi
  sleep 2
done

log "Pushing Prisma schemas"
push_schema "@erp/gateway" "erp_gateway"
push_schema "@erp/sales" "erp_sales"
push_schema "@erp/inventory" "erp_inventory"
push_schema "@erp/accounting" "erp_accounting"
push_schema "@erp/hr" "erp_hr"
push_schema "@erp/procurement" "erp_procurement"
push_schema "@erp/delivery" "erp_delivery"

log "Building application images (truly serial — one service at a time)"
for svc in "${SERVICES[@]}"; do
  log "docker compose build ${svc}"
  docker compose build "${svc}"
done

log "Starting application stack"
docker compose up -d --wait --wait-timeout 300 "${SERVICES[@]}"

wait_http "${BASE_URL}/health/live" "gateway"
wait_http "http://127.0.0.1:3001/health/live" "sales"
wait_http "http://127.0.0.1:3002/health/live" "inventory"
wait_http "http://127.0.0.1:3003/health/live" "accounting"
wait_http "http://127.0.0.1:3004/health/live" "hr"
wait_http "http://127.0.0.1:3005/health/live" "procurement"
wait_http "http://127.0.0.1:3006/health/live" "delivery"

log "Seeding platform operator"
DATABASE_URL="${PG_URL}/erp_gateway" pnpm seed:platform

log "Seeding Trustwood demo catalog + Growth entitlement"
pnpm seed:demo

log "Running e2e:greenfield"
pnpm e2e:greenfield

log "Running e2e:gst"
pnpm e2e:gst

log "Running e2e:portal"
pnpm e2e:portal

log "Running e2e:saas"
pnpm e2e:saas

log "Running e2e:capture"
pnpm e2e:capture

log "All E2E suites passed"
