# Shared Package Dependency Matrix

**Status:** Proposed  
**Owning decision:** AGR-011  
**Governing ADR:** ADR 0017

Legend:

- **Allowed:** Dependency belongs to the package’s responsibility.
- **Limited:** Allowed only through explicit public contracts or peer dependencies.
- **Forbidden:** Boundary violation.

## Normative matrix

| Package | Application code | UI/React | Infrastructure | Database/Prisma | Business rules | Status |
|---|---|---|---|---|---|---|
| `@erp/types` | Forbidden | Limited to UI-neutral types | Forbidden | Forbidden | Forbidden | Proposed |
| `@erp/config` | Forbidden | Forbidden | Allowed: env, service discovery, HTTP client | Forbidden | Forbidden | Proposed |
| `@erp/auth` | Forbidden | Forbidden | Allowed: JWT/middleware | Forbidden | Limited: platform/tenant role contracts | Proposed |
| `@erp/logger` | Forbidden | Forbidden | Allowed | Forbidden | Forbidden | Proposed |
| `@erp/telemetry` | Forbidden | Forbidden | Allowed | Forbidden | Forbidden | Proposed |
| `@erp/platform-core` | Forbidden | Forbidden | Limited | Forbidden | Allowed: platform roles/capabilities only | Proposed |
| `@erp/pricing` | Forbidden | Forbidden | Forbidden | Forbidden | Allowed: pure pricing rules | Proposed |
| `@erp/workflow` | Forbidden | Forbidden | Limited to pure runtime utilities | Forbidden | Allowed: domain-neutral workflow rules | Proposed |
| `@erp/extensions` | Forbidden | Limited React-neutral registry metadata | Forbidden | Forbidden | Forbidden | Proposed |
| `@erp/ui` | Forbidden | Allowed | Forbidden | Forbidden | Forbidden | Proposed |
| `@erp/ui-runtime` | Forbidden | Limited React peer/runtime rendering | Limited: extension/workflow contracts | Forbidden | Runtime rules only | Proposed |
| `@erp/admin-ui-host` | Forbidden | Allowed | Limited: UI runtime/registry | Forbidden | Limited: composition only; no domain persistence/rules | Proposed |
| `@erp/process-designer` | Forbidden | Allowed | Limited: workflow contracts | Forbidden | Forbidden | Proposed |
| `@erp/process-forms` | Forbidden | Allowed | Limited: workflow contracts | Forbidden | Forbidden | Proposed |

## Current observations

### Compliant

- Packages do not import application source.
- `@erp/workflow` does not import Sales.
- `@erp/ui-runtime` does not import Gateway, Sales, or Inventory.
- Process packages have two real hosts: Gateway and Platform.
- No package owns a Prisma client.

### Review required

1. **`@erp/types` breadth:** domain DTOs for Product, Order, Purchase Order, Invoice, and Employee should migrate toward owning service contracts.
2. **`@erp/admin-ui-host` OMS vocabulary:** Product List and Sales Order task widgets are composition assets, but the package must not accumulate business decisions. Domain-specific widgets should move to a promoted domain widget package only after two hosts consume them and ADR 0017 is satisfied.
3. **`@erp/workflow` Sales template:** `so-standard-v5.ts` is acceptable for simulation/testing but is domain material. Production seeding must remain in Sales.
4. **`@erp/process-designer` role catalog:** hardcoded OMS task roles should become host-supplied metadata.
5. **Dead dependencies:** API-only backends declaring `@erp/ui`, Customer’s unused workflow/extension dependencies, and unused process package dependencies should be removed when verified.

## Enforcement candidates

- Reject package imports matching `apps/*`.
- Reject Prisma imports and `DATABASE_URL` use in shared packages.
- Reject browser/network calls in `@erp/ui` and `@erp/process-*` except host-injected API callbacks.
- Reject domain entity imports in `@erp/ui`.
- Require two known consumers before adding a new framework-level package.
- Require dependency exceptions to reference an Accepted Decision Register entry.

## Approval workflow

1. Architect proposes matrix change.
2. Affected package owners provide static and consumer evidence.
3. Reviewer checks ADR 0017 promotion criteria.
4. Approver marks row/rule Approved.
5. Tech Lead implements and baselines the fitness rule.
6. Rule moves to Enforced only after CI passes.
