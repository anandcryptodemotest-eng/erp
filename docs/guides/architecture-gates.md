# Architecture Gates (L0–L3)

Platform Architecture v1.0. Label PRs with the highest gate they touch.

| Level | Examples | Approval |
|-------|----------|----------|
| **L0 – Implementation** | Bug fixes, widgets, new forms, new activities, new themes | Feature owner |
| **L1 – Extension** | New widget type, new metadata asset type, new validator | Platform owner |
| **L2 – Core Platform** | UI Runtime, Workflow Runtime, Metadata Resolver, Snapshot model, Observability Runtime | Architecture review |
| **L3 – Platform Principles** | AssetRef, Snapshot semantics, Metadata lifecycle, Runtime contracts | ADR + architecture approval |

## Rules

- L2/L3 without architecture review = rejected.
- Prefer L0/L1: extend via `register(manifest, implementation)`, not core edits.
- Runtime never reads drafts or `latest`; only concrete AssetRef versions and immutable snapshots.
- Feature code uses `@erp/telemetry` helpers only (no raw OpenTelemetry, no `console.log` in API/lib paths).
- `pnpm arch:fitness` must stay green.
- **UI composition (ADR 0009):** before a new widget, prefer field type → existing widget config → UIContext → then registered widget. Widget lifecycle hooks are prohibited; use `runtime.events`.
- **Multi-Host (ADR 0010–0013):** Runtime / Widget / Host contracts are frozen for v1.x. Run [Architecture Compliance Review](../architecture/compliance-review.md) before proposals that touch those boundaries.
- **Host experience:** When classifying a new Host screen (commerce vs workflow), apply [host-experience-principle.md](../architecture/host-experience-principle.md) — guide only, not an ADR.
