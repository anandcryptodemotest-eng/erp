# ERP Remediation Checklist

Updated: 2026-08-07

Scope: Trustwood release plus platform hardening. WhatsApp is deliberately excluded. POS and HR/payroll remain platform tracks outside the Trustwood client release.

## Release Classification

This checklist separates safe onboarding of paying customers from longer-term platform maturity.

- **Tier 1 — Production blockers:** Must pass before GA onboarding. Covers security, tenant isolation, financial integrity, critical auditability, contract protection, negative testing, CI/CD, migration and rollback, backup/restore, and production monitoring.
- **Tier 2 — Strongly recommended:** Complete within the first one or two releases. Covers reporting exports, advanced notifications, reconciliation operations, traces, dashboards, alerts, and SLO maturity.
- **Tier 3 — Roadmap / non-blocking:** Does not block the Trustwood GA release. Covers additional identity providers, expanded analytics, active-session features, POS/HR extraction work, and platform polish.

### GA Decision Rule

Trustwood may onboard paying customers only when every Tier 1 item is checked or has an explicitly approved, documented exception with an owner and expiry date. Tier 2 and Tier 3 items remain visible but are not release blockers.

## Phase 0: Baseline and Contracts

- [x] Record the P0 findings and implementation anchors.
- [x] **T1** Create an AGR-F001 through AGR-F016 remediation ledger with owner, route/model, severity, acceptance test, and release train in `docs/AGR-REMEDIATION-LEDGER.md`.
- [x] **T1** Freeze canonical service URLs, base paths, tenant headers, roles, statuses, envelopes, and money/date conventions in `docs/architecture/SERVICE-CONTRACT-CATALOG.md`.
- [x] Generate `docs/generated/gateway-route-manifest.json`; validate 90 Gateway rewrite targets against service route families with one intentional local catch-all.
- [x] **T1** Define service-owned contracts for Sales, Delivery, Accounting, Procurement, Inventory, Notifications, and Gateway in `docs/architecture/SERVICE-CONTRACT-CATALOG.md`.
- [x] **T1** Document atomicity, idempotency, retry, compensation, reconciliation, audit, and operator recovery expectations for every critical flow in `docs/architecture/SERVICE-CONTRACT-CATALOG.md`.

## Phase 1: P0 Integrity and Security

- [x] Fix journal account lookup and balanced transactional journal creation.
- [x] Add tenant-scoped journal idempotency.
- [x] Make invoice generation exactly once per source order with source uniqueness and retry recovery.
- [x] Make payroll process/pay fail closed on Accounting errors.
- [x] Add retry-safe sales-return restock and credit-note completion.
- [x] Add retry-safe procurement receiving and AP posting order.
- [x] Make delivery completion wait for Sales synchronization.
- [x] Enforce production secret policy, startup validation, and required Compose secrets.
- [ ] **T1** Add durable reconciliation state and operator retry UI for partial cross-service failures. **Deferred:** implement when the first production-critical cross-service flow requires operator recovery; foundation APIs and migrations remain available.
- [x] **T1** Add the durable tenant-scoped reconciliation record model, bounded operator listing, and registry-validated retry API foundation in Gateway; critical flow producers and a dedicated UI remain open.
- [x] Add a secret rotation runbook and attributable service identity documentation in `docs/guides/SECRET-ROTATION.md`.

## Phase 2: Cross-Service Reliability

- [ ] **T1** Add idempotency and duplicate-request tests for reserve, release, deduct, receive, invoices, credit/debit notes, PO receipt, payroll, and delivery completion.
- [ ] **T1** Add durable retry/reconciliation records in owning services.
- [x] **T1** Standardize correlation/request propagation and operator-visible downstream failure logging through middleware and `ServiceClient`; contract tests cover propagated request context.
- [ ] **T1** Validate Gateway delivery rewrites and Sales dispatch payloads against route contracts.
- [ ] **T1** Add Delivery FSM tests for invalid, duplicate, failed, and retry transitions.
- [ ] **T3** Move operational driver availability/current assignment ownership from HR to Delivery.
- [ ] **T3** Document Accounting POS as a bounded internal submodule and extraction triggers.

## Phase 3: Security, Tenancy, RBAC, Audit, and Files

- [ ] **T1** Centralize Gateway protected-route policy while preserving explicit public routes.
- [ ] **T1** Add route-level auth tests for tenant, platform, service-key, missing-tenant, wrong-tenant, wrong-role, validation, and downstream failures.
- [x] **T1** Add Gateway wrong-tenant and missing-auth tests for tenant-user administration using shared authenticated request fixtures.
- [x] **T1** Add Gateway wrong-tenant and missing-auth tests for tenant settings and custom-role administration routes.
- [x] Enforce JWT tenant matching on Gateway tenant details, settings, roles, and membership administration routes.
- [ ] **T1** Implement and test the fine-grained role/permission matrix.
- [x] **T1** Add the shared typed tenant permission matrix and expose effective permissions through `AuthorizationContext`; route adoption remains open.
- [x] **T1** Adopt shared permission checks in Gateway audit and reconciliation APIs with passing authorization tests.
- [ ] **T1** Enforce branch membership and branch-scoped access where applicable.
- [ ] **T1** Publish and adopt one audit envelope and action taxonomy.
- [x] **T1** Define the tenant-scoped audit envelope and persistence model in Gateway, including actor, request, correlation, entity, and metadata fields.
- [x] **T1** Add tenant-scoped audit listing with role-based access and focused authorization tests.
- [ ] **T1** Add mandatory audit events for security, membership, approvals, finance, stock, orders, returns, receiving, delivery, exports, and files.
- [ ] **T1** Add audit retention, filters, ownership, and coverage tests.
- [ ] **T1** Harden upload/download MIME, size, ownership, authorization, path, storage, malware, and retention controls.
- [ ] **T3** Keep Google/OAuth identity separate from mailbox/WhatsApp integration; implement only if approved.

## Phase 4: Channel Edge and Gateway Convergence

- [x] Move Delivery App browser calls to same-origin Gateway/BFF paths; Delivery App rewrites `/api/auth` and `/api/delivery/*` through Gateway.
- [x] Verify POS same-origin rewrites and auth forwarding without expanding Trustwood scope; POS service paths now proxy through Gateway.
- [ ] **T1** Add nginx-to-Gateway edge tests for Admin, Customer, Delivery App, and POS.
- [ ] **T1** Add authenticated proxy tests for Authorization, tenant, service headers, errors, and base paths.
- [x] Verify Customer `/_next/static/*` assets through direct Next and public nginx paths return JavaScript `200` responses after refreshing the stale Customer process.
- [x] Fix Customer React hydration mismatch caused by reading cached profile text from `localStorage` during the initial render; profile cache now loads after mount.
- [x] **T1** Add repository deployment-artifact validation for migration roots and nginx proxy contract; live nginx and authenticated edge execution remain open.
- [x] Generate and validate the route manifest locally and in CI with `pnpm routes:validate`; broader contract/E2E CI wiring remains pending.

## Phase 5: Reporting, Notifications, and Business Completeness

- [x] Harden Sales, Inventory, and Delivery report date/timezone, tenant/module, size, and envelope contracts; role access remains governed by the shared service middleware.
- [x] Add the Trustwood Analytics page with Sales, Inventory, and Delivery panels.
- [x] Add partial-failure handling and retry per Analytics panel using settled requests and independent panel retries.
- [x] Add order status, top products, stock movement/alerts, delivery status, and metric definitions to Analytics using the existing report contracts.
- [x] Add Accounting reconciliation reports for invoices, payments, journals, notes, and trial-balance consistency, exposed in the Gateway Analytics view with independent retry handling.
- [x] Add focused Accounting reconciliation route tests for tenant, date, reversed-range, and maximum-window guards.
- [ ] **T2** Add category sales, payment-method, return/cancellation, and customer lifetime reports after ownership approval.
- [ ] **T2** Add filtered CSV/XLSX exports with audit events.
- [ ] **T2** Version the Gateway notification command contract.
- [ ] **T2** Implement in-app notification list/read, FCM registration/status, retry, and dead-letter visibility.
- [ ] **T2** Define and implement scheduled-report timezone, permission, recipient, and retention rules.

## Phase 6: Tests, Observability, CI, and Release

- [ ] **T1** Add backend route-test harnesses with authenticated tenant/platform/service fixtures.
- [x] **T1** Add shared authenticated tenant, platform, and service-key request fixtures with middleware coverage in `@erp/auth`.
- [ ] **T1** Add contract tests for Sales-Inventory, Sales-Accounting, Procurement-Inventory, Procurement-Accounting, HR-Accounting, Delivery-Sales, and Gateway rewrites.
- [ ] **T1** Add negative E2E coverage for limits, invalid transitions, over-returns, duplicate retries, timeouts, partial receipt, journal failure, tenant isolation, and unauthorized actions.
- [x] Portal E2E passes 20/20.
- [x] OMS E2E passes 20/20.
- [x] Platform Admin smoke passes.
- [x] Backend and observability foundation smoke passes when the declared containers are running.
- [x] OTEL vertical-slice smoke passes when the collector is running.
- [x] Replace or update the stale self-serve-registration user-flow E2E.
- [ ] **T1** Add production monitoring, logs, health checks, and alerts for auth, downstream 5xx, reconciliation, notifications, and reports.
- [ ] **T2** Add canonical full-journey traces, reconciliation-backlog alerts, dashboards, and staging SLOs.
- [x] Run the focused Accounting reconciliation route tests in the validation workflow.
- [x] **T1** Add GitHub Actions workflow [`.github/workflows/e2e-api.yml`](../.github/workflows/e2e-api.yml) running `pnpm ci:e2e` (greenfield + gst + portal + saas) with report artifacts; first GitHub green run still required to close the gate.
- [ ] **T1** Wire architecture, typecheck, lint, unit, route, contract, smoke, and E2E tests into CI.
- [x] **T1** Wire architecture fitness validation into CI; build, lint, workspace tests, route validation, deployment artifacts, and dependency audit are also covered.
- [x] E2E journeys require the full service stack; `scripts/ci-e2e.sh` waits on postgres + all seven service `/health/live` endpoints, then seeds platform + Trustwood (Growth grant) before marathon suites.
- [x] **T1** Run every workspace's declared unit/contract test script in CI through the root `test:workspaces` command.
- [x] **T1** Run shared authentication and ServiceClient contract tests in the validation workflow.
- [ ] **T1** Add deployment migration, secret, nginx, database, and rollback smoke tests.
- [ ] **T1** Rehearse backup and restore for every production database and record recovery evidence.
- [x] **T1** Document the multi-database backup and restore procedure in `docs/guides/DATABASE-BACKUP-RESTORE.md`; staging rehearsal evidence remains required.
- [ ] **T1** Complete dependency, secret, and production-configuration security review.
- [x] **T1** Add a CI production dependency audit gate; current audit has no high or critical findings, with one low and one moderate advisory remaining for follow-up.
- [x] **T1** Upgrade Next.js to 15.5.21, patch transitive PostCSS/sharp dependencies, and upgrade shared OpenTelemetry packages to patched releases; Gateway, Customer, and Telemetry validation passes.
- [x] Reconcile stale documentation and remove unsupported “Known Gaps: none” claims from the latest E2E report; historical matrices now point to the living checklist.

## Current Validation Blockers

- [x] Full lint: run the new workspace ESLint configuration; it passes with warnings only from stale inline directives.
- [x] Add Node type declarations required by `@erp/ui` test files.
- [x] Full build: Turbo passes 25/25 with explicit non-default validation secrets; Next emits only non-fatal ESLint integration warnings.
- [ ] **T3** Legacy PowerShell E2E cannot run on this Linux host because PowerShell is unavailable; use the cross-platform E2E scripts for GA evidence.
- [ ] **T1** Observability smoke requires the Compose observability services to be started first; run it before production approval.

## Release Exit Criteria

### Tier 1 — Must Pass Before Trustwood GA

- [x] No open P0 journal, invoice, payroll, return, receiving, delivery, or secret-safety implementation finding.
- [ ] Zero open P0 test findings.
- [ ] Tenant isolation verified across API, reports, files, notifications, and exports.
- [ ] Authentication, protected-route policy, RBAC, fine-grained permissions, and branch scope are enforced and tested.
- [ ] All financial workflows are atomic, idempotent, retry-safe, compensating, and durably reconcilable.
- [ ] Gateway and service contracts are versioned or validated by contract tests.
- [ ] Critical finance, inventory, order, payment, user, and security actions are auditable and attributable.
- [ ] CI passes build, lint, typecheck, unit, contract, route, smoke, and E2E stages.
- [ ] Database migration, backup/restore, deployment, and rollback rehearsals pass.
- [ ] Production monitoring, logging, health checks, and alerting are operational.
- [ ] Dependency, secret, and production-configuration security review is complete.

### Tier 2 — Strongly Recommended Within 1–2 Releases

- [ ] CSV/XLSX exports, scheduled reports, and expanded analytics are available with audit events.
- [ ] Notification commands are versioned and notification retry/dead-letter visibility is available.
- [ ] Reconciliation dashboards expose backlog, retry history, and failure analysis.
- [ ] Traces, dashboards, alerts, and SLOs cover critical journeys.

### Tier 3 — Non-Blocking Roadmap

- [ ] Microsoft, Apple, SAML, passkeys, and other identity-provider expansion. WhatsApp OTP (Fast2SMS, per-tenant) shipped 2026-08-08 for customer + admin login; SMS OTP still open.
- [ ] Active-session management, password history, and related account polish.
- [ ] POS/HR bounded-context extraction and additional platform architecture work.
- [ ] PowerShell validation on Linux and other redundant validation tooling.

### Approved Exceptions

Record any Tier 1 exception with the risk, compensating control, owner, approval date, and expiry date. An unchecked Tier 1 item without an approved exception blocks production onboarding.
