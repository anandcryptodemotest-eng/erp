# Dashboards

Grafana provisioning lives under `ops/grafana/`.

| Folder | Purpose |
|--------|---------|
| `platform/` | Collector / service health |
| `workflow/` | Workflow spans |
| `oms/` | SalesOrder / Inventory vertical slice |
| `inventory/` | Reserve paths |
| `developer/` | Logs, traces, exceptions |

Start:

```bash
docker compose --profile obs up -d
open http://localhost:3000
```

Datasources (Prometheus, Loki, Tempo) are auto-provisioned.

## Vertical-slice check

1. Run obs profile + apps with `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
2. Convert a sales request / confirm order (reserve)
3. In Grafana → Explore → Tempo: `{ name =~ "SalesOrder\\\\..*|Inventory\\\\..*|Workflow\\\\..*" }`
4. Confirm correlated logs via `traceId` in Loki / structured stdout
