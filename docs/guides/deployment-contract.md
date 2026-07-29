# Deployment Contract

Minimum bar every backend must satisfy before merge (Platform v1.0).

## Health

| Endpoint | Meaning |
|----------|---------|
| `GET /health/live` | Process up |
| `GET /health/ready` | Dependency checks (e.g. database) |
| `GET /api/health` | Alias of live (back-compat) |

Identical JSON payload:

```json
{
  "status": "UP",
  "service": "sales",
  "version": "1.0.0",
  "uptimeSeconds": 12345,
  "checks": {
    "database": "UP",
    "telemetry": "UP"
  }
}
```

Gateway with `basePath: /admin` serves these under `/admin/health/*`.

## Required environment

| Variable | Purpose |
|----------|---------|
| `SERVICE_NAME` | Log + resource identity |
| `SERVICE_VERSION` | Resource / health `version` |
| `DEPLOYMENT_ENVIRONMENT` | `deployment.environment` |
| `LOG_LEVEL` / `LOG_FORMAT` | Logger |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector base (e.g. `http://localhost:4318`) |
| `OTEL_SDK_DISABLED` | `true` only for tests |

Resource also sets `service.namespace=erp` via `@erp/telemetry` bootstrap.

## Observability

- Logs: `@erp/logger` frozen schema (`message`, `traceId`, `spanId`, …)
- Traces / metrics / exceptions: `@erp/telemetry` helpers only (`bootstrapTelemetry`, `withSpan`, `recordEvent`, `recordMetric`, `captureException`)
- Exactly one `bootstrapTelemetry` via `src/instrumentation.ts`
- No raw `@opentelemetry/*` in apps
- No `console.log` / `console.error` in `apps/*/src/app/api` or `apps/*/src/lib`

## Docker

- Shared build: [`docker/Dockerfile.next`](../../docker/Dockerfile.next)
- Per-backend thin Dockerfile under `apps/<service>/Dockerfile`
- Phase 1 backends: gateway, sales, inventory, accounting, hr, procurement, delivery

## Operating model (hybrid)

| Environment | Apps | Infra |
|-------------|------|--------|
| Local | Host `pnpm next dev` | Docker Postgres + `pnpm docker:obs` |
| CI / Staging / Production | Container images | Compose or equivalent |

## Enforcement

`pnpm arch:fitness` fails if a backend is missing instrumentation, health routes, logger/telemetry deps, or Dockerfile, or if `docs/guides/deployment-contract.md` is absent.
