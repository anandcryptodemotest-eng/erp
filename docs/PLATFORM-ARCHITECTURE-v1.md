# Platform Architecture v1.0

**Status:** COMPLETE / FROZEN (2026-07-29)  
**Rule:** Core changes require an ADR explaining why extension / metadata / registry mechanisms are insufficient.

## Core capabilities

```
Platform Runtime
├── Workflow Runtime
├── Metadata Runtime
├── UI Runtime
├── Extension Registry
├── Observability Runtime
└── Configuration Studio
```

No additional architectural layers before implementation. Proposals must be **Implementation**, **Extension**, or **ADR** — otherwise defer until a real limitation appears.

## Principles

1. **Design-time vs Runtime** — Configuration Studio authors; Runtime executes; Runtime never depends on drafts.
2. **Immutable execution** — Workflow instances run against pinned snapshots; publishes never mutate in-flight work.
3. **Metadata-driven** — UI, workflows, forms, rules are metadata; business logic stays in domain services.
4. **Extension-first** — Prefer `register*` over core edits.
5. **Thin core** — Platform owns lifecycle, orchestration, versioning, resolution, rendering, registration, and observability bootstrap only.

## Observability Runtime

| Concern | Package |
|---------|---------|
| Logging | `@erp/logger` (frozen schema: `message`, `traceId`, `spanId`, …) |
| Tracing / metrics / exceptions | `@erp/telemetry` helpers only |
| Exporters | OTLP → collector → Tempo / Prometheus / Loki → Grafana |

Feature code must not import raw `@opentelemetry/*`. See [guides/telemetry.md](./guides/telemetry.md), [ADR 0007](./adr/0007-observability-runtime.md), [ADR 0008](./adr/0008-telemetry-correlation.md).

## Contracts (stable)

- **AssetRef** `{ type, id, version }` — concrete version only at runtime
- **Snapshot** pins workflow definition + referenced screen/form bodies
- **Screen** (FORM catalog): `layout: [{ widget, props }]`, `theme` id
- **UIContext** — data for widgets; widgets do not call business APIs
- **UIRuntime SDK** — dialog, toast, navigation, clipboard, localization, theme, events
- **Health** — identical `/health/live` + `/health/ready` payloads on every backend

## Governance

- Platform Architecture v1.0 remains stable
- ADRs capture intentional principle changes
- Implementation Convergence / Deletion Policy track legacy removal
- Observability Convergence tracks instrumentation maturity
- `arch:fitness` prevents regression automatically

## Success criteria

- New workflow via metadata/extensions without modifying Workflow Runtime
- New screen via UI Runtime without modifying the renderer
- New widget/activity/theme/integration via `register*` without platform code changes
- Every backend participates in standardized observability automatically
- Deletion Policy legacy layers removed on schedule
- `arch:fitness` remains green

## First vertical-slice milestone

Customer/SO path → snapshot → UI Runtime task → Task Command → Sales Adapter → Inventory → Observability (logs, traces, metrics, business spans, lifecycle events) → visible end-to-end in Grafana.

## Related

- [Architecture Gates L0–L3](./guides/architecture-gates.md)
- [Platform KPIs](./guides/platform-kpis.md)
- [Deletion Policy](./guides/deletion-policy.md)
- [Deployment Contract](./guides/deployment-contract.md)
- [Logging](./guides/logging.md)
- [Telemetry](./guides/telemetry.md)
- [Dashboards](./guides/dashboards.md)
- [Vertical slice observability](./guides/vertical-slice-observability.md)
- [ADRs](./adr/) — including [ADR 0009 UI Composition (v1.1)](./adr/0009-ui-composition.md)
- [METADATA-PLATFORM.md](./METADATA-PLATFORM.md)
- [WORKFLOW-PLATFORM.md](./WORKFLOW-PLATFORM.md)
