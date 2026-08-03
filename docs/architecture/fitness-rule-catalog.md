# Architecture Fitness Rule Catalog

**Lifecycle:** Proposed → Approved → Enforced  
**Baseline script:** [`scripts/architecture-fitness.cjs`](../../scripts/architecture-fitness.cjs)

A rule moves to Enforced only when its decision is Accepted, an owner is assigned, the repository passes the baseline, and CI executes it.

## Existing rules

| ID | Invariant | State | Owner | Decision | Current baseline |
|---|---|---|---|---|---|
| FIT-001 | `@erp/workflow` must not import Sales | Enforced locally | Architecture | ADR 0017 | Pass |
| FIT-002 | `@erp/ui-runtime` must not import application code | Enforced locally | Architecture | ADR 0010 | Pass |
| FIT-003 | Orders must start the v5 snapshot workflow | Enforced locally | Sales | Workflow platform decision | Pass |
| FIT-004 | Hybrid workflow runtime must remain deleted | Enforced locally | Sales | Workflow platform decision | Pass |
| FIT-005 | Every backend has telemetry instrumentation | Enforced locally | Operations | ADR 0007 | Pass |
| FIT-006 | Every backend has live/readiness endpoints | Enforced locally | Operations | Deployment contract | Pass statically |
| FIT-007 | Apps do not import raw OpenTelemetry APIs | Enforced locally | Operations | ADR 0007 | Pass |
| FIT-008 | Backend API/lib code uses structured logger, not console | Enforced locally | Service Owners | Logging guide | Pass (Inventory console routes fixed 2026-08-02) |
| FIT-009 | Every backend has a Dockerfile | Enforced locally | Operations | Deployment contract | Pass |

“Enforced locally” means the script exists and fails the command; CI enforcement is not present.

## Proposed rules

| ID | Invariant | State | Owner | Decision | Enforcement prerequisite |
|---|---|---|---|---|---|
| FIT-010 | No app imports another app | Proposed | Architecture | AGR-011 | Baseline import graph |
| FIT-011 | Shared packages never import application code | Proposed | Architecture | AGR-011 | Expand package scan |
| FIT-012 | No service imports another service’s Prisma client/schema | Proposed | Architecture | AGR-011 | Define generated-client patterns |
| FIT-013 | Service dependency graph has no unapproved cycles | Proposed | Architecture | AGR-004 | Generate call graph; record Inventory↔Accounting decision |
| FIT-014 | Browser channels access domain services only through approved Gateway paths | Proposed | Platform | AGR-003 | POS/Delivery App migration |
| FIT-015 | Gateway public route manifest resolves to an implemented service route | Proposed | Platform | AGR-001 | Machine-readable route catalog |
| FIT-016 | External service APIs publish versioned machine-readable contracts | Proposed | Service Owners | AGR-010 | Contract format and version policy |
| FIT-017 | Cross-service writes include idempotency and failure policy metadata | Proposed | Domain Owners | AGR-004 | Critical-flow catalog |
| FIT-018 | Service-to-service auth fails closed outside development | Proposed | Security | AGR-004 | Environment policy and secret rotation |
| FIT-019 | Critical tenant mutations emit required audit events | Proposed | Security | AGR-008 | Audit taxonomy and template |
| FIT-020 | Workflow definitions enter apps through runtime contracts, not direct production template imports | Proposed | Sales/Architecture | AGR-002 | Mark simulation/test exceptions |
| FIT-021 | Shared package dependencies conform to the normative matrix | Proposed | Architecture | AGR-011 | Matrix Accepted |
| FIT-022 | Every remediation decision has owner, exit criteria, and review date | Proposed | Architect | Charter v1.0 | Register schema check |
| FIT-023 | Every backend route contract has at least one auth/tenant test | Proposed | Service Owners | AGR-010 | App test harness |
| FIT-024 | Edge E2E traverses nginx/Gateway, not direct service ports | Proposed | QA/Platform | AGR-003 | Deployable channel test environment |
| FIT-025 | Architecture docs use canonical service ports and base paths | Proposed | Architecture | AGR-001 | Canonical service registry |

## Immediate baseline actions

1. ~~Replace raw Inventory API `console.*` with `@erp/logger`.~~ Done 2026-08-02.
2. Add architecture fitness to CI now that the local baseline passes.
3. Approve AGR-011 before enforcing matrix rules.
4. Approve AGR-003 before forbidding POS/Delivery App direct paths.

## Rule state transition

```text
Proposed
  → evidence and impact reviewed
Approved
  → baseline clean + owner + implementation
Enforced
  → CI blocks violations + exception requires Accepted decision
```
