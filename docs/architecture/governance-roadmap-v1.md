# Architecture Governance Roadmap

**Status:** Proposed — implementation requires accepted Decision Register entries  
**Principle:** Integrity, security, and availability before boundary extraction

## P0 — Integrity, security, availability

### P0.1 Accounting journal correctness

- **Decision:** AGR-004
- **Owner:** Finance Owner
- **Slices:**
  1. Correct account lookup to use the schema’s ChartOfAccount delegate.
  2. Add Accounting journal route integration tests.
  3. Make HR payroll fail closed when journal creation fails.
  4. Persist downstream journal references/idempotency keys.
- **Exit:** Payroll status and journal record remain consistent under success, duplicate, timeout, and downstream failure.

### P0.2 Sales financial posting

- **Decision:** AGR-002, AGR-004
- **Owner:** Sales/OMS Owner
- **Slices:**
  1. Implement `INVOICE_GENERATE` Accounting command.
  2. Add source-order idempotency.
  3. Add Sales→Accounting contract test.
  4. Reconcile E2E documentation with implemented behavior.
- **Exit:** Workflow completion creates exactly one AR invoice or an observable retry/reconciliation state.

### P0.3 Cross-service consistency catalog

- **Decision:** AGR-004
- **Owner:** Architecture + Domain Owners
- **Slices:**
  1. Catalog confirm, ship, return, PO receive, payroll, and delivery-complete writes.
  2. Assign atomicity, idempotency, retry, compensation, and reconciliation policy.
  3. Add correlation-aware failure telemetry.
- **Exit:** Every critical chain has tested failure semantics and an operational recovery path.

### P0.4 Secret and internal-call hardening

- **Decision:** AGR-004
- **Owner:** Security/Operations
- **Slices:**
  1. Fail closed when production secrets are absent/default.
  2. Define service identity and tenant authorization policy.
  3. Rotate shared secret and plan scoped service credentials.
- **Exit:** Production cannot boot with development secrets; internal calls are attributable and tenant-scoped.

## P1 — Business boundaries, ownership, coupling

### P1.1 Gateway route and auth governance

- **Decision:** AGR-001
- **Owner:** Platform Owner
- **Slices:** publish BFF manifest; test route resolution; centralize Gateway protected-route policy; classify public endpoints.
- **Exit:** Route manifest matches service APIs and protected routes have consistent auth/tenant behavior.

### P1.2 Channel edge convergence

- **Decision:** AGR-003
- **Owner:** Platform + Channel Owners
- **Slices:** migrate POS; migrate Delivery App; remove direct service URLs/CORS assumptions; add nginx/Gateway E2E.
- **Exit:** Browser channels use approved same-origin Gateway paths only.

### P1.3 Delivery contract alignment

- **Decision:** AGR-003, AGR-004
- **Owner:** Delivery + Sales Owners
- **Slices:** align zones/executives routes; align assignment payload; add durable Delivery→Sales retry; test assignment FSM.
- **Exit:** Dispatch and completion flows pass contract/failure tests.

### P1.4 HR/Delivery ownership

- **Decision:** AGR-006
- **Owner:** HR + Delivery Owners
- **Slices:** add Delivery driver state; migrate data; switch reads/writes; deprecate HR operational fields.
- **Exit:** HR stores employment identity only; Delivery owns availability and current assignment.

### P1.5 Audit governance

- **Decision:** AGR-008
- **Owner:** Security/Platform
- **Slices:** publish taxonomy/envelope; implement one domain template; identify mandatory actions; add coverage tests.
- **Exit:** Critical tenant/platform/workflow actions have queryable, attributable audit records.

## P2 — Contracts, testing, telemetry

### P2.1 Service-owned contracts

- **Decision:** AGR-010
- **Owner:** Architecture + Service Owners
- **Slices:** choose contract format; version first Sales/Delivery contracts; generate/validate clients; deprecate shared DTO copies.
- **Exit:** External contracts are machine-readable, versioned, owner-scoped, and drift-tested.

### P2.2 App integration test foundation

- **Decision:** AGR-010
- **Owner:** Service Owners/QA
- **Slices:** route harness; auth/tenant tests; downstream stubs; critical vertical-slice suites.
- **Exit:** Every backend has route-level auth/tenant and core failure-path tests.

### P2.3 Observability baseline

- **Decision:** AGR-012
- **Owner:** Operations
- **Slices:** start observability in staging by default; capture canonical traces; define SLOs/alerts; link evidence to ledger.
- **Exit:** Login, order, PO receive, payroll, delivery, and workflow completion traces are available.

### P2.4 CI architecture gates

- **Decision:** AGR-011
- **Owner:** Platform Engineering
- **Slices:** confirm local fitness baseline (pass); add package tests; add architecture fitness to CI; add contract and edge smoke stages.
- **Exit:** Approved rules block regressions in CI with decision-backed exceptions.

## P3 — Cleanup and developer experience

- Remove dead dependencies and deprecated Gateway runtime shims.
- Reconcile canonical ports/base paths in architecture documents.
- Consolidate channel API-client/session helpers after edge convergence.
- Add Decision Register and documentation schema validation.
- Review package promotion and domain vocabulary annually.

## Sequencing constraints

1. P0.1 and P0.2 precede any Sales/Accounting boundary extraction.
2. AGR-003 must be Accepted before FIT-014 becomes Enforced.
3. Runtime evidence under AGR-012 is required before accepting boundary-changing P1 work.
4. Package matrix must be Accepted before dependency cleanup becomes a blocking CI rule.
5. No new event bus is introduced until P0.3 proves a saga/throughput requirement.
