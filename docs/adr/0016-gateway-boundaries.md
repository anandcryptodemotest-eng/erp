# ADR 0016: Gateway Boundaries & Migrate-When-Touched

**Status:** Approved (Frozen — TrustWood ERP Platform v1.0)  
**Depends on:** ADR 0015, deployment contract

## Context

Gateway is a hybrid: identity/licensing, tenant admin UI host, BFF rewrites to domain services, and platform APIs. A big-bang microservice rewrite is high risk and low ROI.

## Decision

### As-built (honest)

- Domain apps (`sales`, `inventory`, …): process + DB per domain; sync `ServiceClient`.
- Gateway: identity store + admin UI + path rewrite BFF (ports: gateway **3010**, sales **3001**, …).
- Platform app: UI host only → gateway `/api/platform/*`.

### Target (incremental)

| Concern | Target | Migrate when |
|---------|--------|--------------|
| Gateway SRP | Separate **identity/licensing** concerns from **tenant admin UI host**; keep **BFF rewrites** explicit | Touching auth/provisioning or extracting UI host |
| Domain layering | Route handlers → thin adapters + domain modules inside each service | Feature work in that service |
| Cross-domain | Prefer async events for side effects; sync client for queries | New cross-service workflows needing consistency |
| Shared types | Slim `@erp/types`; DTOs near owning service | Type churn / new APIs |
| Service auth | Fail-closed `SERVICE_SECRET` | Ops hardening sprint |

### Explicit non-goals

- Rewriting every microservice in one program
- Replacing Next.js API hosts wholesale
- Introducing an event bus before a real saga need

## Consequences

- Refresh living docs (`ARCHITECTURE.md`) to match ports and BFF role; no fictional “pure API gateway.”
- Extend `architecture-fitness` checks as boundaries land.
- UI work must not wait on service splits (ADR 0015).
