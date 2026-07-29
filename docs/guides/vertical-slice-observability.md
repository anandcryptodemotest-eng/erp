# Observability vertical-slice validation (Milestone 5)

## Prerequisites (hybrid)

```bash
# Infra
docker compose up -d postgres
pnpm docker:obs

# Apps (host)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export DEPLOYMENT_ENVIRONMENT=development
pnpm --filter @erp/gateway exec next dev --hostname 127.0.0.1 --port 3010 --turbopack
pnpm --filter @erp/sales exec next dev --hostname 127.0.0.1 --port 3001 --turbopack
pnpm --filter @erp/inventory exec next dev --hostname 127.0.0.1 --port 3002 --turbopack
```

## Synthetic span chain (collector / Grafana)

```bash
pnpm smoke:otel-slice
```

Exports `SalesOrder.Convert` → `Workflow.Start` → `Inventory.Reserve` → `Workflow.CompleteTask` with lifecycle events to OTLP. Open Grafana Explore → Tempo with the printed `traceId`.

## Live OMS journey

```bash
pnpm e2e:oms
pnpm smoke:foundation   # health when all 7 backends up
```

Live handlers already emit the same Domain.Action names via `@erp/telemetry` (`withSpan` / `recordEvent`).

## Expected Grafana evidence

| Signal | Where |
|--------|--------|
| Traces | Tempo: span names above |
| Events | Span events: `WorkflowStarted`, `TaskCompleted`, `SnapshotCreated` |
| Logs | Loki / stdout JSON with `traceId` when apps export |
| Metrics | Prometheus job `otel-collector` |
