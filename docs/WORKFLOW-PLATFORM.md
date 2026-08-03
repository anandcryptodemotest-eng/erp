# ADR: Domain-independent Workflow Platform

## Status

Accepted — Phase A–C foundational delivery (2026-07-29); Phase 1 metadata (AssetRef + Form catalog) 2026-07-29

## Context

OMS previously used status-gated hybrid workflows (`fromStatuses`, prep gate). That does not scale to multi-tenant ERP processes (SO, PO, Returns) or BA-owned configuration.

## Decision

1. **JSON is the source of truth.** Visual Designer (React Flow) authors Draft JSON only.
2. **Canvas → JSON → Validator → DB → Engine.** Runtime never reads UI nodes/`layout`.
3. **`packages/workflow`** is domain-independent; apps register adapters + task types.
4. **Instances snapshot** the published definition at start (version pin), including referenced FORM assets in `pinnedAssets`.
5. **`SO.status` is a projection**, not the control plane.
6. Default **`SO_STANDARD` v5** is sequential; parallelism is edge configuration only.
7. **Greenfield:** hybrid runtime deleted — new and in-flight work use snapshot (v5) only. Reset stale instances via `scripts/reset-workflow-v5`.
8. **Design-time vs Runtime:** Configuration Studio never executes; Runtime never sees drafts. Forms are referenced via `AssetRef` (concrete version only). See [METADATA-PLATFORM.md](./METADATA-PLATFORM.md).

## Consequences

- Admin **Workflows** + **Configuration** (Forms) modules: draft, validate, publish.
- New SOs with a published template use v5 `startSalesOrderWorkflowV5` with form pin.
- Claim / renew / release / complete via `/api/workflow-tasks/:id?action=`.
- **Task API RBAC (frozen P0):** claim/complete/renew/release enforce role (+ lease) in runtime via `assertWorkflowTaskAction` — not UI-only. Wrong role → **403**.
- **WorkflowEvent audit (frozen P1):** transitions persist to `WorkflowEvent` (audit log / timeline foundation — not an integration bus). Soft-fail on write errors.
- Designer and runtime share `@erp/workflow` validator and `evaluateReadiness`.

See canonical architecture: `.cursor/plans/workflow_management_map_aaf9d78b.plan.md` (TrustWood Workflow Platform — Frozen).
