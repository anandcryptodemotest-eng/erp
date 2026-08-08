# AGR Remediation Ledger

Purpose: single ownership and acceptance record for the 16 Trustwood remediation findings. This ledger is a release-management artifact; implementation details remain in the owning code and contract documents.

| ID | Owner | Route / model surface | Severity | Acceptance test | Release train | Status |
|---|---|---|---|---|---|---|
| AGR-F001 | Accounting | Journals / `JournalEntry` | P0 | Balanced transactional journal test; tenant-scoped source idempotency test | Trustwood GA | Complete |
| AGR-F002 | Accounting | Invoice generation / `Invoice.sourceRef` | P0 | Duplicate source request returns the original invoice; unique constraint retry test | Trustwood GA | Complete |
| AGR-F003 | Accounting + HR | Payroll process/pay | P0 | Downstream Accounting failure leaves payroll retryable and uncompleted | Trustwood GA | Complete |
| AGR-F004 | Sales + Inventory + Accounting | Sales return completion | P0 | Duplicate completion does not duplicate stock or credit note | Trustwood GA | Complete |
| AGR-F005 | Procurement + Inventory + Accounting | PO receiving | P0 | AP failure leaves receipt retryable; duplicate receive is idempotent | Trustwood GA | Complete |
| AGR-F006 | Delivery + Sales | Delivery completion sync | P0 | Sales sync failure prevents terminal delivery completion | Trustwood GA | Complete |
| AGR-F007 | All services | `JWT_SECRET` / `SERVICE_SECRET` | P0 | Production startup rejects placeholders; Compose requires secrets | Trustwood GA | Complete |
| AGR-F008 | Gateway + all services | Tenant isolation | P0 | Wrong-tenant JWT and header tests return 403; report/file isolation tests pass | Trustwood GA | In progress |
| AGR-F009 | Gateway | Protected route policy | P1 | Public-route allowlist and protected-route matrix test pass | Trustwood GA | Open |
| AGR-F010 | All service owners | Cross-service contracts | P1 | Contract suite validates envelopes, headers, routes, and downstream failures | Trustwood GA | Open |
| AGR-F011 | Gateway + all service owners | Audit envelope and critical events | P1 | Finance, stock, order, membership, security, export, and file events are queryable | Trustwood GA | Open |
| AGR-F012 | Gateway + Delivery | Edge proxy and same-origin clients | P1 | Nginx/Admin/Customer/Delivery/POS proxy tests pass with auth forwarding | Trustwood GA | Open |
| AGR-F013 | All service owners | Idempotency and negative tests | P1 | Duplicate, invalid transition, timeout, and retry cases pass for critical mutations | Trustwood GA | Open |
| AGR-F014 | Platform operations | Migration, backup, rollback | P1 | Staging rehearsal records migration, restore, rollback, and recovery evidence | Trustwood GA | Open |
| AGR-F015 | Platform operations | Monitoring and alerting | P1 | Health, auth, downstream failures, reconciliation, and notification alerts fire in staging | Trustwood GA | Open |
| AGR-F016 | Engineering enablement | CI/CD validation | P1 | PR pipeline runs build, lint, typecheck, unit, contract, route, smoke, and E2E jobs | Trustwood GA | In progress |

## Status Rules

- `Complete` requires executable evidence or an explicitly referenced operational record.
- `In progress` means a partial implementation exists but the GA acceptance test is incomplete.
- `Open` blocks the release train when its severity is P0/P1 and no approved exception exists.
- Every exception must record an owner, compensating control, approval date, and expiry date in the remediation checklist.
