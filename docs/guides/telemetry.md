# Telemetry (`@erp/telemetry`)

Platform Observability Runtime — tracing, metrics, exceptions.

## Helpers (only public API for feature code)

```ts
import {
  bootstrapTelemetry,
  withSpan,
  recordEvent,
  recordMetric,
  captureException,
  addSpanAttributes,
} from "@erp/telemetry";

await withSpan("SalesOrder.Convert", async () => {
  recordEvent("WorkflowStarted", { orderId });
  // ...
});
```

## Bootstrap

Each backend `src/instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { bootstrapTelemetry } = await import("@erp/telemetry");
  await bootstrapTelemetry({ serviceName: process.env.SERVICE_NAME || "sales" });
}
```

## Env

| Variable | Purpose |
|----------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector base (default `http://localhost:4318`) |
| `OTEL_SDK_DISABLED` | `true` to skip SDK (tests) |
| `SERVICE_NAME` / `SERVICE_VERSION` | Resource identity |
| `DEPLOYMENT_ENVIRONMENT` | `deployment.environment` |

## Local stack

```bash
docker compose --profile obs up -d
# Grafana http://localhost:3000 (admin/admin)
# Point apps: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

See [dashboards.md](./dashboards.md) and [logging.md](./logging.md).
