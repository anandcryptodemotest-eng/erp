# ADR 0007 — Observability Runtime

## Status

Accepted (Platform v1.0)

## Context

Backends need correlated logs, traces, metrics, and exception capture without each service inventing its own SDK wiring.

## Decision

Observability is a **platform capability**:

- `@erp/logger` — structured logs only (frozen schema)
- `@erp/telemetry` — `bootstrapTelemetry`, `withSpan`, `recordEvent`, `recordMetric`, `captureException`, `addSpanAttributes`, `injectTraceHeaders`
- OTLP export to a shared collector; Grafana/Loki/Tempo/Prometheus for local/dev
- Feature code must not import raw `@opentelemetry/*` or manually set `traceparent`

## Consequences

- Every backend calls `bootstrapTelemetry` once via `instrumentation.ts`
- Architecture fitness enforces helpers-only usage and health endpoints
- CloudWatch / X-Ray is a P2 collector config swap (`ops/otel/collector-cloudwatch.yaml`)
