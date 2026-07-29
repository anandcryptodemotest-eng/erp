# ADR 0008 — Telemetry correlation

## Status

Accepted (Platform v1.0)

## Context

Inter-service calls must continue a single distributed trace and keep request/tenant identity on logs.

## Decision

Automatic propagation on every `serviceClient` call and auth middleware:

- W3C: `traceparent`, `tracestate`, `baggage`
- ERP: `x-request-id`, `x-correlation-id`, `x-tenant-id`, `x-user-id`

Log records include `traceId` / `spanId` from the active span when present.

Span names use `Domain.Action` (e.g. `SalesOrder.Convert`, `Inventory.Reserve`, `Workflow.CompleteTask`).

Lifecycle markers use `recordEvent`: `WorkflowStarted`, `TaskCompleted`, `SnapshotCreated`, etc.

## Consequences

- Correlation works across Gateway → Sales → Inventory without per-route header copying
- Grafana Tempo + Loki can join on trace id
- Manual `traceparent` construction outside `@erp/telemetry` / `@erp/config` is forbidden
