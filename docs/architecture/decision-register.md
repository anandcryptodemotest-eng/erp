# Architecture Decision Register

**Review:** TrustWood ERP Architecture Governance Review v1.0  
**Status vocabulary:** Proposed · Accepted · Deferred · Superseded

Owners are role placeholders until assigned by the Approver. Review dates are governance checkpoints, not implementation deadlines.

## Decisions

### AGR-001 — Keep Gateway hybrid; migrate when touched

- **Status:** Proposed
- **Owner:** Platform Owner
- **Priority:** P1
- **Rationale:** Gateway combines identity/licensing, BFF, platform APIs, and tenant Admin UI. A big-bang split increases operational risk without first reducing coupling.
- **Decision:** Keep identity/licensing, platform APIs, and explicit BFF rewrites together for v1.x. Incrementally thin domain UI and isolate identity modules when auth/provisioning is touched.
- **Consequences:** Gateway remains central; route and auth fitness rules become mandatory.
- **Related ADRs:** ADR 0015, ADR 0016
- **Exit criteria:** BFF manifest published; protected-route policy adopted; domain UI migration trigger documented; smoke tests cover public paths.
- **Review date:** 2026-11-02 or next auth/provisioning change

### AGR-002 — Keep Workflow Runtime in Sales

- **Status:** Proposed
- **Owner:** Sales/OMS Owner
- **Priority:** P1
- **Rationale:** Sales is the only execution-store consumer. The engine package is already domain-agnostic; service extraction adds distributed state before a second need exists.
- **Decision:** Keep workflow instances/tasks/events and domain adapter in Sales. Reconsider only when a second domain requires shared execution persistence.
- **Consequences:** Sales remains mixed; engine/package boundaries and adapter purity must be enforced.
- **Related ADRs:** ADR 0002, ADR 0016, ADR 0017
- **Exit criteria:** Ownership matrix documented; no shared package imports Sales; second-consumer trigger recorded.
- **Review date:** On first non-Sales workflow execution proposal

### AGR-003 — Standardize browser channels on Gateway BFF

- **Status:** Proposed
- **Owner:** Platform Owner
- **Priority:** P1
- **Rationale:** Customer and Platform use a same-origin Gateway edge, while POS and Delivery App bypass it through direct/multi-service browser routes.
- **Decision:** Route POS and Delivery App browser traffic through Gateway. Domain services remain inaccessible as browser-facing contracts unless explicitly approved.
- **Consequences:** Gateway route registry expands; edge security and audit become consistent.
- **Related ADRs:** ADR 0010, ADR 0016
- **Exit criteria:** Direct browser-domain URLs removed; Gateway routes contract-tested; CORS exceptions removed; E2E tests pass through nginx/Gateway.
- **Review date:** 2026-09-15

### AGR-004 — Harden synchronous multi-service writes before adding an event bus

- **Status:** Proposed
- **Owner:** Architecture + Domain Owners
- **Priority:** P0
- **Rationale:** Current integrity risk comes from partial synchronous writes. An event bus without idempotency/outbox discipline would move, not solve, the problem.
- **Decision:** Add idempotency, compensation/reconciliation, durable retries, and contract tests to critical flows. Introduce async infrastructure only for a demonstrated saga or throughput need.
- **Consequences:** Short-term work stays within services; consistency behavior becomes explicit.
- **Related ADRs:** ADR 0016
- **Exit criteria:** Critical flow catalog complete; each flow has atomicity/compensation policy; integration tests cover downstream failure; reconciliation is observable.
- **Review date:** After P0 integrity slices

### AGR-005 — Keep Accounting core together; treat POS billing as a bounded submodule

- **Status:** Proposed
- **Owner:** Finance Owner
- **Priority:** P1
- **Rationale:** GL, journals, AR/AP, payments, and tax change together. Bills/shifts add retail operational reasons to change but do not yet prove independent deployment value.
- **Decision:** Keep Accounting service. Isolate POS billing/shift modules internally and define extraction triggers.
- **Consequences:** Accounting continues to coordinate some Inventory writes; contract and failure handling must improve.
- **Related ADRs:** ADR 0016
- **Exit criteria:** POS module boundary documented; inventory side effects idempotent; extraction triggers approved; route authorization tested.
- **Review date:** Next major POS billing change

### AGR-006 — Move driver operational state from HR to Delivery

- **Status:** Proposed
- **Owner:** HR + Delivery Owners
- **Priority:** P1
- **Rationale:** Employment identity belongs to HR; driver availability and active assignments change with last-mile operations.
- **Decision:** HR retains employee identity and eligibility. Delivery owns availability, current assignment, and operational driver state linked by employee ID.
- **Consequences:** Requires migration and read contract; no HR/Delivery service merge.
- **Related ADRs:** ADR 0016
- **Exit criteria:** Delivery model/API added; data migrated; HR fields deprecated; assignment tests pass; ADR/ownership map updated.
- **Review date:** Next Delivery workforce feature

### AGR-007 — Keep Inventory Catalog, Stock, Pricing, and Warehousing together

- **Status:** Proposed
- **Owner:** Inventory Owner
- **Priority:** P3
- **Rationale:** These capabilities share product/variant identity and transactional change reasons. Splitting would introduce distributed consistency into normal stock operations.
- **Decision:** Do not split Inventory. Clarify tax-policy ownership and improve internal modules/contracts.
- **Consequences:** Inventory remains broad but cohesive; scale/ownership evidence is required for future extraction.
- **Related ADRs:** ADR 0016
- **Exit criteria:** Internal ownership map and contracts documented; tax dependency decision accepted; no split action required.
- **Review date:** 2027-02-02 or independent scale trigger

### AGR-008 — Unify audit contract; do not create an Audit microservice yet

- **Status:** Proposed
- **Owner:** Platform Security Owner
- **Priority:** P1
- **Rationale:** Platform audit, workflow events, and domain audit have different audiences and retention needs. The immediate gap is inconsistent emission and taxonomy, not storage topology.
- **Decision:** Define one audit envelope/taxonomy and minimum event requirements. Preserve separate stores; federate reads if needed.
- **Consequences:** Cross-store queries remain; compliance coverage becomes measurable.
- **Related ADRs:** ADR 0008, ADR 0016
- **Exit criteria:** Audit schema published; one domain template implemented; critical actions covered; audit tests and retention ownership approved.
- **Review date:** 2026-10-01

### AGR-009 — Keep Notifications in Gateway; publish a notification command contract

- **Status:** Proposed
- **Owner:** Platform Owner
- **Priority:** P2
- **Rationale:** Current volume and ownership do not justify a deployable service. Domain emitters need one stable contract.
- **Decision:** Gateway retains Notification persistence and delivery. Domains invoke a versioned command/event contract.
- **Consequences:** Gateway remains notification dependency; delivery failures must be non-blocking and observable.
- **Related ADRs:** ADR 0016
- **Exit criteria:** Contract versioned; auth/tenant rules documented; producer contract tests pass; failure metrics exist.
- **Review date:** When notification volume/SLA changes

### AGR-010 — Service-owned contracts; slim broad shared DTOs

- **Status:** Proposed
- **Owner:** Architecture + Service Owners
- **Priority:** P2
- **Rationale:** `@erp/types` contains broad domain DTOs that can drift from owning Prisma/API models.
- **Decision:** Keep only true cross-cutting primitives in `@erp/types`; publish service contracts beside owners and generate clients/schema where practical.
- **Consequences:** Migration is incremental; temporary duplicate versions require deprecation policy.
- **Related ADRs:** ADR 0016, ADR 0017
- **Exit criteria:** Contract ownership matrix approved; first two service contracts versioned; drift check enabled; deprecated DTO migration tracked.
- **Review date:** 2026-11-02

### AGR-011 — Shared-package dependency matrix is normative

- **Status:** Proposed
- **Owner:** Architecture
- **Priority:** P2
- **Rationale:** Package boundaries need machine-testable allowed dependencies.
- **Decision:** Adopt the matrix in `package-dependency-matrix.md` as governance policy and convert Approved rows to fitness checks.
- **Consequences:** Some existing dependencies may need accepted exceptions or cleanup.
- **Related ADRs:** ADR 0017
- **Exit criteria:** Matrix reviewed; exceptions recorded; Approved rules pass baseline; CI enforcement plan accepted.
- **Review date:** 2026-09-15

### AGR-012 — Runtime evidence follow-up required

- **Status:** Proposed
- **Owner:** Operations
- **Priority:** P2
- **Rationale:** Backend health endpoints are live for Gateway and domain services, but the baseline still lacks canonical journey traces. Health alone is not enough for High confidence.
- **Decision:** Do not accept boundary-changing remediation until critical paths have runtime traces or exercised E2E evidence.
- **Consequences:** Review confidence remains Medium for most entities until journey evidence is attached.
- **Related ADRs:** ADR 0007, ADR 0008
- **Exit criteria:** Services healthy in review environment (done for Gateway + domains); Platform health route decided; traces captured for login, order, PO receive, payroll, delivery, and workflow completion; evidence linked in ledger.
- **Review date:** Before accepting P1 boundary changes

## Register history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-02 | Initial proposed decisions from Architecture Governance Review |
