# Sankalp ERP — Competitive roadmap (baseline → 10/10 by flow)

**Status:** Product strategy locked · implementation baseline  
**Date:** 09 August 2026  
**Related:** `docs/TRADING-JOURNEY.md`, `docs/OMS-REQUIREMENTS.md`, `docs/TRUSTWOOD-ENTERPRISE-PROPOSAL.md`, `docs/REMEDIATION-CHECKLIST.md`, `docs/SANKALP-UI-UX-ROADMAP.md`, `docs/SANKALP-UI-UX-NOW.md` (current UI/flow only)

This document is the **full product plan**: locked thesis, the dealer order spine, baseline scores, and a **very detailed gap list per flow** to reach 10/10.

It does **not** change the execution order. Immediate engineering remains **P0.1 only** (GST + e-invoice/e-way on the existing OMS invoice path).

---

## 1. Locked thesis (do not dilute)

**Positioning**

> Sankalp ERP is a dealer-first trading operating system for Indian wholesalers — from mobile order capture to fulfilment, invoicing and collection.

**Plywood / laminate wedge**

> Measured-product pricing + dealer portal + Order Desk + fulfilment workflow + GST + collections.

**Competitive objective**

| Do not optimize for | Optimize for |
|---------------------|--------------|
| Sankalp = better Tally | Sankalp = modern trading OMS + enough accounting to operate, with Tally coexistence |
| Horizontal ERP (Odoo/SAP clone) | Vertical trading OS for Indian wholesalers |

**Overall baseline:** **6.2 / 10** vs Indian SMB ERPs (Tally, Busy, Zoho Inventory+Books, Odoo, SAP B1, Unicommerce).

**Target after P0 spine (GST → AR → UPI → WhatsApp → UI):** **~7.8 / 10**.

**10/10 overall** is only possible if every flow below is closed. That would make Sankalp a **horizontal ERP + WMS + GST product + HR suite**. That is **not** the TrustWood wedge. For each flow this doc therefore states:

- **10/10 definition** (what “best in market” means)
- **Improvements** (concrete work)
- **Thesis fit:** `SPINE` (P0 loop) · `TRADING OS` (deepen Order → Fulfil → Invoice → Collect) · `PLATFORM` (SaaS/security) · `OUT OF THESIS` (do not chase unless a named vertical pays for it)

---

## 2. Scoring rubric

Scores are **relative to a modern Indian SMB ERP buyer**, not SAP S/4.

| Score | Meaning |
|------:|---------|
| 1–3 | Placeholder / foundation only; cannot sell this flow |
| 4–5 | APIs or thin UI; buyer will ask “where is the real screen?” |
| 6–7 | Usable for TrustWood-shaped trading; gaps vs Tally/Zoho/Unicommerce |
| 8–9 | Competitive or ahead on this wedge; remaining gaps are polish or niche |
| 10 | Best-in-class vs the named benchmark for that flow |

**10/10 on Accounting** = Tally/BC books depth. **10/10 on OMS** = Unicommerce-class channel desk **or** a flawless B2B trading desk. Sankalp’s 10/10 OMS target is the **latter** (dealer + Order Desk), not marketplace OMS.

---

## 3. Winning spine (architecture, not modules)

Measured qty + ₹/sq ft and stock reserve happen on the **dealer portal / SREQ**. Order Desk **Convert** creates the **SO first**. Then **parallel prep** runs on that SO. Dispatch is after the prep gate. Tax invoice (P0.1) is after fulfil.

```
Dealer PWA (measured qty + ₹/sq ft)
  → SREQ (+ stock reserve)
  → Order Desk Inbox → Convert (commercial yes)
  → Sales Order
  → Parallel prep (sales review / pricing check / inventory check / warehouse ready)
  → Prep gate → Dispatch / Deliver
  → Tax Invoice
       ├── GST calculation
       ├── HSN / GSTIN
       ├── NIC e-invoice → IRN
       ├── QR
       └── E-way bill
            ↓
           AR → Payment → Allocation → Outstanding → Ageing → Collection
```

P0.1–P0.5 must **attach to this spine**. No standalone GST app, no standalone AR screen, no orphan payment widget.

**P0 execution order (locked)**

| Pri | Capability | Why |
|-----|------------|-----|
| P0.1 | GST + e-invoice / e-way on existing invoice | Biggest deal blocker |
| P0.2 | AR as OMS continuation + credit block | Credible to owners/accountants |
| P0.3 | Razorpay / UPI into same payment/AR | Actual collection |
| P0.4 | WhatsApp Business on same events | Sticky lifecycle |
| P0.5 | UI consistency | Demo conversion |

**Immediate engineering:** **P0.1 only.** Start from `generateInvoice`, `Invoice` / `InvoiceLine.hsn`, tax-invoice renderer, `Customer.taxId`, product HSN, dispatch — not a new GST module.

---

## 4. Baseline scorecard

| Flow | Score | Thesis fit of closing to 10/10 |
|------|------:|--------------------------------|
| Auth / multi-tenant / licensing | **7.5** | PLATFORM |
| Nav + dashboards + Order Desk | **7.0** | TRADING OS + P0.5 |
| Catalog + measured pricing | **7.5** | TRADING OS |
| Sales / OMS | **7.0** | TRADING OS |
| Inventory / warehouses / BOM | **5.5** | TRADING OS (BOM mostly OUT) |
| Pricing / GST on documents | **6.5** | **SPINE P0.1** |
| Procurement | **5.5** | TRADING OS |
| Accounting / invoices / AR | **4.5** | **SPINE P0.2** (full books OUT) |
| Delivery / field app | **5.5** | TRADING OS |
| Customer portal | **7.5** | TRADING OS + P0.3/P0.4 |
| WhatsApp / communication | **6.0** | **SPINE P0.4** |
| HR / payroll | **3.0** | OUT OF THESIS (Simhapuri track) |
| Process Studio | **7.0** | PLATFORM / TRADING OS |
| Analytics | **5.0** | TRADING OS |
| Platform operator | **7.0** | PLATFORM |
| Integrations | **3.5** | **SPINE** (GST/pay/WA) + coexist |

---

## 5. Per-flow plan: baseline → 10/10

---

### 5.1 Auth / multi-tenant / licensing — **7.5 → 10**

**Why 7.5:** Real SaaS: tenants, `ModuleLicense`, JWT modules + capabilities, password (Argon2id), Google, WhatsApp OTP, invitations, tenant switch, platform operators. Ahead of Tally. Behind Zoho/BC on SSO/MFA/SCIM.

**10/10 benchmark:** Zoho One / Microsoft Entra + BC security: SSO, MFA, SCIM, device sessions, fine-grained RBAC, branch isolation, audit completeness.

**Built today**

- Gateway identity: password, Google, Fast2SMS OTP, refresh/logout, forgot/reset
- `Tenant`, `TenantUser`, `TenantDomain`, `TenantCapability`, `Branch` / `UserBranch`
- Roles as strings; custom list in `oms.roles`
- Audit model exists; coverage incomplete
- Permission **types** exist; route adoption incomplete (`docs/REMEDIATION-CHECKLIST.md`)

**Key paths:** `apps/gateway/prisma/schema.prisma`, `apps/gateway/src/app/api/auth/`, `apps/gateway/src/lib/nav-access.ts`, `packages/auth/`, `packages/platform-core/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| A1 | Adopt typed permission matrix on **all** mutate APIs (orders, stock, invoices, users) | PLATFORM |
| A2 | Enforce **branch-scoped** queries (today schema exists, auth does not) | PLATFORM |
| A3 | MFA (TOTP) for ADMIN / ACCOUNTANT / SUPER_ADMIN | PLATFORM |
| A4 | SSO: SAML / OIDC (Azure AD, Google Workspace) — schema has PASSKEY enum only | PLATFORM |
| A5 | Passkeys (WebAuthn) for portal + admin | PLATFORM |
| A6 | Session device list + remote revoke UI | PLATFORM |
| A7 | SCIM / just-in-time user provision from IdP | OUT OF THESIS until enterprise RFP |
| A8 | License billing: plan catalog, seats, dunning (Stripe/Razorpay subscriptions) | PLATFORM (SaaS, not TrustWood GA) |
| A9 | Mandatory audit events: login, role change, credit block, invoice issue, stock adjust, export | PLATFORM |
| A10 | Audit retention, export, tamper-evident hash chain | PLATFORM |
| A11 | Self-serve tenant signup with trial license (today locked unless `ALLOW_SELF_SERVE_TENANT`) | PLATFORM |
| A12 | Per-field ACL (hide cost from SALES_EXECUTIVE) | TRADING OS |

**Realistic thesis target:** **9.0** after A1–A3, A6, A9 (not full SCIM/SAML unless a deal requires it).

---

### 5.2 Nav + dashboards + Order Desk — **7.0 → 10**

**Why 7.0:** Role-gated nav (`order_desk` canonical), role dashboards, Order Desk SREQ → SO → parallel tasks is a real differentiator vs Tally. Dashboards are attention widgets, not BI. Save-layout can empty the board (server registry). UI chrome uneven vs Desk.

**10/10 benchmark:** A trading desk as clear as Unicommerce’s order console **for B2B**, plus a role home as clear as Zoho CRM home: zero empty states after save, SLA badges, one visual language.

**Built today**

- `nav-access.ts` matrix; layout filters via `canAccessModule` only
- Dashboard engine + `roleDefaultConfig`; BFF `/api/dashboard/ops-summary`
- Order Desk `/sales-desk`; `/oms` redirect; deep link `?sreqId=` / `?salesOrderId=`
- Workspace hero / stage rail CSS in progress (may not be rebuilt on gateway yet)

**Key paths:** `apps/gateway/src/lib/nav-access.ts`, `apps/gateway/src/app/(admin)/sales-desk/`, `apps/gateway/src/app/(admin)/dashboard/`, `packages/ui/src/dashboard/`, `apps/gateway/src/app/api/dashboard/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| N1 | Fix dashboard save/reload (register widgets on server; empty pref → role default) | **P0.5** |
| N2 | Rebuild/redeploy gateway so theme + hero + stage rail are live | **P0.5** |
| N3 | One chrome: Dashboard, Order Desk, AR ageing, GST invoice status (same hero, chips, empty states) | **P0.5** |
| N4 | Order Desk SLA: due-at, overdue filter default, badge on nav | TRADING OS |
| N5 | Inbox unread / new SREQ count on sidebar | TRADING OS |
| N6 | Desk keyboard: j/k queue, convert confirm, claim task | TRADING OS |
| N7 | Saved desk filters per role | TRADING OS |
| N8 | Multi-branch desk queue (after A2) | TRADING OS |
| N9 | Dashboard click-through always lands on the right Desk tab + document | TRADING OS |
| N10 | No “Sales Desk” leftover copy; Order Desk everywhere | P0.5 |
| N11 | Mobile admin desk (responsive or Capacitor) | P2 |
| N12 | Kanban + calendar views of tasks | P2 / optional |

**Realistic thesis target:** **9.0** after N1–N6 + P0.5. Kanban/calendar is not required for 9.

---

### 5.3 Catalog + measured pricing — **7.5 → 10**

**Why 7.5:** Vertical win: SIMPLE/VARIANT, attributes, plywood templates, ₹/sq ft / area / weight, price lists, HSN on product, brands/categories. No serial/lot, no S3, kits/BOM unused, no multi-language.

**10/10 benchmark:** Best measured-goods PIM for Indian sheet/steel/tile wholesalers: contract price lists, lots, images CDN, import/export, portal groups, tax-complete SKUs.

**Built today**

- Products, variants, categories (tree + default HSN), brands, attribute defs + index, price lists
- `@erp/pricing`: PER_EACH, PER_AREA, PER_WEIGHT, PER_VOLUME
- Tax suggest / approval workflow on products
- Local `/uploads` images only

**Key paths:** `apps/inventory/`, `packages/pricing/`, `apps/gateway/src/app/(admin)/products/`, `docs/guides/pricing-engine.md`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| C1 | Require HSN + tax approval before SKU is sellable on portal (feeds P0.1) | **SPINE** |
| C2 | Customer-specific / group price lists + effective date + expiry | TRADING OS |
| C3 | Contract / slab pricing (qty breaks already on PriceListItem — expose fully in UI) | TRADING OS |
| C4 | Image CDN (S3/R2), multiple images, alt text | TRADING OS (`OMS-REQUIREMENTS` blob) |
| C5 | Excel import/export of catalog + price lists with validation report | TRADING OS |
| C6 | Lot / batch / expiry (optional per category) | TRADING OS if plywood moisture/lot matters |
| C7 | Serial numbers | OUT unless hardware vertical |
| C8 | KIT / BUNDLE explode (schema reserved) | OUT unless kit SKUs sell |
| C9 | Multi-language catalog | OUT until export dealers |
| C10 | Marketplace category mapping | OUT (Unicommerce territory) |
| C11 | FORMULA / CUSTOM pricing strategies (stubbed) | TRADING OS later |
| C12 | Tax-inclusive vs exclusive toggle per tenant, consistent on portal + invoice | **SPINE** |
| C13 | Margin preview on product editor (needs cost — see inventory) | TRADING OS |

**Realistic thesis target:** **9.0** after C1–C5, C12. Lots only if TrustWood asks.

---

### 5.4 Sales / OMS — **7.0 → 10**

**Why 7.0:** SREQ → convert → SO + parallel prep + returns APIs + customers (creditLimit, priceListId, block) is strong. CRM exists but hidden. No payment capture, credit block not enforced on convert, E2E OMS not fully green.

**10/10 benchmark:** Flawless B2B OMS: credit check at convert, amendment, backorder, returns-to-credit-note, audit trail, SLA, no seed/E2E failures.

**Built today**

- SREQ CRUD + convert; checkout → SREQ
- SO lifecycle + workflow tasks (`oms_trading` v3)
- Customers, addresses, wallet foundation, returns APIs
- Quotes / leads / opportunities APIs (hidden from trading nav)
- `creditLimit` on customer; enforcement incomplete vs ARCHITECTURE.md

**Key paths:** `apps/sales/`, `apps/gateway/src/app/(admin)/sales-desk/`, `docs/TRADING-JOURNEY.md`, `docs/SALES-BLUEPRINT.md`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| S1 | Enforce credit limit + block at **Convert** and at portal checkout (uses P0.2 AR outstanding) | **SPINE P0.2** |
| S2 | SO amendment after confirm (qty/price) with stock re-reserve + audit | TRADING OS |
| S3 | Partial convert / split SREQ (backorder remainder) | TRADING OS |
| S4 | Sales return → credit note → AR (close the loop with P0.2) | TRADING OS |
| S5 | Make E2E OMS green (seed Adhesive SKU + tax/conversion/tracking) | TRADING OS |
| S6 | Activity timeline on customer (CALL/EMAIL/MEETING model exists, no API) | P2 CRM |
| S7 | Quote PDF → accept → SREQ (productize hidden CRM) | P2 if sales team pays |
| S8 | Payment terms on customer + due date on invoice | **SPINE P0.2** |
| S9 | Order documents pack: SO confirmation, challan (shares GSTIN/QR with P0.1) | TRADING OS |
| S10 | Multi-warehouse ATP on convert | TRADING OS (after warehouses UI) |
| S11 | Channel orders (Amazon/Flipkart) | OUT |

**Realistic thesis target:** **9.0** after S1–S5, S8–S9.

---

### 5.5 Inventory / warehouses / BOM — **5.5 → 10**

**Why 5.5:** Reserve/release/deduct/receive/transfer APIs work and OMS uses them. No first-class warehouses admin UI, costing v1 MANUAL only, BOM models unused, no WMS/bins/cycle count.

**10/10 benchmark:** SAP B1/BC warehouse + costing **or** Unicommerce WMS. For Sankalp thesis, 10/10 **trading inventory** = multi-warehouse UI, WAC/LAST_PURCHASE, low-stock → PO, cycle count — not bin-level WMS.

**Built today**

- `Warehouse`, `WarehouseStock`, movements, reservations
- Implicit “Main Warehouse”
- `costingMethod` enum; UI “Coming Soon” except MANUAL
- `BOM` / `BOMLine` Prisma only — no API/UI

**Key paths:** `apps/inventory/src/app/api/stock/`, `docs/guides/inventory-costing.md`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| I1 | Warehouses admin screen (CRUD, default, branch link) | TRADING OS P1 |
| I2 | Stock transfer UI + print | TRADING OS P1 |
| I3 | LAST_PURCHASE costing on GRN | TRADING OS P1 |
| I4 | WEIGHTED_AVERAGE costing | TRADING OS P1 |
| I5 | FIFO layers | OUT unless auditor demands |
| I6 | Low-stock → suggested PO workbench (uses procurement) | TRADING OS P1 |
| I7 | Cycle count / stock take | TRADING OS |
| I8 | Bin / location / putaway | OUT (WMS) |
| I9 | BOM explode + kit issue | OUT unless kits |
| I10 | Negative stock policy per warehouse | TRADING OS |
| I11 | Stock ageing / dead stock report | TRADING OS (analytics) |
| I12 | Idempotency tests for reserve/release/deduct/receive (remediation T1) | PLATFORM |

**Realistic thesis target:** **8.5** after I1–I4, I6–I7, I10–I12. True 10/10 is WMS+FIFO+BOM — out of thesis.

---

### 5.6 Pricing / GST on documents — **6.5 → 10**  ★ P0.1

**Why 6.5:** Commercial pricing engine is strong. Document GST is incomplete: HSN on products/lines, `Customer.taxId`, invoice template GSTIN bindings, **no** NIC IRN/QR, e-way, GSTR-1, GSTIN master validation.

**10/10 benchmark:** Tally/ClearTax/Busy India localization: GSTIN validation, GSTR-1/3B, e-invoice IRN+QR, e-way, multi-GSTIN, TDS/TCS.

**Thesis 10/10:** Not full GSTR-3B filing product. **Invoice from SO is statutory-complete** and GSTR-1 extract + e-way from dispatch exist. 3B/TDS can stay Tally coexist.

**Built today**

- `@erp/pricing` + `/api/pricing/quote`
- `InvoiceLine.hsn`, product `hsnCode` / `hsnConfidence`, tax-suggest
- `generateInvoice` from SO; PDF via `@erp/documents` (`seller.gstin`, `buyer.gstin`)
- Buyer GSTIN ≈ `Customer.taxId` (not validated)
- Global `TAX_RATE` env still a fallback in places

**Key paths:** `apps/accounting/src/lib/generate-invoice.ts`, `apps/accounting/prisma/schema.prisma`, `packages/documents/src/seed-tax-invoice.ts`, `apps/inventory/src/lib/tax-resolution.ts`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| G1 | Tenant GSTIN master (legal name, address, state code, LUT) | **P0.1** |
| G2 | Validate / store customer GSTIN (checksum, state) on `Customer.taxId` | **P0.1** |
| G3 | At `generateInvoice`: copy HSN + tax breakup (CGST/SGST/IGST) onto lines | **P0.1** |
| G4 | Place of supply vs ship-to vs bill-to (intra vs inter) | **P0.1** |
| G5 | NIC e-invoice: IRN, ack no/date on **same** `Invoice` row | **P0.1** |
| G6 | QR on tax-invoice PDF (same template, not new doc type) | **P0.1** |
| G7 | E-way: generate/cancel from dispatch/deliver, store e-way no on invoice/SO | **P0.1** |
| G8 | Cancel/amend IRN rules (credit note linkage) | **P0.1** / TRADING OS |
| G9 | GSTR-1 extract (JSON/CSV) from OMS invoices | **P0.1** or immediate follow |
| G10 | GSTR-3B / ITC / GSTN push filing | OUT → Tally coexist |
| G11 | TDS/TCS | OUT → Tally |
| G12 | Multi-GSTIN / multi-state branches | TRADING OS after A2 |
| G13 | Remove silent `TAX_RATE` env fallback on trading path | **P0.1** |
| G14 | Sandbox + production NIC credentials per tenant (Integrations UI) | **P0.1** |

**Do not:** new `GstDocument` table, new GST microservice, duplicate invoice.

**Realistic thesis target:** **9.0** after G1–G9, G13–G14. Full 10/10 = ClearTax replacement (G10–G11) — out of thesis.

---

### 5.7 Procurement — **5.5 → 10**

**Why 5.5:** Vendor + PO + receive + AP + purchase returns + ProductVendor + wa.me RFQ. No 3-way match UI, no vendor portal, RFQ not real WhatsApp send, no landed cost.

**10/10 benchmark:** SAP B1/Odoo Purchase: RFQ, blanket PO, 3-way match, landed cost, vendor portal.

**Thesis 10/10:** Enough to refill plywood stock from Order Desk shortage: RFQ on WhatsApp, PO, GRN, AP, 3-way match lite, auto-suggest from low stock.

**Key paths:** `apps/procurement/`, `apps/gateway/src/app/(admin)/vendors/`, `purchase-orders/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| P1 | WhatsApp RFQ send via Fast2SMS (not only wa.me) | **SPINE P0.4** + TRADING OS |
| P2 | Low-stock → draft PO (from I6) | TRADING OS P1 |
| P3 | 3-way match screen: PO vs GRN vs AP invoice | TRADING OS |
| P4 | Landed cost (freight/duty) into stock cost | TRADING OS (needs I3/I4) |
| P5 | Blanket / rate contract PO | P2 |
| P6 | Vendor portal (confirm PO, ASN) | P2 / OUT |
| P7 | Approval via Process Studio rules (not role string only) | TRADING OS |
| P8 | Purchase return → debit note → AP (mirror sales return) | TRADING OS |
| P9 | Vendor GSTIN + e-invoice inward (2B) | OUT / Tally |

**Realistic thesis target:** **8.0** after P1–P4, P7–P8.

---

### 5.8 Accounting / invoices / AR — **4.5 → 10**  ★ P0.2

**Why 4.5:** Operational glue: CoA, journals, AR/AP invoices, payments, CN/DN, PDF, rec report API. Almost no accountant UI (no ageing, allocation, bank rec, P&L/BS screens). Not a books product.

**10/10 benchmark:** Tally / Zoho Books / BC: full GL, bank rec, GST returns, P&L/BS, assets.

**Thesis 10/10:** **Not** beating Tally. 10/10 *for Sankalp* = OMS money loop is complete and visible:

`SO → Invoice → Payment → Allocation → Outstanding → Ageing → Collection`

plus credit block for sales. Statutory books remain **Tally export**.

**Built today**

- `Invoice` (`sourceRef` = SO id), `InvoiceLine`, `Payment`, journals, rec report
- Admin `/invoices` list; generate from SO
- `paidAmount` / status on invoice; allocation model is 1 payment : 1 invoice (no split allocation UI)

**Key paths:** `apps/accounting/`, `apps/gateway/src/app/(admin)/invoices/page.tsx`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| R1 | AR workbench: outstanding, ageing buckets (0–30/31–60/61–90/90+), drill to SO/SREQ/dealer | **P0.2** |
| R2 | Payment allocation (partial, multi-invoice, unapplied cash) | **P0.2** |
| R3 | Collection queue + promise-to-pay notes | **P0.2** |
| R4 | Credit exposure on customer + **block convert/checkout** | **P0.2** |
| R5 | Due dates from payment terms (S8) | **P0.2** |
| R6 | CN/DN UI linked to returns and IRN cancel (G8) | TRADING OS |
| R7 | Simple P&L / trial balance **read** screens from existing journals | Optional TRADING OS — do not expand CoA |
| R8 | Bank rec / cheque / UPI settlement ledger | OUT → Tally |
| R9 | Fixed assets / depreciation | OUT |
| R10 | Multi-currency | OUT |
| R11 | Tally XML / Zoho Books export of invoices+payments | **P1 coexist** |
| R12 | Accountant role dashboard widgets = ageing + collections (not generic revenue) | **P0.2 + P0.5** |

**Realistic thesis target:** **8.5** after R1–R6, R11–R12. True 10/10 books = OUT OF THESIS.

---

### 5.9 Delivery / field app — **5.5 → 10**

**Why 5.5:** Zones, assignment FSM, GPS points, earnings, delivery-app, Porter deep-link. No aggregator APIs, weak live map, no POD photos as first-class, web-only driver app.

**10/10 benchmark:** Shiprocket/Delhivery console + native driver app + customer live map.

**Thesis 10/10:** Own-fleet + Porter for plywood: assignment from Order Desk, e-way on dispatch (G7), POD, customer tracking link, Capacitor driver app.

**Key paths:** `apps/delivery/`, `apps/delivery-app/`, Order Desk dispatch, Porter settings

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| D1 | E-way trigger on DISPATCHED / DELIVERED (P0.1) | **SPINE** |
| D2 | Admin assignments + zone UI (APIs ahead of screens) | TRADING OS |
| D3 | POD: photo + signature stored (S3) | TRADING OS |
| D4 | Customer live tracking link (portal + WA) | TRADING OS + P0.4 |
| D5 | Capacitor delivery app (store) | P1 commercial |
| D6 | COD settlement vs AR (link to P0.2) | TRADING OS |
| D7 | Route optimization | OUT |
| D8 | Shiprocket / Delhivery API | P2 if own-fleet fails |
| D9 | Move driver availability off HR onto Delivery (remediation T3) | PLATFORM |

**Realistic thesis target:** **8.0** after D1–D6, D9.

---

### 5.10 Customer portal — **7.5 → 10**

**Why 7.5:** PWA dealer centre is commercially “complete”: browse, measured PDP, cart, checkout → SREQ, orders timeline, OTP/Google, messenger. No real UPI collect, native apps in progress, wallet thin, E2E checkout recently FAIL.

**10/10 benchmark:** Best B2B dealer app in category: pay invoice, WA status, credit visible, store listing, offline catalog.

**Key paths:** `apps/customer/`, `apps/gateway/src/app/api/portal/`, `docs/guides/customer-portal-bff.md`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| U1 | Pay outstanding invoice (Razorpay/UPI) → AR allocation | **P0.3** |
| U2 | Show credit limit / outstanding on home | **P0.2** |
| U3 | Invoice PDF with IRN/QR | **P0.1** |
| U4 | WA-deep link into same conversation | **P0.4** |
| U5 | Capacitor Play/App Store | P1 commercial |
| U6 | Fix E2E checkout (seed + tax) | TRADING OS |
| U7 | Reorder + saved lists / frequent SKUs | TRADING OS |
| U8 | Offline catalog (PWA) | TRADING OS |
| U9 | Wishlist / reviews | OUT (B2C) |
| U10 | Multi-storefront CMS | OUT |
| U11 | Wallet top-up with UPI | P2 |

**Realistic thesis target:** **9.0** after U1–U8.

---

### 5.11 WhatsApp / communication — **6.0 → 10**  ★ P0.4

**Why 6.0:** In-app messenger is real. Fast2SMS OTP is live. Business WA (order status, two-way linked to thread, catalogue, vendor RFQ send) still in-progress / wa.me.

**10/10 benchmark:** Interakt/Wati/Zoho: template library, commerce catalog, shared inbox, automation, DLR analytics.

**Thesis 10/10:** Every spine event has a template; replies land on the same SREQ/SO thread; RFQ send works. Not a full WA CRM suite.

**Key paths:** `apps/gateway/src/app/api/communication/`, `apps/gateway/src/app/api/integrations/whatsapp/`, `packages/communication/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| W1 | Templates: SREQ opened, converted, dispatched, invoiced (IRN), payment due/received | **P0.4** |
| W2 | Two-way WA ↔ in-app Messages, keyed by SREQ/SO/INV | **P0.4** |
| W3 | Vendor RFQ session send (replace wa.me-only) | **P0.4** |
| W4 | Catalogue / offer templates (TrustWood commercial) | TRADING OS |
| W5 | DLR dashboard in Integrations | TRADING OS |
| W6 | Opt-in / DND / 24h window handling | **P0.4** |
| W7 | Broadcast campaigns | OUT (marketing cloud) |
| W8 | WhatsApp Commerce catalog sync | P2 |
| W9 | Email transactional (invoice, OTP fallback) | TRADING OS |

**Realistic thesis target:** **9.0** after W1–W6, W9.

---

### 5.12 HR / payroll — **3.0 → 10**

**Why 3.0:** Employee, payroll DRAFT/PROCESSED/PAID, payslips, leave FSM, journals. Hidden from trading nav. Out of TrustWood GA. Delivery-exec fields still on employee.

**10/10 benchmark:** Zoho People / Keka / SAP HCM India: attendance, PF/ESI/PT, Form 16, ESS, recruitment.

**Thesis:** Do **not** take HR to 10/10 on the TrustWood wedge. Keep Simhapuri / separate track.

#### Improvements to 10/10 (only if a named HR deal)

| # | Work | Fit |
|---|------|-----|
| H1 | Move delivery-exec ownership to Delivery service | PLATFORM (helps OMS) |
| H2 | Attendance / shifts / OT | OUT OF THESIS |
| H3 | PF / ESI / PT / PT challans | OUT |
| H4 | Salary structures + ESS portal | OUT |
| H5 | Recruitment / onboarding / exit | OUT |
| H6 | Form 16 | OUT |

**Realistic thesis target:** leave at **~3–4**; only H1 on the trading OS path. Do not score overall product on HR 10/10.

---

### 5.13 Process Studio — **7.0 → 10**

**Why 7.0:** Real designer (workflows, forms, document canvas) + OMS runtime. Hub still marks Rules / Notifications / Numbering / template library as soon. No timers/SLA connectors.

**10/10 benchmark:** Odoo Studio / Power Automate / BC AL: rules engine, notifications, connectors, versioning, tenant template library.

**Thesis 10/10:** Trading tenants can clone `oms_trading`, add a prep step, change invoice form, without code.

**Key paths:** `packages/workflow/`, `process-designer/`, `process-forms/`, `document-designer/`, `apps/gateway/src/app/(admin)/workflows/`, `configuration/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| PS1 | Platform → tenant **process pack clone** (`oms_trading` + invoice template) | TRADING OS |
| PS2 | Rules: credit block, auto-PO on shortage (declarative) | TRADING OS |
| PS3 | Notification hooks → WhatsApp/email (feeds P0.4) | **SPINE** |
| PS4 | Numbering series (SREQ/SO/INV/E-way) per tenant/FY | TRADING OS + P0.1 |
| PS5 | SLA timers on workflow tasks | TRADING OS |
| PS6 | Template library UI (grocery vs trading) | PLATFORM |
| PS7 | External HTTP connectors / RPA | OUT |
| PS8 | AI step summaries | P2 |

**Realistic thesis target:** **9.0** after PS1–PS6.

---

### 5.14 Analytics — **5.0 → 10**

**Why 5.0:** Sales/stock/delivery/rec APIs + admin `/analytics` + role KPI widgets. No GST MIS, AR ageing, P&L, scheduled export, salesperson targets.

**10/10 benchmark:** Tally MIS + Zoho Analytics: ageing, GST, P&L, scheduled PDF/XLS, targets.

**Thesis 10/10:** Ops + money + GST extracts for the trading loop — not a BI platform.

**Key paths:** `apps/gateway/src/app/(admin)/analytics/`, `apps/*/src/app/api/reports/`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| AN1 | AR ageing + collection dashboard (same as R1) | **P0.2** |
| AN2 | GST summary / GSTR-1 preview (from G9) | **P0.1** |
| AN3 | CSV/XLS export on every report | P1 |
| AN4 | Date-range + branch filters everywhere | TRADING OS |
| AN5 | Salesperson / executive throughput (SREQ convert time, task SLA) | TRADING OS |
| AN6 | Margin report (needs costing I3/I4) | TRADING OS |
| AN7 | Scheduled email/WA of ageing to Anu | P0.4 + P0.2 |
| AN8 | Power BI / Metabase semantic layer | OUT |
| AN9 | Full P&L/BS designer | OUT → Tally |

**Realistic thesis target:** **8.5** after AN1–AN7.

---

### 5.15 Platform operator — **7.0 → 10**

**Why 7.0:** Real control plane: provision, licenses, domains, capabilities, audit, health. No tenant billing, usage metering, reseller, per-tenant DB isolation.

**10/10 benchmark:** Odoo.sh / Salesforce org management: billing, sandbox copy, usage, white-label.

**Key paths:** `apps/platform/`, `apps/gateway/src/app/api/platform/`, `docs/guides/platform-admin.md`

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| PL1 | Tenant plan + Razorpay subscription billing | PLATFORM |
| PL2 | Usage metering (SREQ count, WA messages, e-invoice calls) | PLATFORM |
| PL3 | Sandbox tenant clone | PLATFORM |
| PL4 | White-label (logo, domain — partially via TenantDomain) | PLATFORM |
| PL5 | Reseller / partner hierarchy | OUT until channel sales |
| PL6 | Per-tenant DB (today shared PG + tenantId) | OUT until scale/compliance RFP |
| PL7 | Operator SLO dashboards (obs profile already exists) | PLATFORM |

**Realistic thesis target:** **8.5** after PL1–PL4, PL7. Does not block TrustWood P0.

---

### 5.16 Integrations — **3.5 → 10**  ★ P0.1 / P0.3 / P0.4 / P1

**Why 3.5:** Fast2SMS + Google + FCM + Porter URL. Missing payments, GSTN/NIC, Tally export, couriers, S3, transactional email.

**10/10 benchmark:** Zoho/Odoo connector marketplace. Thesis 10/10 = **spine connectors + Tally coexist**, not 50 apps.

#### Improvements to 10/10

| # | Work | Fit |
|---|------|-----|
| X1 | NIC e-invoice + e-way (per-tenant keys) | **P0.1** |
| X2 | Razorpay / UPI + webhooks | **P0.3** |
| X3 | Fast2SMS session/templates for lifecycle (beyond OTP) | **P0.4** |
| X4 | S3/R2 for PDFs, POD, catalog images | TRADING OS |
| X5 | Tally XML / Zoho Books export | **P1** |
| X6 | Transactional email (SES/Postmark) | TRADING OS |
| X7 | GSTN GSTR push | OUT → Tally/ClearTax |
| X8 | Shiprocket/Delhivery | P2 |
| X9 | Meta Cloud API / Interakt | OUT if Fast2SMS covers |
| X10 | Bank statement import | OUT → Tally |

**Realistic thesis target:** **8.5** after X1–X6.

---

## 6. How scores move if we only do the locked spine

| Flow | Now | After P0.1–P0.5 only (est.) |
|------|----:|----------------------------:|
| Pricing / GST on documents | 6.5 | **8.5–9.0** |
| Accounting / invoices / AR | 4.5 | **7.5–8.5** |
| Integrations | 3.5 | **6.5–7.5** |
| WhatsApp / communication | 6.0 | **8.0–8.5** |
| Customer portal | 7.5 | **8.5** |
| Nav + dashboards + Order Desk | 7.0 | **8.0** |
| Sales / OMS | 7.0 | **8.0** (credit block) |
| Delivery | 5.5 | **6.5** (e-way + tracking link) |
| Analytics | 5.0 | **7.0** |
| Others | ~same | unchanged |
| **Overall** | **6.2** | **~7.8** |

Closing every 10/10 row in §5 would push overall toward **~9+** and would **break the thesis** (full Tally + WMS + HR + marketplace). Do not schedule that.

---

## 7. Execution sequence (locked)

1. **P0.1 GST** on `generateInvoice` + tax-invoice PDF + dispatch e-way — **only this next**
2. **P0.2 AR workbench** on the **same** `Invoice` (ageing, allocation, credit block)
3. **P0.3 Razorpay/UPI** posting into that payment/allocation
4. **P0.4 WhatsApp** templates on SREQ/SO/INV/pay events
5. **P0.5 UI** one chrome; fix dashboard save; rebuild gateway
6. **P1** Tally export, warehouses+costing, native apps, report CSV
7. **P2 / OUT** CRM productization, couriers, BOM/WMS, HR 10/10, GSTR-3B filing product

---

## 8. Use case reminder (Agarwal Ply)

Ravi (dealer) measures 8×4 BWR 18mm → SREQ-00042 + reserve. Meena converts → SO-00042. Parallel prep (review / pricing check / stock check / warehouse). Kiran dispatches (+ e-way). Anu issues **INV-00042** (HSN, GSTIN, IRN, QR). Ravi pays UPI → allocation. WhatsApp notifies each step. Ageing row drills back to SO-00042. Next SREQ blocked if over credit.

If a feature cannot point at **SREQ / SO / INV**, it is not P0.

---

## 9. Document control

| Item | Value |
|------|--------|
| Baseline overall | 6.2 / 10 |
| Post-P0 target overall | ~7.8 / 10 |
| Per-flow 10/10 | Gap lists in §5; thesis fit labelled |
| Next code | P0.1 only |
| Do not create | Parallel GST module, parallel AR ledger, orphan payment widget |
