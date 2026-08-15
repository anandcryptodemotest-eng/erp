# Sankalp Product Backlog Matrix

**Last updated:** 2026-08-15 (BL-044 SE visual lock + BL-042 trend chips SHIPPED)  
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
| **Backlog items (active)** | 19 |
| **P0** | 1 |
| **P1** | 7 |
| **P2** | 11 |
| **In progress** | 0 |
| **Blocked** | 1 (BL-003 — NIC credentials) |

**Strategic spine:** Order → Fulfil → Invoice → Collect. Next P0 is online payments (BL-002).

**Dashboard principle:** Defaults evolve; customizations persist. Charts explain; clicks operationalize.---

## 2. Master backlog matrix

| ID | Module | Feature | Status | Priority | Target use cases | Readiness | Dependencies | Acceptance criteria | Test plan | Module checklist | Notes |
|----|--------|---------|--------|----------|------------------|-----------|--------------|---------------------|-----------|------------------|-------|
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
| BL-025 | Documents | Document renderer (multi-page, Unicode, PNG) | PLANNED | P1 | U1 long invoice paginates; U2 ₹/Unicode paint; U3 PNG logo embeds | 1 | `@erp/documents` writer | Two-pass pagination, FontManager, flatten PNG; existing templates unchanged | `packages/documents` render tests | — | Not a new service. After BL-005; before GST QR. Do not merge with BL-026 (shipped). Until then PDF/HTML use ASCII `Rs.` so Helvetica does not overlap digits. Invoice **layout chrome** (B2B cards / accent header) already shipped in `seed-tax-invoice` — this BL is engine capability only. |
| BL-033 | Process Studio | Gap-driven OMS widgets | PLANNED | P2 | U1 only widgets justified by BL-032 evidence matrix | 0 | BL-032 evidence matrix | PaymentCapture / Signature / etc. only if matrix says Yes | Per-widget unit tests + form placement | — | Do not build to ADR ≈25 count |
| BL-040 | Platform / Admin UX | Order Desk phone claim/review cards | PLANNED | P1 | U1 Needs Action cards; U2 Claim/Review; U3 detail → complete | 0 | BL-039 + BL-044 (shipped) | Phone queue cards with primary actions; desktop desk unchanged | Manual + greenfield desk asserts | — | Next after BL-044; does not reopen dashboard presentation |

---

## 3. Module backlog summary

| Module | Active items | P0 | P1 | P2 | Blocked | Target quarter (indicative) |
|--------|--------------|----|----|-----|---------|----------------------------|
| Platform/QA | 2 | 0 | 0 | 2 | 0 | Q3 2026 |
| AR/Payments | 5 | 1 | 0 | 4 | 0 | Q3 2026 |
| GST | 5 | 0 | 3 | 2 | 1 | Q3–Q4 2026 |
| Security | 1 | 0 | 1 | 0 | 0 | Q3 2026 |
| Documents | 1 | 0 | 1 | 0 | 0 | Q3 2026 |
| Process Studio | 1 | 0 | 0 | 1 | 0 | Q3 2026 |
| OMS / Order Desk | 0 | 0 | 0 | 0 | 0 | — |
| Platform / Admin UX | 1 | 0 | 1 | 0 | 0 | Q3 2026 |
| Customer | 0 | 0 | 0 | 0 | 0 | — |
| Fulfilment | 1 | 0 | 1 | 0 | 0 | Q4 2026 |
| Sales | 1 | 0 | 0 | 1 | 0 | Q4 2026 |
| Integrations | 0 | 0 | 0 | 0 | 0 | — |

---

## 4. Priority queue (recommended build order)

1. **BL-040** — Order Desk phone claim/review (MA3) — next after BL-044
2. **BL-002** — Razorpay/UPI (revenue path)
3. **BL-005** — Contract tests (security baseline)
4. **BL-025** — Document renderer (multi-page, Unicode, PNG)
5. **BL-003 + BL-004** — Production NIC + QR (when credentials available)
6. **BL-007** — E-way auto on dispatch
7. **BL-008, BL-009** — GST E2E gaps (U4, U7)
8. **BL-010–BL-013** — AR phase 2 slices
9. **BL-014** — Returns E2E
10. **BL-015–BL-017** — Platform hardening & analytics
11. **BL-033** — Gap widgets only if Work Item forms prove need
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
| BL-044 | SE / Ops dashboard visual lock | 2026-08-15 | Platform Admin operational cockpit | Contextual hero; three-state My Tasks; Sales layout trend\|customers; compact KPIs; adapts viz to data density; `@erp/ui` 32/32; greenfield 187/187; [`ops-role.tsx`](../packages/ui/src/dashboard/widgets/ops-role.tsx), [`defaults.ts`](../packages/ui/src/dashboard/defaults.ts), [`dashboard/page.tsx`](../apps/gateway/src/app/(admin)/dashboard/page.tsx) |
| BL-042 | Dashboard chart time ranges (Phase B thin) | 2026-08-15 | Platform Admin operational cockpit | 7D/30D/MTD/QTD session chips on `revenue-trend` only; never mutates prefs; `@erp/ui` 32/32; greenfield 187/187; [`revenue-trend.tsx`](../packages/ui/src/dashboard/widgets/revenue-trend.tsx), `revenueTrendRangeBounds` |
| BL-043 | Ops widgets as status charts (My Tasks + pipeline) | 2026-08-15 | Platform Admin operational cockpit | Hybrid bars+Next; separate SREQ/SO; Desk `tab`/`taskStatus`/`sreqStatus`; `@erp/ui` 28/28; greenfield 186/186; [`status-bars.tsx`](../packages/ui/src/dashboard/widgets/status-bars.tsx), [`charts/hrefs.ts`](../packages/ui/src/dashboard/charts/hrefs.ts) |
| BL-041 | Role defaults + actionable charts (Phase A) | 2026-08-15 | Platform Admin operational cockpit | Curated sparse defaults; never overwrite Customize; centralized chart hrefs; click → Desk/AR/invoices; `@erp/ui` 25/25; `e2e:greenfield` 186/186; [`charts/hrefs.ts`](../packages/ui/src/dashboard/charts/hrefs.ts) |
| BL-039 | Admin mobile ops dashboard (MA3 phone) | 2026-08-15 | Platform Admin mobile operational mode (MA3) | Presentation-only order; TODAY 2×2; compact hero; CTA `--ink-inverse`; Customize under ⋮; `presentation.test` 4/4; `@erp/ui` 19/19; `e2e:greenfield` 175/175; [`presentation.ts`](../packages/ui/src/dashboard/presentation.ts) |
| BL-038 | Customer Portal UX v2 (commerce polish + compact PDP) | 2026-08-15 | Customer Portal shop/checkout | `formatPortalPrice` SSOT; deterministic media; fixed vs configure cards; Outfit; More nav; compact PDP; `pnpm e2e:portal` 20/20; [`pricing-display.test.ts`](../apps/customer/src/lib/pricing-display.test.ts) |
| BL-001 | E2E suites in CI | 2026-08-15 | Platform E2E CI gate | Local `pnpm ci:e2e` green: greenfield 175, gst 39, portal 20, saas 25, capture 24; [`.github/workflows/e2e-api.yml`](../.github/workflows/e2e-api.yml); opaque OTEL loader for Docker Next builds |
| BL-037 | Admin Mobile Operational Mode (MA3) + Customer phone polish | 2026-08-15 | Platform Admin mobile ops; Sales Order Desk UI | AdminShell `operational` &lt;768px; Process Studio hidden; Bill & Collect phone read-only; Needs action / In flight headers; Next-action glance cards; customer sticky CTAs + Trustwood shared-IP tenant |
| BL-034 | Trustwood task demo — market copy + Porter ExternalLink + domain honesty | 2026-08-15 | Process Studio Form designer | `pnpm e2e:greenfield` 169/169; warehouseId persist; payment method/UTR wired; starter rev3; [DEMO-WALKTHROUGH.md](DEMO-WALKTHROUGH.md) |
| BL-036 | Order context — checkout note + SREQ attachments → SO | 2026-08-15 | Sales Sales Request / SREQ→SO | Greenfield: SREQ attachment linked; checkout note → OrderNote; checkout file → OrderDocument; [`create-confirmed-sales-order.ts`](../apps/sales/src/lib/create-confirmed-sales-order.ts) |
| BL-035 | Order Desk Business Work Items (labels + aggregation) | 2026-08-15 | Sales Order Desk UI | Greenfield 175/175: workItems labels, Confirm Order READY, no Procurement Exception on full stock; [`so-standard.ts`](../packages/workflow/src/work-items/so-standard.ts); [`so-standard.test.ts`](../packages/workflow/src/work-items/so-standard.test.ts) |
| BL-032 | OMS starter forms v2 + upgrade-starters | 2026-08-15 | Process Studio Form designer | `pnpm e2e:greenfield` 169/169; [`starter-hash.test.ts`](../packages/workflow/src/forms/starter-hash.test.ts); [`starter-revisions.test.ts`](../packages/workflow/src/forms/starter-revisions.test.ts); SO_STANDARD template v7; Forms UI dry-run upgrade; [`BL-032-EVIDENCE-MATRIX.md`](BL-032-EVIDENCE-MATRIX.md) |
| BL-031 | ExternalLink OMS task widget (open third-party URL) | 2026-08-15 | Process Studio Form designer | [`resolve-external-link-url.test.ts`](../packages/admin-ui-host/src/widgets/resolve-external-link-url.test.ts); [`external-link.tsx`](../packages/admin-ui-host/src/widgets/external-link.tsx); catalog + `ensureOmsWidgetsRegistered` |
| BL-030 | Admin operational cockpit (TODAY attention + collect hero) | 2026-08-14 | Platform Admin operational cockpit | `pnpm e2e:greenfield` 169/169; [`ops-attention.test.ts`](../packages/ui/src/dashboard/ops-attention.test.ts); [`defaults.ts`](../packages/ui/src/dashboard/defaults.ts) ADMIN_LAYOUT |
| BL-029 | Notification platform capability (WhatsApp/Telegram/SMS/email + delivery log) | 2026-08-14 | Integrations Notifications | Gateway-hosted (ADR 0019); `@erp/notifications` command v1; DEMO/LIVE; [`dispatch.test.ts`](../packages/notifications/src/dispatch.test.ts); [`send/route.test.ts`](../apps/gateway/src/app/api/notifications/send/route.test.ts) |
| BL-018 | In-app + FCM + dead-letter visibility | 2026-08-14 | Integrations Notifications | Folded into BL-029; `GET /api/notifications/deliveries` + retry; push wraps send |
| BL-028 | Business-first Document Studio chrome | 2026-08-14 | Process Studio Document designer | Business/Power/Developer chrome; grouped tiles; Properties\|Data\|Style; renderer ignores `studio.*`; [`studio.test.ts`](../packages/document-designer/src/studio.test.ts); [ADR 0018](adr/0018-document-studio-generic-components.md) addendum |
| BL-027 | Generic Document Studio UX | 2026-08-14 | Process Studio Document designer | Design \| Data \| Preview \| Publish chrome; generic palette; optional invoice starter; guided Page→Preview; [`studio.test.ts`](../packages/document-designer/src/studio.test.ts); [ADR 0018](adr/0018-document-studio-generic-components.md) |
| BL-026 | Document Studio: reusable print widgets + simulate feed | 2026-08-14 | Process Studio Document designer | Widget refs `doc.logo/seller/buyer/lineItems/totals`; expand at render; sample/invoice simulate; tenant `brand.logo` → `seller.logoUrl`; [`print-widgets.test.ts`](../packages/documents/src/print-widgets.test.ts) |
| BL-024 | Lead-to-Cash (Quote → SO) | 2026-08-14 | Sales/CRM lead-to-order | `pnpm e2e:capture` 24/24; [`create-confirmed-sales-order.ts`](../apps/sales/src/lib/create-confirmed-sales-order.ts); [`quotes/[id]/convert`](../apps/sales/src/app/api/quotes/[id]/convert/route.ts) |
| BL-023 | Walk-in Direct SO + Fulfilment | 2026-08-14 | Sales Walk-in SO | `pnpm e2e:capture` 24/24; Sales Desk New walk-in order; Quick Bill unchanged |
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
