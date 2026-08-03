# TrustWood ERP Architecture Governance Review

**Version:** 1.0  
**Status:** Baseline review complete; decisions proposed  
**Review date:** 2026-08-02  
**Charter:** Architecture Governance Review v1.0  
**Evidence precedence:** Runtime → Static implementation → Deployment configuration → Documentation → Assumption

## Executive summary

TrustWood ERP has a sound structural baseline: database-per-service ownership, no app-to-app imports, centralized service authentication, shared telemetry, and explicit BFF routing. The main weaknesses are not service count; they are cross-service integrity, contract drift, uneven security at channel boundaries, incomplete audit coverage, and missing app-level tests.

The portfolio average is **Mixed**. Platform is the strongest UI host. Inventory, Procurement, and Delivery should remain separate services but be governed as one trading-journey cluster. Gateway, Accounting, HR, Delivery App, and Audit score below the nominal split threshold; all receive evidence-based overrides against immediate extraction. The correct response is incremental boundary hardening, not a big-bang rewrite.

### Architecture health

| Area | Status | Basis |
|---|---|---|
| Capability ownership | Mixed | Gateway, Accounting, HR, and Sales carry multiple change reasons |
| Data ownership | Good | Seven owned databases; no cross-service Prisma clients found |
| Security boundaries | At risk | POS/Delivery App edge inconsistency; service-secret trust; route-level variance |
| Contracts | At risk | Manual BFF map, delivery path/payload drift, shared DTO drift, no OpenAPI |
| Observability | Mixed | Backend health endpoints respond; journey traces and staging observability profile still incomplete |
| Test coverage | At risk | Package tests and shell E2E exist; no app integration-test foundation |
| Runtime isolation | Mixed | Independent backend processes; synchronous chains lack compensation/outbox |

## Review method

Each service is scored 1–5 across:

1. Business capability ownership
2. Data ownership
3. API cohesion
4. Coupling and change cohesion
5. Failure isolation
6. Security boundary
7. Testability
8. Operational independence

**32–40:** Focused  
**24–31:** Mixed but acceptable  
**Below 24:** Split recommended

The score is guidance. Overrides require evidence, rationale, an owner, and a review trigger.

### Confidence

- **High:** verified by static code and runtime behavior.
- **Medium:** verified statically; runtime behavior inferred.
- **Low:** documentation or partial implementation only.

Re-verified 2026-08-02: Sales/Inventory/Accounting/HR/Procurement/Delivery (`/health/live` + `/health/ready`) and Gateway (`/admin/health/live` + `/admin/health/ready`) return 200. Platform (`3011`) is listening but has no health route. Scorecards remain Medium because health alone is not journey evidence; login → order → PO receive → payroll → delivery → workflow traces are still required for High confidence.

## Intended, as-built, and runtime architecture

### Intended

- Domain services own capability data and expose APIs.
- Gateway is the tenant identity/licensing store, Admin UI host, and explicit BFF.
- Platform is an operator UI host.
- Browser channels use the edge/BFF; service-to-service calls use `ServiceClient`.
- Workflow engine is shared; persistence and sales adapter remain in Sales until a second execution domain proves extraction value.

Evidence:
- [`docs/adr/0016-gateway-boundaries.md`](../adr/0016-gateway-boundaries.md)
- [`docs/adr/0017-package-promotion-rules.md`](../adr/0017-package-promotion-rules.md)
- [`docs/architecture/tenant-operating-model.md`](tenant-operating-model.md)

### As built

```text
Users
  → Customer / POS / Delivery App / Platform / Tenant Admin
  → nginx
  → Gateway BFF and identity
  → Sales / Inventory / Accounting / HR / Procurement / Delivery
  → owned PostgreSQL databases

Shared execution:
  @erp/workflow → Sales workflow persistence/runtime
  @erp/ui-runtime → host-neutral screen runtime
  @erp/admin-ui-host → admin widgets and task simulator
```

Backend deployment definitions exist for Gateway and six domain services in [`docker-compose.yml`](../../docker-compose.yml). Customer, POS, Delivery App, and Platform are host-run channels and are not in compose.

### Runtime behavior

- Tenant JWTs are issued by Gateway; domain middleware injects tenant/user/module headers.
- Platform JWTs target a tenant using `x-tenant-id`.
- Service calls use `x-service-key`, request/correlation IDs, tenant/user propagation, and trace headers.
- Cross-service writes are synchronous HTTP calls. No `/api/events` receiver exists, although `ServiceClient.emit()` sends there.
- Backend health is live for Gateway and domain services. Canonical journey traces are still missing, so runtime confidence remains Medium until AGR-012 evidence is attached.

## Drift summary

| Finding | Drift type | Evidence | Confidence |
|---|---|---|---|
| Architecture docs contain historic gateway port references | Documentation | ADR 0016 and compose use 3010 | High |
| POS and Delivery App do not follow the gateway-only browser edge | Implementation | Channel `next.config.ts` and API clients | Medium |
| Gateway delivery-zone/executive routes diverge from Delivery/HR APIs | Implementation | Gateway rewrites vs Delivery route tree | High |
| E2E claims invoice generation while Sales adapter is passthrough | Documentation + implementation | Sales adapter and E2E docs | High |
| `ServiceClient.emit()` targets absent `/api/events` handlers | Implementation | `packages/config/src/service-client.ts`; route search | High |
| Audit is described as cross-cutting but implemented in fragments | Implementation | Gateway PlatformAuditLog, Sales WorkflowEvent, Delivery AuditLog | High |
| Initial review used wrong Gateway health path / incomplete probes; backends are healthy, journey traces still missing | Runtime | Re-probe 2026-08-02 `/admin/health/*` + domain `/health/*` | High |

## Service scorecards

| Entity | Capability | Data | API | Coupling | Failure | Security | Tests | Ops | Total | Verdict | Confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Gateway | 2 | 4 | 3 | 2 | 3 | 3 | 2 | 3 | 22 | Split → keep hybrid, migrate when touched | Medium |
| Sales | 4 | 4 | 3 | 2 | 2 | 4 | 3 | 4 | 26 | Mixed | Medium |
| Accounting | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 4 | 23 | Split → keep core, isolate POS subdomain | Medium |
| HR | 3 | 3 | 4 | 2 | 2 | 3 | 2 | 4 | 23 | Split → keep HR, move delivery state | Medium |
| Inventory | 4 | 4 | 3 | 4 | 3 | 4 | 2 | 4 | 28 | Mixed, keep together | Medium |
| Procurement | 4 | 4 | 3 | 3 | 2 | 4 | 2 | 4 | 26 | Mixed, focused boundary | Medium |
| Delivery | 4 | 4 | 2 | 3 | 2 | 4 | 2 | 4 | 25 | Mixed, focused boundary | Medium |
| Customer | 4 | 5 | 4 | 3 | 4 | 3 | 2 | 2 | 27 | Mixed channel host | Medium |
| POS | 4 | 5 | 3 | 3 | 3 | 2 | 2 | 2 | 24 | Mixed, edge remediation required | Medium |
| Delivery App | 4 | 5 | 2 | 3 | 3 | 2 | 2 | 2 | 23 | Split → keep channel, fix edge | Medium |
| Platform | 5 | 5 | 5 | 4 | 4 | 4 | 3 | 3 | 33 | Focused | Medium |
| Identity | 4 | 4 | 4 | 2 | 3 | 4 | 3 | 2 | 26 | Mixed, defer extraction | Medium |
| Workflow | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 28 | Mixed, correct current placement | Medium |
| Notifications | 3 | 4 | 4 | 2 | 4 | 4 | 2 | 2 | 25 | Mixed, contract first | Medium |
| Audit | 3 | 2 | 2 | 2 | 4 | 3 | 2 | 2 | 20 | Split → unify contract, not service | Medium |

## Service reviews

### Gateway

**Responsibility:** Tenant identity/licensing, platform APIs, BFF rewrites, tenant Admin UI host, notifications, and marketing data.  
**Owner:** Platform  
**Verdict:** 22/40; nominal Split Recommended, overridden by ADR 0016.

**Evidence**
- [`apps/gateway/next.config.ts`](../../apps/gateway/next.config.ts)
- [`apps/gateway/prisma/schema.prisma`](../../apps/gateway/prisma/schema.prisma)
- [`apps/gateway/src/app/(admin)`](../../apps/gateway/src/app/(admin))
- [`docs/adr/0016-gateway-boundaries.md`](../adr/0016-gateway-boundaries.md)

**Current → Target**
- Current: identity + BFF + Admin UI + platform APIs + marketing.
- Target: identity/licensing + explicit BFF remain; Admin UI becomes a thinner host; domain UI modules migrate when touched.

**Keep together**
- Keep identity store, licensing, platform APIs, and BFF in one deployment for v1.x.
- Do not invent a pure gateway rewrite program.

**Primary gaps**
- Gateway-owned APIs rely on per-route authorization rather than one global protected-route policy.
- Manual rewrite registry can drift from service routes.
- Product and Sales Desk UI cause Gateway changes for Inventory/Sales capabilities.

**Migration slices**
1. Publish/test the BFF route manifest.
2. Add a shared protected-route policy for Gateway-owned APIs.
3. Migrate domain UI modules only when those capabilities are changed.

### Sales

**Responsibility:** CRM, quotations, orders, returns, workflow persistence/runtime, and order orchestration.  
**Owner:** Sales/OMS  
**Verdict:** 26/40; Mixed.

**Evidence**
- [`apps/sales/prisma/schema.prisma`](../../apps/sales/prisma/schema.prisma)
- [`apps/sales/src/app/api/orders/[id]/route.ts`](../../apps/sales/src/app/api/orders/[id]/route.ts)
- [`apps/sales/src/workflow-adapter/sales-order-adapter.ts`](../../apps/sales/src/workflow-adapter/sales-order-adapter.ts)
- [`apps/sales/src/lib/workflow-runtime-v5.ts`](../../apps/sales/src/lib/workflow-runtime-v5.ts)

**Current → Target**
- Current: coherent Sales/OMS service with synchronous cross-domain writes.
- Target: retain CRM/Orders/Workflow runtime; make adapter side effects idempotent, observable, and compensatable.

**Keep together**
- Keep Workflow Runtime inside Sales until a second domain needs shared execution persistence.
- Keep CRM and order lifecycle together for now; revisit if independent ownership/change cadence emerges.

**Primary gaps**
- Invoice generation action does not perform the documented Accounting integration.
- Returns can restock Inventory before Accounting credit-note failure.
- Legacy order actions and workflow task actions coexist.

**Migration slices**
1. Implement idempotent Sales→Accounting invoice posting.
2. Add reconciliation/compensation for return processing.
3. Contract-test Sales→Inventory/Accounting/Delivery/Procurement.

### Accounting

**Responsibility:** GL, journals, AR/AP, tax, payments, plus POS bills/shifts/returns.  
**Owner:** Finance  
**Verdict:** 23/40; Split Recommended with keep-core override.

**Evidence**
- [`apps/accounting/prisma/schema.prisma`](../../apps/accounting/prisma/schema.prisma)
- [`apps/accounting/src/app/api/journals/route.ts`](../../apps/accounting/src/app/api/journals/route.ts)
- [`apps/accounting/src/app/api/bills`](../../apps/accounting/src/app/api/bills)

**Current → Target**
- Current: financial truth plus retail transaction coordination.
- Target: GL/AR/AP/tax remain together; POS billing becomes an explicit bounded submodule and later extraction candidate only if independent change/scale is demonstrated.

**Primary gaps**
- Journal account resolution uses a Prisma delegate inconsistent with the schema.
- Journal/invoice write authorization needs a consistent role policy.
- POS billing coordinates Inventory stock writes, widening Accounting’s failure boundary.

**Migration slices**
1. Correct journal account resolution and add route integration tests.
2. Fail HR payroll transitions when journal creation fails.
3. Document POS billing as a bounded submodule and its extraction trigger.

### HR

**Responsibility:** Employees, payroll, leave, tax slabs, and delivery-executive attributes.  
**Owner:** People Operations  
**Verdict:** 23/40; Split Recommended with keep-HR override.

**Current → Target**
- Current: HR plus operational driver state.
- Target: HR owns people/payroll/leave; Delivery owns driver availability and active assignment state linked by employee ID.

**Primary gaps**
- Payroll advances even when Accounting journal calls fail.
- Hardcoded account codes couple HR to tenant chart-of-accounts configuration.
- `currentOrderId` and availability fields are operational Delivery concerns.

**Migration slices**
1. Make payroll posting fail closed and idempotent.
2. Introduce tenant-configured payroll account mappings.
3. Move driver availability/assignment state to Delivery when that module is touched.

### Inventory

**Responsibility:** Catalog, attributes, variants, stock, warehouses, pricing, and BOM.  
**Owner:** Inventory/Catalog  
**Verdict:** 28/40; Mixed, keep together.

**Keep together**
- Catalog and Stock share product/variant identity and transaction reasons.
- Do not split Catalog, Pricing, or Warehousing without independent ownership/scale evidence.

**Primary gaps**
- Tax resolution introduces Accounting dependency.
- Architecture fitness console rule was failing; Inventory API routes now use `@erp/logger`.
- Contract and route integration tests are limited.

**Migration slices**
1. Replace raw console usage with structured logger.
2. Publish Catalog/Stock/Pricing contracts and idempotency rules.
3. Decide tax-policy ownership; keep only tax attributes/lookup contract in Inventory.

### Procurement

**Responsibility:** Vendors, vendor-product links, RFQ, purchase orders, and purchase returns.  
**Owner:** Procurement  
**Verdict:** 26/40; Mixed but boundary is focused.

**Current → Target**
- Current: coherent Procurement service with synchronous Inventory and Accounting writes.
- Target: same boundary with idempotent goods-receipt and AP-posting workflow.

**Primary gaps**
- PO receive can update stock before Accounting failure with no compensation.
- DTO/status drift exists between Prisma and shared types.

**Migration slices**
1. Harden PO receive with reconciliation/compensation.
2. Add partial-receipt and idempotency tests.
3. Move Procurement DTO ownership beside the service contract.

### Delivery

**Responsibility:** Zones, assignments, tracking, compensation, and earnings.  
**Owner:** Last-mile Operations  
**Verdict:** 25/40; Mixed but focused.

**Current → Target**
- Current: focused service with contract drift at Gateway/Sales boundaries.
- Target: same boundary; retryable/idempotent Sales status synchronization and Gateway-only channel edge.

**Primary gaps**
- Gateway route names and Sales dispatch payload do not match Delivery routes/schema.
- Delivery completion has no durable retry when Sales synchronization fails.

**Migration slices**
1. Align Gateway routes and Sales payloads with Delivery contracts.
2. Add a durable outbox/retry state for Delivery→Sales completion.
3. Add assignment finite-state-machine tests.

### Channel hosts

**Customer (27/40):** keep as one storefront host; standardize deployment/health and remove dead dependencies.  
**POS (24/40):** keep as one retail channel; move browser traffic behind Gateway and keep shift/billing rules in Accounting.  
**Delivery App (23/40):** keep as one driver channel; replace direct cross-origin calls with same-origin Gateway BFF.  
**Platform (33/40):** maintain as reference thin operator host; extend smoke coverage for Process Studio.

### Shared runtime capabilities

**Identity (26/40):** keep in Gateway until auth/provisioning work justifies an internal module boundary and later extraction.  
**Workflow (28/40):** engine package + Sales persistence is correct; no Workflow Service extraction until a second domain needs shared execution.  
**Notifications (25/40):** keep Gateway persistence; publish one domain notification command/event contract.  
**Audit (20/40):** preserve separate platform and tenant stores; unify taxonomy and required emission contract before considering infrastructure.

## Cross-cutting findings

### Finding register

| ID | Severity | Finding | Evidence | Decision |
|---|---|---|---|---|
| AGR-F001 | P0 | Accounting journal account lookup does not match the Prisma model | `apps/accounting/src/app/api/journals/route.ts`; Accounting schema | AGR-004 |
| AGR-F002 | P0 | HR payroll advances without validating Accounting journal success | `apps/hr/src/app/api/payroll/[id]/route.ts`; `ServiceClient.call()` result contract | AGR-004 |
| AGR-F003 | P0 | Sales invoice workflow action does not post the documented AR invoice | `apps/sales/src/workflow-adapter/sales-order-adapter.ts`; E2E results | AGR-002, AGR-004 |
| AGR-F004 | P0 | Returns, PO receive, and delivery completion have partial-write failure paths | Sales/Procurement/Delivery route handlers | AGR-004 |
| AGR-F005 | P0 | Development service-secret fallback can become an unsafe production default | `packages/config/src/service-client.ts`; `docker-compose.yml` | AGR-004 |
| AGR-F006 | P1 | Gateway’s route catalog can drift from domain paths | `apps/gateway/next.config.ts`; Delivery route tree | AGR-001 |
| AGR-F007 | P1 | POS and Delivery App bypass the common Gateway-only browser edge | Channel API clients and rewrites | AGR-003 |
| AGR-F008 | P1 | Driver availability/current-order state is owned by HR rather than Delivery | HR schema; Delivery assignment routes | AGR-006 |
| AGR-F009 | P1 | Audit records lack one taxonomy and mandatory-action contract | Gateway platform audit; Sales workflow audit; Delivery AuditLog | AGR-008 |
| AGR-F010 | P1 | Accounting’s POS bills/shifts add an independent retail change reason | Accounting schema and bills routes | AGR-005 |
| AGR-F011 | P2 | Broad shared DTOs drift from owner models, including Procurement statuses | `packages/types/src/index.ts`; Procurement schema | AGR-010 |
| AGR-F012 | P2 | `ServiceClient.emit()` targets `/api/events`, but no receivers exist | `packages/config/src/service-client.ts`; route search | AGR-004 |
| AGR-F013 | P2 | App-level route, auth, contract, and failure tests are sparse | Workspace test inventory; package scripts | AGR-010 |
| AGR-F014 | P2 | Backend health is live, but canonical journey traces are still missing | Re-probe 2026-08-02; no login→order→payroll→delivery traces attached | AGR-012 |
| AGR-F015 | P2 | Architecture fitness is not wired into CI | `scripts/architecture-fitness.cjs` passes locally after Inventory logger fix | AGR-011 |
| AGR-F016 | P3 | Documentation and dependency metadata contain implementation drift | Architecture docs; package manifests; import inventory | AGR-001, AGR-010 |

### P0 — Integrity, security, availability

1. Accounting journal route/schema mismatch can break payroll posting.
2. Sales invoice generation is documented but not implemented in the workflow adapter.
3. HR payroll ignores downstream journal failures.
4. Multi-service writes lack consistent compensation, reconciliation, or durable retries.
5. Production-safe secret enforcement is not guaranteed by code defaults.

### P1 — Boundaries, ownership, coupling

1. Standardize POS and Delivery App on Gateway-only browser access.
2. Align Gateway/Sales/Delivery route and payload contracts.
3. Define one audit taxonomy and emission requirement.
4. Move driver operational state from HR to Delivery when touched.
5. Document POS billing as an Accounting subdomain with extraction triggers.

### P2 — Contracts, testing, telemetry

1. Publish versioned machine-readable service contracts.
2. Add app route/contract tests for cross-service vertical slices.
3. Make observability available in staging by default.
4. Add CI for architecture fitness, package tests, contract tests, and edge E2E.
5. Replace broad shared DTO ownership with service-owned contracts.

### P3 — Cleanup and developer experience

1. Remove dead dependencies and deprecated Gateway runtime shims.
2. Reconcile architecture docs with current ports and hosts.
3. Consolidate browser API-client patterns after edge standardization.

## Completion status

- Architecture Canvas: complete when published alongside this ledger.
- Audit Ledger: baseline findings complete; runtime verification follow-up required.
- Decision Register: proposed decisions recorded.
- Dependency Matrix: complete.
- Fitness Rule Catalog: proposed/approved baseline recorded.
- Roadmap: P0–P3 slices recorded; acceptance and ownership remain governance actions.

## Document version history

| Version | Date | Author | Summary | Approval |
|---|---|---|---|---|
| 1.0 | 2026-08-02 | Architecture Review | Initial evidence-backed baseline and proposed decisions | Pending Approver acceptance |
