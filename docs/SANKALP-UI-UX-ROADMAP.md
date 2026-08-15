# Sankalp ERP — UI / UX improvement roadmap

**Status:** Product UX baseline · improvement plan (not a redesign)  
**Date:** 15 August 2026 (BL-044 SE visual lock frozen/shipped)  
**Related:** `docs/SANKALP-UI-UX-NOW.md` (current flow only), `docs/SANKALP-ERP-COMPETITIVE-ROADMAP.md`, `docs/TRADING-JOURNEY.md`, `docs/guides/design-system.md`, `docs/guides/themes.md`, `docs/guides/app-guidelines.md`, `docs/adr/0014-erp-ui-framework-classification.md`, `docs/adr/0015-trustwood-erp-platform-v1.md`, `docs/architecture/host-experience-principle.md`, `docs/UI-DESIGN.md` (legacy Inter/indigo — do not implement new screens from it)

This document scores **UI design and user-friendly flow**, then lists **concrete improvements per surface** to reach 10/10 UX (including GST / AR / pay / WhatsApp when those land).

**To improve look-and-feel and the current SREQ → SO → prep → dispatch journey only**, use `docs/SANKALP-UI-UX-NOW.md` instead.

It does **not** change engineering order. Immediate **product** code remains **P0.1 GST**. Full-spine UI is **P0.5**. Dashboard save-empty + Order Desk naming sit in the NOW doc.

**Do not** invent a second design system. Foundation is already strong. The gap is **applying one language to the dealer spine**.

---

## 1. Thesis (same as product)

> Sankalp ERP is a dealer-first trading operating system — mobile order capture → fulfilment → invoicing → collection.

UX must make that spine **obvious on screen**, not look like four products (commerce PWA + widget dashboard + kanban desk + Tally-like invoices).

**Competitive UX objective**

| Do not optimize for | Optimize for |
|---------------------|--------------|
| Dribbble / new brand | One TrustWood chrome on Dashboard, Order Desk, AR, invoice |
| Admin that needs a trainer | SE can finish Agarwal’s order in one sitting |
| Widget-editor as home | Dashboard = attention; Desk = work |
| “GST module” / “AR module” screens | Same SO panel: Invoice · Collect · GST status · WhatsApp |

---

## 2. How UX is scored

| Criterion | Question |
|-----------|----------|
| Spine completion | Can Meena take SREQ-00042 → SO → prep → dispatch → invoice without guessing? |
| Dealer completion | Can Ravi order measured plywood without a phone call? |
| Visual consistency | Same type, cards, buttons, density, empty states? |
| Cognitive load | How many tabs/modes before work starts? |
| Feedback | Status, toast, blocked reason, next action? |
| Framework fit | Studio vs Workspace vs Form vs Modal (ADR 0014)? |
| Density / touch | Customer `comfortable` vs admin `dense` (intentional)? |
| First run / empty | New tenant or empty inbox: is the next click obvious? |

**10/10 UX** = Unicommerce-clear B2B desk + Zoho-clear dealer app, in **one TrustWood visual language**, along **one document spine** (SREQ / SO / INV).

---

## 3. Baseline scorecard

**Overall UX: 6.2 / 10** (foundation 8 · application 5.5 · dealer flow 7.5 · ops flow 6.5)

| Surface | Score | 10/10 look | Thesis fit |
|---------|------:|------------|------------|
| Design system (tokens, themes, density, Lucide, AdminShell) | **8.0** | Already near; docs + all screens use it | PLATFORM |
| Visual consistency across admin screens | **5.5** | One `.ws-*` chrome everywhere on the spine | **P0.5** |
| Dealer PWA (browse → SREQ) | **7.5** | Pay + credit + IRN PDF + WA on same order | TRADING OS + P0.3/4 |
| Order Desk operational flow | **6.5** | SE mode; prep vs fulfil copy; SO panel continuation | TRADING OS + P0.5 |
| Dashboard as home | **5.5** | Attention only; never empty after save; CTA to Desk | **P0.5** |
| Catalog / product authoring | **6.0** | Quick-add sellable SKU + full Studio | TRADING OS |
| Customers / credit | **5.5** | Credit + ageing on customer + Desk convert | **P0.2** |
| Invoices / AR UI | **4.5** | Ageing workbench = OMS money view | **P0.2 + P0.5** |
| Procurement / PO UI | **5.5** | Shortage → draft PO from Desk | TRADING OS P1 |
| Delivery app | **6.0** | POD + tracking + e-way status | TRADING OS |
| Process Studio / designers | **7.0** | Same shell; first-run apply `oms_trading` | PLATFORM |
| Platform admin | **7.0** | Same TrustWood theme (ADR 0015) | PLATFORM |
| Login / first run | **6.0** | Tenant + OTP clear; apply workflow unmissable | PLATFORM |
| Accessibility / keyboard | **5.0** | Focus, Desk j/k, confirm convert | P0.5 / TRADING OS |
| Mobile admin | **5.0** | Desk usable on tablet; phone = read + claim | P2 |
| Empty / error / loading | **5.0** | Honest empty + one primary action | **P0.5** |
| Copy / naming | **5.5** | Only “Order Desk”; no OMS/Sales Desk in UI | **P0.5** |

**Target after P0.5 + spine UI (GST/AR/pay/WA visible on Desk):** **~8.0–8.5 UX overall**.

True 10/10 on every row (native apps, keyboard-first Desk, full a11y audit, marketing-site polish) is **P1–P2**, not a redesign sprint before P0.1.

---

## 4. Spine UX (Agarwal Ply) — current vs friendly

```
Ravi PWA: measured qty + ₹/sq ft     ← already friendly
  → SREQ-00042 + reserve
  → Meena Inbox → Convert            ← friendly if she finds Order Desk
  → SO-00042
  → Parallel prep (review / price check / stock / warehouse)  ← confusing today
  → Prep gate → Dispatch             ← OK with stage rail
  → INV-00042 GST/IRN/QR/e-way       ← leaves Desk today
  → Pay / AR / WhatsApp              ← missing or split
```

| Step | UX today | Improvement |
|------|----------|-------------|
| Measured qty | On PDP; Desk “pricing” looks like re-measure | Copy: “Verify quote (₹/sq ft already from dealer)” |
| Reserve | Silent at checkout | SREQ detail: “Stock reserved · 12 sheets” |
| Convert | Strong primary action | Confirm sheet: customer, total, credit OK/block |
| Parallel prep | Workbench switcher + team/mine + overdue | **SE mode**: only my tasks; admin keeps switcher |
| Fulfilment | Stage rail good | Keep; don’t merge with prep |
| Invoice / GST / pay | `/invoices` list | **SO detail**: Invoice · IRN · Collect · WhatsApp |
| Dashboard click | May 404 or empty layout | Always ` /sales-desk?sreqId=` or INV ageing |

If a UI change cannot point at **SREQ / SO / INV**, it is not P0.5.

---

## 5. Non-goals

- New color brand, new font, dark admin theme, Inter/indigo revival (`UI-DESIGN.md` is legacy)
- Widget marketplace as the product
- Making Product Studio “simple” by removing measured attributes (they are the wedge)
- Mobile-first admin before web Desk + AR are kind
- GST/AR/Payments as separate visual “apps”

---

## 6. Improvements by surface (to 10/10)

### 6.1 Design system & chrome — **8.0 → 10**

**Why 8.0:** Tokens, `data-theme="trustwood"`, density, Lucide, AdminShell, `.erp-canvas` / `--page-bg` are right. Not every page uses them. Legacy UI-DESIGN still teaches indigo.

| # | Work | Fit |
|---|------|-----|
| DS1 | Mark `docs/UI-DESIGN.md` **legacy / do not implement**; point authors to tokens + this doc | PLATFORM |
| DS2 | Promote `.ws-page` / `.ws-hero` / `.ws-btn` / `.ws-chip` / `.ws-widget` / `.ws-stage` as **required** for Dashboard, Desk, AR, invoice | **P0.5** |
| DS3 | Admin main already uses `--page-bg`; remove per-page `bg-[var(--canvas)]` fights | **P0.5** |
| DS4 | Button/link: only `.ws-btn` / `Button` primitive — no one-off indigo/gray CTAs | **P0.5** |
| DS5 | StatusBadge map complete for SREQ/SO/INV/task/e-way/IRN | **P0.5 + P0.1** |
| DS6 | Density: admin `dense`, customer `comfortable` — document in page headers if mixed | PLATFORM |
| DS7 | Fraunces display + Outfit body loaded on **all** admin/customer/platform hosts | PLATFORM |
| DS8 | Icon rule audit: Lucide only (no mixed sets) | PLATFORM |
| DS9 | Motion: `prefers-reduced-motion` on Desk stage + toasts | PLATFORM |
| DS10 | Storybook or `/ui` gallery of ws-* + KpiCard + Desk stage (optional P2) | P2 |

**Thesis 10/10:** Every spine screen is obviously TrustWood without reading the URL.

---

### 6.2 Visual consistency — **5.5 → 10**

| # | Work | Fit |
|---|------|-----|
| VC1 | Shared `WorkspaceHero` on Dashboard, Order Desk, AR workbench, invoice detail | **P0.5** |
| VC2 | Same eyebrow pattern: Workspace / Trading operations / Collections / Tax invoice | **P0.5** |
| VC3 | Products / customers / POs: PageHeader **or** WorkspaceHero — pick one for “list pages” | TRADING OS |
| VC4 | Kill leftover “Sales Desk” / “OMS” in UI strings (keep `/oms` redirect only) | **P0.5** |
| VC5 | Platform admin already TrustWood (ADR 0015) — no second operator skin | PLATFORM |
| VC6 | POS/delivery themes stay `pos` / `delivery` (field/counter), not admin | PLATFORM |

---

### 6.3 Dashboard — **8.0 (BL-039 baseline LOCKED)**

**Principle:** Dashboard tells me what needs me. Order Desk lets me do the work.

```text
DASHBOARD ("What needs me now?")
  KPIs · My Tasks · Summaries
        │
        ▼ Open Order Desk
ORDER DESK ("Do the actual work")
  Claim / Complete   ← BL-040
```

**Three layers — do not mix:**

| Layer | Source | Mutates prefs? |
|-------|--------|----------------|
| **1. Saved layout** | DB 12-col `x/y/w/h` | Yes (Customize save) |
| **2. Role defaults** | [`defaults.ts`](../packages/ui/src/dashboard/defaults.ts) when no pref | Seed only |
| **3. Responsive presentation** | [`getPresentationWidgets`](../packages/ui/src/dashboard/presentation.ts) | **Never** — phone ops render order only |

Phone ops order: **My Tasks → TODAY → secondary** (charts/tables/activity if configured — **not** hard-hidden). Desktop ≥1024 uses persisted grid. Tablet = light tighten only.

Priority lives in the presentation helper (`PHONE_PRIORITY`), not per-widget `mobilePriority` metadata — avoid a new abstraction until the map is insufficient.

**BL-039 owns (SHIPPED):** phone hierarchy, compact hero, CTA contrast, Customize demotion, TODAY 2×2, presentation-only order, role defaults foundation, responsive render.  
**BL-041 Phase A (SHIPPED):** curated role defaults + actionable charts (click → Desk/AR). **Not** a Customize feature. Defaults evolve; customizations persist. Never soft-replace saved layouts.  
**BL-043 (SHIPPED):** My Tasks + Requests/orders hybrid status bars (separate SREQ/SO); same widget IDs; Desk tab/taskStatus/sreqStatus filters.  
**BL-044 (SHIPPED):** SE/ops visual lock — contextual hero; three-state My Tasks; Sales layout work→pipeline→trend|customers; compact KPIs. Principle: summarize when simple, visualize when variation exists. Does not reopen BL-039.  
**BL-042 (SHIPPED thin):** 7D/30D/MTD/QTD chips on `revenue-trend` only (session state; never touches prefs). Phase C brush/zoom deferred.  
**Do not own here:** Order Desk claim cards (BL-040), Bill & Collect redesign, Studio mobile, Capacitor, customer portal.

| # | Work | Fit |
|---|------|-----|
| DB1 | Fix save/reload: `registerDashboardWidgets()` on server; empty pref → role default | **SHIPPED** |
| DB2 | Rebuild gateway so live UI matches ws-hero + KpiCards | **SHIPPED** |
| DB3 | Default layout = KPI row + activity/table only; hide editor until “Customize” | **SHIPPED** (phone: under ⋮) |
| DB4 | Primary CTA: **Open Order Desk** | **SHIPPED** |
| DB5 | Role chip (Sales Executive, …) | **SHIPPED** |
| DB6 | Rows click to `/sales-desk?sreqId=` or `?salesOrderId=` or `/invoices` ageing | **P0.5** |
| DB7 | Empty state: “Restore default layout” not a blank page | **SHIPPED** |
| DB8 | Accountant default widgets = outstanding + ageing (after P0.2) | **P0.2 + P0.5** |
| DB9 | Toast on save/reset | **SHIPPED** |
| DB10 | Do not put Order Desk inbox widget on dashboard | LOCKED |
| DB11 | Phone presentation-only order; no hide-charts policy | **SHIPPED** (BL-039) |

**Thesis 10/10:** 10-second home: what needs me + one button to work.

---

### 6.4 Order Desk — **6.5 → 10**

**Why 6.5:** Correct Workspace pattern + stage rail. Too many modes for SE. Parallel prep unexplained. Invoice/collect not on SO panel.

**Next MA3 slice (BL-040):** phone Needs Action cards with Claim / Review; In Progress → Complete; desktop desk unchanged. Does not change dashboard presentation (BL-039 locked).

| # | Work | Fit |
|---|------|-----|
| OD1 | Hero: “Order Desk” + “Trading operations” + link Dashboard | **P0.5** |
| OD2 | Stage labels + hints: Inbox = sales requests · My Work = your steps · Fulfillment = in flight | **P0.5** |
| OD3 | **SE / locked roles:** hide workbench switcher; only their task queue | TRADING OS / P0.5 |
| OD4 | Admin keeps workbench + team/mine | TRADING OS |
| OD5 | Task titles/subtitles: Pricing = “Verify dealer quote”; Inventory = “Confirm reservation” | **P0.5** |
| OD6 | SREQ header: reserved qty + measured lines summary | TRADING OS |
| OD7 | Convert confirm: customer, total, **credit OK / blocked** (P0.2) | **P0.2** |
| OD8 | SO detail continuation strip: Invoice · IRN/QR · E-way · Collect · WhatsApp | **P0.1–P0.4 + P0.5** |
| OD9 | Nav badge: open SREQ count | TRADING OS |
| OD10 | SLA / overdue default filter for My Work | TRADING OS |
| OD11 | Keyboard: j/k select, Enter open, confirm convert | TRADING OS |
| OD12 | First run: full-page “Apply OMS Trading template” if no workflow | TRADING OS |
| OD13 | Inbox rows: avatar initial, amount, payment method (partially done) | **P0.5** |
| OD14 | Tablet: queue + detail stack without losing primary actions | P2 |

**Thesis 10/10:** Meena never asks “where do I invoice this SO?”

---

### 6.5 Dealer PWA — **7.5 → 10**

**Why 7.5:** Best UX surface. Gaps are spine edges (pay, credit, IRN PDF, WA), not look.

| # | Work | Fit |
|---|------|-----|
| CP1 | Home: credit used / limit (after P0.2) | **P0.2** |
| CP2 | Checkout + “Pay invoice” Razorpay/UPI | **P0.3** |
| CP3 | Order detail: INV PDF with IRN/QR | **P0.1** |
| CP4 | Status copy matches Desk (SREQ → confirmed → dispatched → invoiced) | **P0.5** |
| CP5 | WA deep link into same thread | **P0.4** |
| CP6 | GST line on bill: HSN visible if set | **P0.1** |
| CP7 | Blocked checkout message: “Over credit — call sales” | **P0.2** |
| CP8 | Fix E2E checkout; skeletons already exist | TRADING OS |
| CP9 | Install prompt / PWA update (app-guidelines) | P1 |
| CP10 | Capacitor wrap — same UI, safe-area CTAs | P1 commercial |
| CP11 | Wishlist/reviews | OUT |

**Thesis 10/10:** Ravi orders, tracks, pays, and reads GST invoice without calling Meena.

---

### 6.6 Catalog / product authoring — **6.0 → 10**

**Why 6.0:** Studio is the right framework (ADR 0014). Create-product is long and expert-only. Measured pricing is the wedge — cannot dumb it down to “price only.”

| # | Work | Fit |
|---|------|-----|
| CA1 | **Quick add sellable SKU:** name, category, HSN, basis (each vs area), rate, opening stock | TRADING OS |
| CA2 | Full Studio remains for variants / attributes / tax approval | TRADING OS |
| CA3 | HSN + tax approval gate before portal-visible (feeds P0.1) | **SPINE** |
| CA4 | Margin preview when cost exists | TRADING OS P1 |
| CA5 | Image gallery UX + S3 (not only local upload) | TRADING OS |
| CA6 | Price list UI: customer/group, dates — same ws chrome | TRADING OS |
| CA7 | Don’t use Studio for Brand/Category (Modal Form) — audit any wizard overkill | TRADING OS |

**Thesis 10/10:** Junior catalog user can add a sheet SKU in &lt;2 minutes; expert still has Studio.

---

### 6.7 Customers + credit — **5.5 → 10**

| # | Work | Fit |
|---|------|-----|
| CU1 | Customer page: outstanding, ageing chip, credit limit, block reason | **P0.2** |
| CU2 | GSTIN field labeled GSTIN (not only “taxId”) + validation state | **P0.1** |
| CU3 | Convert/Desk shows same credit chip | **P0.2** |
| CU4 | Click ageing → INV → SO | **P0.2 + P0.5** |

---

### 6.8 Invoices / AR workbench — **4.5 → 10**

**Why 4.5:** `/invoices` is a document list, not collections. Must **not** become a Tally clone UI.

| # | Work | Fit |
|---|------|-----|
| AR1 | AR workbench using **Workspace** pattern (queue + detail), not a new module IA | **P0.2 + P0.5** |
| AR2 | Ageing buckets + drill to SO/SREQ/dealer | **P0.2** |
| AR3 | Allocate payment UI (partial / multi-invoice) | **P0.2** |
| AR4 | Same hero/buttons as Desk | **P0.5** |
| AR5 | Invoice PDF preview: GSTIN, HSN, IRN, QR | **P0.1 + P0.5** |
| AR6 | Accountant dashboard widgets = this workbench, not generic revenue | **P0.2 + P0.5** |
| AR7 | No separate “GST app” nav — GST status lives on invoice/SO | LOCKED |

**Thesis 10/10:** Anu and Meena see the same INV-00042; only the view differs.

---

### 6.9 Procurement / PO — **5.5 → 10**

| # | Work | Fit |
|---|------|-----|
| PR1 | From Desk shortage task: “Create draft PO” deep link | TRADING OS P1 |
| PR2 | PO list/detail on ws chrome | P1 |
| PR3 | RFQ thread UX when WA send exists (P0.4) | P0.4 + P1 |
| PR4 | 3-way match = Workspace (PO queue + GRN/AP detail) | TRADING OS |

---

### 6.10 Delivery app — **6.0 → 10**

| # | Work | Fit |
|---|------|-----|
| DL1 | Assignment detail: e-way status (P0.1) | **SPINE** |
| DL2 | POD photo + signature (density `compact-touch`) | TRADING OS |
| DL3 | Customer tracking page (simple, not admin theme) | TRADING OS |
| DL4 | Capacitor wrap + safe-area | P1 |
| DL5 | Keep `data-theme="delivery"` — not TrustWood admin forest | PLATFORM |

---

### 6.11 Process Studio — **7.0 → 10**

| # | Work | Fit |
|---|------|-----|
| ST1 | First-run Order Desk: apply `oms_trading` full-page, not a small card | TRADING OS |
| ST2 | Designers stay in AdminShell; same theme | PLATFORM |
| ST3 | Don’t force Studio onto Desk or Brand CRUD | LOCKED ADR 0014 |
| ST4 | Template library cards (trading vs grocery) | PLATFORM |

---

### 6.12 Login / first run — **6.0 → 10**

| # | Work | Fit |
|---|------|-----|
| LG1 | Tenant slug + OTP + password on one clear TrustWood login | PLATFORM |
| LG2 | After login → Dashboard (already dashboard-first) | LOCKED |
| LG3 | No workflow → block Desk with apply template | TRADING OS |
| LG4 | Demo users: password always works (already repaired once — keep seed) | PLATFORM |

---

### 6.13 Accessibility & keyboard — **5.0 → 10**

| # | Work | Fit |
|---|------|-----|
| AX1 | Focus visible on Desk queue + convert | **P0.5** |
| AX2 | Confirm convert (Enter) / Escape close | TRADING OS |
| AX3 | j/k queue navigation | TRADING OS |
| AX4 | Contrast check on `--brand` text on `--mist` | **P0.5** |
| AX5 | `aria-live` for task claim / convert success | TRADING OS |
| AX6 | Full WCAG AA audit | P2 |

---

### 6.14 Mobile admin — **5.0 → 10**

| # | Work | Fit |
|---|------|-----|
| MA1 | AdminShell drawer already exists — ensure Desk primary actions not hover-only | **P0.5** |
| MA2 | Tablet: queue stacked above detail | P2 |
| MA3 | **Admin Mobile Operational Mode** — phone = glance + claim/confirm/assign/status; cards not H-scroll tables; sticky primary; hide Process Studio; Bill & Collect read-only on phone; tablet+ full | **SHIPPED** shell/desk (BL-037) + dashboard phone ops (BL-039); **BL-040** desk claim cards |
| MA4 | Do not make admin a second customer PWA | LOCKED |

---

### 6.15 Empty / error / loading — **5.0 → 10**

| # | Work | Fit |
|---|------|-----|
| EE1 | Dashboard empty ≠ blank: restore default | **P0.5** |
| EE2 | Inbox empty: “No dealer requests yet” + link to portal (admin) | **P0.5** |
| EE3 | Widget error: retry, not only red text | **P0.5** |
| EE4 | Skeleton on Desk queue load | TRADING OS |
| EE5 | GST/NIC failure: show on SO invoice strip, retry | **P0.1 + P0.5** |
| EE6 | Payment failure: stay on INV, don’t dump to dashboard | **P0.3** |

---

### 6.16 Copy / naming — **5.5 → 10**

| Term in UI | Use | Never in UI |
|------------|-----|-------------|
| Order Desk | Workbench | Sales Desk, OMS (URL `/oms` OK) |
| Sales request / SREQ | Dealer request | “Order” before convert |
| Sales order / SO | After convert | |
| My Work | Parallel prep | “Fulfilment tasks” |
| Fulfillment | Dispatch/deliver | Prep |
| Verify quote | Pricing task | “Enter price” if dealer already quoted |
| GSTIN | Customer/tenant tax id | Only “Tax ID” |
| Collect | Pay INV | “Mark paid” without money movement |

---

## 7. Framework rules (do not regress)

| Screen type | Pattern | Example |
|-------------|---------|---------|
| Multi-step authoring | **Studio** | Create product |
| Queue + detail + tasks | **Workspace** | Order Desk, later AR, warehouse |
| Medium dedicated form | **Form page** | Customer edit |
| Small CRUD on list | **Modal** | Brand name |
| Commerce discovery | **Hand-crafted** | Home, PDP, cart |

Anti-pattern: Studio wizard for Order Desk. Anti-pattern: Modal for convert. Anti-pattern: widget dashboard as the only way to process SREQs.

Customer **commerce** stays hand-crafted; customer **checkout / tracking / pay invoice** may use Form + widgets where configurability helps (`host-experience-principle.md`).

---

## 8. Score movement if we only ship locked UI + spine

| Surface | Now | After P0.5 + P0.1–P0.4 on Desk/portal |
|---------|----:|--------------------------------------:|
| Visual consistency | 5.5 | **8.0** |
| Dashboard | 5.5 | **8.0** |
| Order Desk | 6.5 | **8.5** |
| Dealer PWA | 7.5 | **8.5–9.0** |
| Invoices / AR UI | 4.5 | **8.0** |
| Copy / naming | 5.5 | **8.5** |
| Empty states | 5.0 | **8.0** |
| Design system | 8.0 | **8.5** |
| Catalog admin | 6.0 | ~6.5 (quick-add is P1) |
| Mobile admin | 5.0 | ~6.0 |
| **Overall UX** | **6.2** | **~8.0–8.5** |

Catalog quick-add, Desk keyboard, Capacitor, WCAG AA push toward **9+** without a new brand.

---

## 9. Execution vs product P0

| When | UI work |
|------|---------|
| **Now (P0.1 code)** | No UI redesign. Invoice PDF bindings (GSTIN/HSN/QR) when GST lands. |
| **P0.2** | AR workbench = Workspace chrome (same as Desk). Credit chips on convert + customer + portal. |
| **P0.3** | Pay CTA on portal order + Desk SO strip — not a payment “app”. |
| **P0.4** | WA thread on same SO/SREQ panel. |
| **P0.5** | DS2–DS5, VC1–VC4, DB1–DB9, OD1–OD5/OD13, EE1–EE3, AX1, MA1, copy table. Rebuild gateway. |
| **P1** | CA1 quick-add, OD9–OD12, CP9–CP10, PR1, DL2–DL4 |
| **P2** | Keyboard-first Desk, WCAG AA, phone admin, Storybook |

**Demo blockers that may ship with P0.5 even if GST isn’t done:** DB1 (empty dashboard after save), VC4 (Order Desk naming), OD12 (apply template), gateway rebuild.

---

## 10. Use case — UI only (same Agarwal order)

1. Ravi: PDP shows size × rate = line total; checkout shows GST if HSN set.  
2. Meena: Dashboard “1 open SREQ” → Order Desk Inbox → SREQ-00042 (reserved qty visible) → Convert (credit OK).  
3. Priya: My Work task “Verify quote” — not a blank price form.  
4. Kiran: Fulfillment → dispatch → e-way status on same SO.  
5. Anu: SO strip or AR queue → INV-00042 IRN/QR → collect.  
6. Ravi: WA + portal: invoiced / pay link.  

One language, one spine, four roles.

---

## 11. Document control

| Item | Value |
|------|--------|
| UX baseline overall | 6.2 / 10 |
| Post-P0.5 + spine target | ~8.0–8.5 / 10 |
| Product baseline / 10/10 modules | `docs/SANKALP-ERP-COMPETITIVE-ROADMAP.md` |
| Next **product** code | P0.1 GST only |
| Next **UI** code | P0.5 (after or with demo blockers DB1/VC4) |
| Do not | New design system, GST/AR visual modules, indigo revival |
