# Sankalp Product Backlog Matrix

**Last updated:** 2026-08-14 (BL-001 CI E2E workflow hardened; first GitHub green pending)  
**Purpose:** Planned and in-progress capabilities **not yet in** [`MATURITY-ASSESSMENT.md`](MATURITY-ASSESSMENT.md).  
**Maintained by:** [`.cursor/rules/product-backlog.mdc`](../.cursor/rules/product-backlog.mdc)

**Companion docs:** [MATURITY-ASSESSMENT.md](MATURITY-ASSESSMENT.md) (as-is) · [TENANT-GST-CHECKLIST.md](TENANT-GST-CHECKLIST.md) · [AR-WORKBENCH-CHECKLIST.md](AR-WORKBENCH-CHECKLIST.md) · [REMEDIATION-CHECKLIST.md](REMEDIATION-CHECKLIST.md)

---

## How this relates to the maturity matrix

| Document | Contents | Maturity score |
|----------|----------|----------------|
| **This file** | Backlog + in-progress; target behavior, acceptance, test plan | **Readiness 0–1** only (0 = idea, 1 = specced/ready to build) |
| **MATURITY-ASSESSMENT.md** | Shipped behavior with evidence | **Maturity 0–5** (implemented + tested) |

**Promotion rule:** When a backlog item is **shipped** (code + tests + evidence):

1. Add or update its row in **MATURITY-ASSESSMENT.md §3** with real maturity score and evidence.
2. Mark the backlog row **SHIPPED** (move to §6 Shipped archive) or remove it.
3. Update module checklist if applicable; bump **Last updated** on both docs.

Do **not** add planned items to the maturity matrix until promotion criteria are met.

---

## Status lifecycle

```
PLANNED → IN_PROGRESS → SHIPPED → (archived here §6)
              ↓
           BLOCKED
```

---

## 1. Executive summary

| Metric | Value |
|--------|-------|
| **Backlog items (active)** | 17 |
| **P0** | 2 |
| **P1** | 5 |
| **P2** | 10 |
| **In progress** | 1 (BL-001 CI) |
| **Blocked** | 1 (BL-003 — NIC credentials) |

**Strategic spine:** Order → Fulfil → Invoice → Collect. P0 items (CI E2E, online payments) unblock GA confidence and revenue collection.

---

## 2. Master backlog matrix

| ID | Module | Feature | Status | Priority | Target use cases | Readiness | Dependencies | Acceptance criteria | Test plan | Module checklist | Notes |
|----|--------|---------|--------|----------|------------------|-----------|--------------|---------------------|-----------|------------------|-------|
| BL-001 | Platform/QA | E2E suites in CI | IN_PROGRESS | P0 | U1 greenfield gate; U2 GST gate; U3 portal gate on PR | 1 | Running stack in CI; seed stability | [`.github/workflows/e2e-api.yml`](../.github/workflows/e2e-api.yml) runs `scripts/ci-e2e.sh` (greenfield + gst + portal + saas); fail blocks merge | CI job green; reports uploaded as artifacts | [REMEDIATION-CHECKLIST.md](REMEDIATION-CHECKLIST.md) Phase 6 | Workflow hardened 2026-08-14 (pnpm/action-setup, 64-hex vault key, serial image build, health wait, SaaS artifact). First GitHub Actions green pending push.
| BL-002 | AR/Payments | Razorpay/UPI + portal pay | PLANNED | P0 | U1 pay outstanding on portal; U2 webhook idempotent; U3 allocate to invoice | 0 | Razorpay account; gateway webhook route | Customer pays open invoice; payment recorded once; AR ageing updates | E2E: portal pay flow; webhook duplicate test | [AR-WORKBENCH-CHECKLIST.md](AR-WORKBENCH-CHECKLIST.md) P0.3 | Maturity today: 0 |
| BL-003 | GST | Production NIC IRP | BLOCKED | P1 | U1 live IRN; U2 cancel on portal; U3 PRODUCTION mode unblocked | 1 | NIC credentials; tenant `tax.nic.mode=PRODUCTION` | Real IRN/ack/QR payload from IRP; DEMO still works | Extend `e2e:gst` with PRODUCTION flag (staging creds) | [TENANT-GST-CHECKLIST.md](TENANT-GST-CHECKLIST.md) Phase B | Blocked on credentials |
| BL-004 | GST | QR image on tax invoice PDF | PLANNED | P1 | U1 QR visible after IRN SUCCESS; U2 print/PDF download | 1 | BL-003 or sandbox QR payload | PDF embeds QR from `signedQr`; readable scan | Visual/regression in `e2e:gst`; documents render test | TENANT-GST Phase B | |
| BL-005 | Security | Route auth + idempotency contract tests | PLANNED | P1 | U1 wrong-tenant 403; U2 duplicate POST no double effect | 1 | Shared auth fixtures (`@erp/auth`) | Contract tests for reserve, payment, invoice, PO receipt | New `*.route.test.ts` per critical route family | REMEDIATION Phase 2–3 | |
| BL-007 | Fulfilment/GST | E-way auto-trigger on dispatch | PLANNED | P1 | U1 interstate dispatch suggests e-way; U2 manual override | 0 | Dispatch workflow task; invoice ISSUED | Completing dispatch can invoke e-way API when applicable | `e2e:gst` + greenfield dispatch phase | TENANT-GST Phase C | Today: manual API only |
| BL-008 | GST | U4 REQUIRED IRN blocks ISSUED | PLANNED | P2 | U1 B2B invoice cannot ISSUE without IRN when REQUIRED | 1 | Existing code path | API returns 409; UI shows block; IRN then issue succeeds | New `e2e:gst` case U4 | TENANT-GST U4 | Code path exists; E2E missing |
| BL-009 | GST | U7 mixed exempt/taxable E2E | PLANNED | P2 | U1 cart with EXEMPT + TAXABLE lines; U2 correct per-line tax | 1 | Quick Bill or SO with line `taxTreatment` | Invoice lines show correct split; GSTR-1 line detail | Extend `e2e:gst` | TENANT-GST U7 | Unit tests only today |
| BL-010 | AR | Multi-invoice payment allocation | PLANNED | P2 | U1 single payment → multiple invoices; U2 unapplied cash | 0 | BL-002 optional | Allocation UI + API; ageing reflects balances | AR E2E script (new) | AR-WORKBENCH pending | |
| BL-011 | AR | Collection queue + promise-to-pay | PLANNED | P2 | U1 queue by bucket; U2 PTP note + date | 0 | AR ageing API | Worklist on `/ar`; filter overdue | Manual + API test | AR-WORKBENCH pending | |
| BL-012 | AR | Overdue status job | PLANNED | P2 | U1 invoice flips OVERDUE after due date | 0 | Scheduler/cron or workflow | Status updated; visible in ageing | Job unit test + integration | AR-WORKBENCH pending | |
| BL-013 | AR | Accountant ageing KPI widgets | PLANNED | P2 | U1 dashboard cards match `/ar` buckets | 0 | Ageing API | Dashboard widgets on `/dashboard` or analytics | Snapshot/API test | AR-WORKBENCH pending | |
| BL-014 | Sales | Sales returns E2E | PLANNED | P2 | U1 create return → approve → restock → credit note | 1 | Returns API + UI exist | Full script green on greenfield tenant | New `e2e:returns` or greenfield phase | — | API/UI exist; no E2E |
| BL-015 | Platform | Mandatory audit events | PLANNED | P2 | U1 finance/stock/security actions emit audit | 0 | Audit envelope ([REMEDIATION](REMEDIATION-CHECKLIST.md)) | Events for payment, stock, role change, export | Audit coverage tests | REMEDIATION Phase 3 | |
| BL-016 | Platform | Durable reconciliation operator UI | PLANNED | P2 | U1 partial failure visible; U2 retry succeeds | 1 | Gateway reconciliation API (foundation exists) | Operator retries failed cross-service step | E2E failure injection | REMEDIATION Phase 1 deferred | |
| BL-017 | Analytics | CSV/XLSX report exports | PLANNED | P2 | U1 export with filters; U2 audit event on export | 0 | Report ownership approval | Download from analytics panels | Export + audit test | REMEDIATION Phase 5 Tier 2 | |
| BL-018 | Integrations | Notifications in-app + FCM maturity | PLANNED | P2 | U1 list/read; U2 FCM register; U3 dead-letter visible | 0 | Notification contract version | Reliable delivery visibility | Integration tests | REMEDIATION Phase 5 | |

---

## 3. Module backlog summary

| Module | Active items | P0 | P1 | P2 | Blocked | Target quarter (indicative) |
|--------|--------------|----|----|-----|---------|----------------------------|
| Platform/QA | 3 | 1 | 0 | 2 | 0 | Q3 2026 |
| AR/Payments | 5 | 1 | 0 | 4 | 0 | Q3 2026 |
| GST | 5 | 0 | 3 | 2 | 1 | Q3–Q4 2026 |
| Security | 1 | 0 | 1 | 0 | 0 | Q3 2026 |
| Customer | 0 | 0 | 0 | 0 | 0 | — |
| Fulfilment | 1 | 0 | 1 | 0 | 0 | Q4 2026 |
| Sales | 1 | 0 | 0 | 1 | 0 | Q4 2026 |
| Integrations | 1 | 0 | 0 | 1 | 0 | Q4 2026 |

---

## 4. Priority queue (recommended build order)

1. **BL-001** — E2E in CI (protect everything else) — **in progress** (await first CI green)
2. **BL-002** — Razorpay/UPI (revenue path)
3. **BL-005** — Contract tests (security baseline)
4. **BL-003 + BL-004** — Production NIC + QR (when credentials available)
5. **BL-007** — E-way auto on dispatch
6. **BL-008, BL-009** — GST E2E gaps (U4, U7)
7. **BL-010–BL-013** — AR phase 2 slices
8. **BL-014** — Returns E2E
9. **BL-015–BL-018** — Platform hardening & analytics

---

## 5. Promotion checklist (per item)

Before moving **BL-xxx → SHIPPED**:

- [ ] Feature behavior matches **Acceptance criteria**
- [ ] **Test plan** executed (E2E or route tests added)
- [ ] Row added/updated in [MATURITY-ASSESSMENT.md §3](MATURITY-ASSESSMENT.md)
- [ ] Module checklist ticked (GST/AR/remediation as applicable)
- [ ] **Gaps** removed from maturity §10 if closed
- [ ] **Last updated** bumped on both backlog and maturity docs

---

## 6. Shipped archive

| ID | Feature | Shipped date | Maturity doc row | Evidence |
|----|---------|--------------|------------------|----------|
| BL-022 | Design System v2 (Modern Interactive) | 2026-08-13 | Platform / Design System v2 | Live Gateway/Platform/Customer/Delivery/POS on `@erp/ui`; `pnpm e2e:portal` 20/20; `pnpm e2e:saas` 25/25; [design-system.md](guides/design-system.md); ADR 0015 v2 addendum |
| BL-021 | Sankalp Free plan + feature nav + lead-window renewal + downgradeToFree | 2026-08-13 | Platform/SaaS License billing | `pnpm e2e:saas` 25/25 (includes platform POST create-plan); [`scripts/e2e-saas-billing.ts`](../scripts/e2e-saas-billing.ts); not dealer AR (BL-002) |
| BL-020 | Sankalp internal SaaS billing (BillingInvoice + DEMO pay + feature/seat gates) | 2026-08-13 | Platform/SaaS License billing | `pnpm e2e:saas` 21/21 then superseded by BL-021; not dealer AR (BL-002) |
| BL-019 | Sankalp SaaS Razorpay Subscriptions (DEMO + entitlement) | 2026-08-13 | Platform/SaaS License billing | Superseded by BL-020; `pnpm e2e:saas` was 15/15 on the old TenantSubscription ledger |
| BL-006 | Trustwood portal seed (TW-ADH-1L + ensureTrustwoodTenant) | 2026-08-13 | Inventory §3 catalog groups; Sales §3 SREQ portal | `pnpm e2e:portal` 20/20; [`seed-client-demo.ts`](../scripts/seed-client-demo.ts); `GET /api/products?sku=` |

**Recently shipped (track in maturity matrix, not here):** AR Phase 1 (ageing, credit-check, `/ar` UI) — see [MATURITY-ASSESSMENT.md §3 AR rows](MATURITY-ASSESSMENT.md).

---

## 7. Out of backlog (limitations — do not implement as gaps)

These stay in [MATURITY-ASSESSMENT.md §13](MATURITY-ASSESSMENT.md) only:

- Direct GSTR-1/3B filing to GSTN
- Multi-GSTIN per tenant (unless explicit product decision)
- Full generic workflow engine in `@erp/workflow` (Sales v5 runtime is the current scope)

---

## Maintenance

- Add new rows with next **BL-xxx** ID; never assign maturity 0–5 here — use **Readiness 0–1**.
- When starting work: set **Status** → `IN_PROGRESS`.
- When blocked: set **Status** → `BLOCKED` and note dependency in **Notes**.
