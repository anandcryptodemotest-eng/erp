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
9. **Activity ≠ Work Item.** Engine activities (routing, RBAC, audit, optional/auto) must not automatically become Order Desk tasks. Human-facing **Business Work Items** are decided in [`SO-TASK-RATIONALIZATION.md`](./SO-TASK-RATIONALIZATION.md) (KEEP / MERGE / CONDITIONAL / AUTOMATIC). A Work Item may advance multiple activities behind one operator Complete; do not delete activities merely because they are MERGED for presentation.
10. **Joins:** readiness uses **AND** over incoming edges (`evaluateReadiness` / `deps.every`). Explicit **OR** joins are out of scope until a published template needs alternate-path fan-in. Procurement is an optional/conditional activity (`shortage`), framed as an exception Work Item — not a peer step on every order.
11. **Order context ≠ task model.** **OrderNote** (Sales) = internal operational notes; **OrderDocument** (Sales) = file metadata; **Messages** (Gateway Communication) = chat. Do not overload `OrderModification` for notes or put chat in `erp_sales`. Form chrome widgets (**CustomerInfo** / **Notes** / **Attachments**) ship on SO_STANDARD starter **rev 4** as recommended default; Messages stay Order Desk host chrome. See backlog **BL-036**.

## Consequences

- Admin **Workflows** + **Configuration** (Forms) modules: draft, validate, publish.
- New SOs with a published template use v5 `startSalesOrderWorkflowV5` with form pin.
- Claim / renew / release / complete via `/api/workflow-tasks/:id?action=`.
- **Task API RBAC (frozen P0):** claim/complete/renew/release enforce role (+ lease) in runtime via `assertWorkflowTaskAction` — not UI-only. Wrong role → **403**.
- **WorkflowEvent audit (frozen P1):** transitions persist to `WorkflowEvent` (audit log / timeline foundation — not an integration bus). Soft-fail on write errors.
- Designer and runtime share `@erp/workflow` validator and `evaluateReadiness`.

See canonical architecture: `.cursor/plans/workflow_management_map_aaf9d78b.plan.md` (TrustWood Workflow Platform — Frozen).

**Human task model:** [`SO-TASK-RATIONALIZATION.md`](./SO-TASK-RATIONALIZATION.md) (Phase 0 locked 2026-08-15). Implementation of Work Item presentation is backlog **BL-035** — do not continue optimizing a 1:1 activity↔screen model.
