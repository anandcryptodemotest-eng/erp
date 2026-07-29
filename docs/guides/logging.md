# Logging (microservices)

Shared package: `@erp/logger` — structured logs only (Observability Runtime).

## Frozen schema

```json
{
  "timestamp": "",
  "level": "info",
  "service": "sales",
  "requestId": "",
  "traceId": "",
  "spanId": "",
  "tenantId": "",
  "userId": "",
  "workflowId": "",
  "taskId": "",
  "orderId": "",
  "message": ""
}
```

Field name is **`message`** (not `msg`). `traceId` / `spanId` come from the active OpenTelemetry span when the SDK is running.

## Architecture

```
Browser → nginx → gateway (:3010)
                      ↓ rewrites
         sales :3001 | inventory :3002 | …
                      ↓ serviceClient
         request ids + W3C trace context
```

## Usage

```ts
import { createLogger, contextFromHeaders, runWithRequestContextAsync } from "@erp/logger";

const log = createLogger({ service: "sales" });
log.info("order converted", { orderId, sreqId });
log.error("task complete failed", { err, taskId });
```

Never use `console.log` / `console.error` in production app paths — fitness will fail.

## Env

```bash
SERVICE_NAME=sales
LOG_LEVEL=info          # debug|info|warn|error
LOG_FORMAT=json         # json|pretty  (pretty default in development)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Health

Identical contract on every backend:

- `GET /health/live` — process up
- `GET /health/ready` — dependency checks
- `GET /api/health` — alias of live

See [telemetry.md](./telemetry.md) and [dashboards.md](./dashboards.md).
