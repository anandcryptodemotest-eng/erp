# Mobile Cart Retail — E2E Design

**Use case driver:** a produce company runs **40 moving fruit carts**. Each cart
carries its own stock, sells to walk-up customers for cash/UPI, gets restocked
from a central warehouse, and management wants **live inventory per cart** and a
**complete selling flow** end to end.

**Design stance:** build this as a **generic multi-location / mobile-retail
capability** that any van-sales, kiosk, franchise, or multi-outlet tenant can
reuse, then **specialize this customer by configuration** (a vertical recipe +
tenant settings), not by forking code. See
[E2E-GAPS-CLOSED.md](./E2E-GAPS-CLOSED.md) and
[FRUIT-SELLER-DEMO.md](./FRUIT-SELLER-DEMO.md) for the grocery foundation this
builds on.

---

## 1. Recommendation (the short version)

1. **Model each cart as a first-class `StockLocation`** (type `CART | STORE | VAN | WAREHOUSE`)
   that wraps the existing `Warehouse`. Keep the word "cart" out of the schema —
   it is a *label*, not a data model. This keeps the feature generic.
2. **Reuse what already exists** for ~80% of the flow: per-warehouse stock,
   `stock/transfer` (central → cart restock), `stock/receive`, FEFO/expiry
   batches, the POS terminal counter sale, and the per-warehouse stock report.
3. **Close the gaps** (G1–G11 in §3). Blocking correctness first: POS→deduct
   payload mismatch (stock isn't actually decremented), **atomic/concurrency-safe
   deduction** (two terminals can oversell the same cart), and batch/expiry-aware
   transfer. Then operational depth: per-location sales + **per-tender cash/UPI
   reconciliation**, an **audited cart lifecycle**, **unit-of-measure conversion**
   (stock in kg, sell by dozen/piece), and **refund/cancellation stock reversal**.
4. **Add a `mobile_retail` vertical recipe** so onboarding a cart/van business is
   a one-click provision, and express *this* fruit-seller's specifics (label,
   cart count, cash-handover policy, GST) as **tenant settings**, not code.
5. **Optional Phase 4:** continuous cart GPS + a dispatcher map, reusing the
   delivery service's `DeliveryTracking` lat/lng model.

**Generic vs specific split:**

| Concern | Layer | Generic or specific |
| --- | --- | --- |
| Multi-location stock, transfer, receive, FEFO | `inventory` module | **Generic** |
| POS counter sale, cash shift, deduct | `pos` + `accounting` modules | **Generic** |
| `StockLocation` (cart/van/store) + operator + status | `inventory` module | **Generic** |
| Per-location sales + cash-settlement report | `sales`/`accounting` modules | **Generic** |
| `mobile_retail` vertical recipe | provisioning | **Semi-generic (per industry)** |
| Label "Fruit Cart", 40 carts, cash ritual, GST profile, branding | `TenantSetting` / workflow config | **Tenant-specific (no code)** |

---

## 2. What already exists (reuse, don't rebuild)

Grounded in the current codebase:

| Capability | Where | Notes |
| --- | --- | --- |
| Unlimited stock locations per tenant | `apps/inventory/prisma/schema.prisma` → `Warehouse` | tenant-scoped, no cap. |
| Per-location on-hand (weight-aware) | `WarehouseStock` (`quantity`, `reservedQty` as `Float`) | per `product + warehouse + variant`. |
| Perishable lots + expiry + FEFO | `StockBatch`, `Product.trackBatches`/`shelfLifeDays` | first-expired-first-out deduction. |
| Immutable movement ledger | `StockMovement` (IN/OUT/TRANSFER/ADJUSTMENT/RESERVE/RELEASE) | idempotency keys supported. |
| Restock a cart from central | `POST /api/stock/transfer` | ADMIN/MANAGER only; paired OUT+IN. |
| Load/receive stock | `POST /api/stock/receive` | creates batches for perishables. |
| Counter sale (sell now, cash/UPI) | `apps/pos` billing page → `accounting POST /api/bills` | cash shift, change calc, warehouse-scoped. |
| Walk-in invoice | `apps/sales POST /api/quick-bills` | issues invoice; note: does **not** deduct stock. |
| Live inventory per location | `GET /api/reports/stock?warehouseId=<cart>` | on-hand, valuation, low-stock per warehouse. |
| Driver/vehicle records | `apps/hr` `Employee` (`vehicleType`, `vehicleNumber`, availability) | reuse as cart operators. |
| GPS tracking plumbing | `apps/delivery` `DeliveryTracking` (lat/lng/accuracy) | reuse for cart location. |

---

## 3. Gaps to close (the real work)

### G1 — POS stock deduction is broken (**blocker, fix first**)
`apps/accounting/src/app/api/bills/route.ts` calls
`inventory /api/stock/deduct` with a **flat body**
`{ productId, warehouseId, quantity, reference }`, but
`apps/inventory/src/app/api/stock/deduct/route.ts` requires
`{ items: [{ productId, warehouseId, quantity }], reference }`. The call is
wrapped in `.catch(() => null)`, so it **silently fails** — a cart sale does not
decrement cart stock. Also, lines **with a `variantId` are skipped entirely**.
Until this is fixed, "live inventory per cart" is wrong.

**Fix:** build the correct `items[]` payload, include variant lines, and stop
swallowing the error (log + surface a reconciliation warning).

### G2 — Transfer is not batch/expiry aware
`stock/transfer` moves only the aggregate `WarehouseStock` pool, not the
`StockBatch` lots. A cart restocked by transfer has quantity but **no batches**,
so it can't do FEFO or expiry locally — unacceptable for fruit.

**Fix:** make transfer consume source batches FEFO and create matching batches
(carrying `expiryDate`/`batchNo`) on the destination.

### G3 — No per-location sales / cash settlement
The stock report is warehouse-aware, but **bills/sales are not filterable by
location**, and cash shifts tie to a cashier, not a cart. Management can't answer
"what did Cart 12 sell today and how much cash is owed."

**Fix:** persist `stockLocationId` (warehouseId) on `Bill`/`SalesOrder`, add a
per-location sales report, and a per-cart cash-handover summary off the existing
cash-shift ledger.

### G4 — No first-class cart concept
A `Warehouse` has no operator, no status (loading/on-route/parked/closed), no
home branch, no live location.

**Fix:** add a thin, generically-named `StockLocation` entity (below).

### G5 — No continuous cart GPS (optional)
`DeliveryTracking` is order-scoped; a roaming cart has no order.

**Fix (Phase 4):** cart-scoped location pings reusing the lat/lng model.

### G6 — Concurrent-sale stock consistency (**correctness, must-fix**)
Many terminals can hit the **same cart location**. The current `stock/deduct`
runs inside `prisma.$transaction` and re-reads stock, but the read-then-write is
not atomically guarded, so two simultaneous sales can both read 10 kg and each
sell 7 kg → oversell / negative / inconsistent stock. This is a bigger risk for
carts than for a central warehouse because of terminal fan-out.

**Fix:** make the deduction atomic — a guarded conditional decrement
(`updateMany` with a `quantity >= qty` WHERE predicate, or `SELECT … FOR UPDATE`)
so the check-and-decrement is a single serialized operation; fail the whole bill
if the guard matches 0 rows. Add an **idempotency key per bill** so a retried POST
never double-deducts, and ensure a failed bill leaves **no partial movements**
(all-or-nothing in one transaction). This is tightly coupled to G1 — same code
path — so fix them together.

### G7 — Offline POS + sync (field reliability, **late phase, own spike**)
Carts move through patchy connectivity. Selling must not stop when the network
drops.

**Approach (deliberately eventual-consistency):** local transaction store on the
terminal, **unique offline transaction IDs**, background sync, duplicate
prevention (dedupe on offline ID), and conflict resolution when server stock has
since changed. The UI must show **"last synced" stock + pending transactions**,
never claim offline stock is globally accurate.

> **Honest tension with G6:** offline selling means a cart can sell stock the
> server doesn't yet know is gone, so the offline path **accepts optimistic
> oversell reconciled later**, while the online path stays strictly atomic. These
> are two different consistency contracts by design — do not pretend offline is
> transactional. Treat this as its own design spike; the customer PWA service
> worker is a starting point, not a transactional POS.

### G8 — Unit of measure (base unit vs selling unit)
`Product` already carries `unit`, `weightUnit`, `sellByWeight`, `pricingBasis`,
`pricingUom`, `baseRate` — so simple weight pricing works. The **gap** is
multi-unit items where the **stock-keeping unit differs from the selling unit**:
bananas stocked in kg but sold by dozen, watermelon sold by piece, grapes by kg.

**Fix (formalize, don't duplicate existing fields):** define per product a
**base/stock UoM**, a **selling UoM**, a **conversion factor** (e.g. 1 dozen =
1.4 kg), and **decimal precision** for display/rounding. Stock ledger always
moves in the base UoM; the POS sells and prices in the selling UoM and converts
on deduction. Weighing-scale integration is a **future** capability (out of
initial scope).

### G9 — Cash vs UPI reconciliation (separate tenders)
End-of-day settlement must break down **per tender**, not a single total:

| Tender | Expected | Actual |
| --- | --- | --- |
| Cash | ₹5,000 | ₹4,950 |
| UPI | ₹8,000 | ₹8,000 |
| **Total** | ₹13,000 | ₹12,950 |

**Fix:** track shortage/excess per tender, cash deposited to warehouse/manager,
UPI transaction references, and net off **refunds / cancelled bills** (see G11).
Require a **settlement approval + audit trail**.

### G10 — Cart lifecycle + transition audit
A flat `status` enum has no history or accountability. Replace it with an audited
state machine:

```
CREATED → LOADING → READY → ON_ROUTE → PARKED → SETTLEMENT_PENDING → CLOSED
```

**Fix:** every transition records `user, timestamp, fromStatus, toStatus, remarks`
in a `StockLocationStatusEvent` log (see §4.4).

### G11 — Refund / cancellation inventory reversal
A cancelled or refunded cart bill must **reverse its stock movement** (return the
sold quantity to the cart's pool, restoring the batch/lot it came from where
possible) and feed the tender reconciliation (G9) as a negative entry.

**Fix:** a reversal path that writes compensating IN movements referencing the
original bill, idempotent per bill, inside one transaction.

---

## 4. Data model changes (generic)

All additive. Names are deliberately industry-neutral.

### 4.1 `StockLocation` (inventory service)
Wraps `Warehouse` with operational metadata. One row per cart/van/store.

```prisma
model StockLocation {
  id           String   @id @default(cuid())
  tenantId     String
  warehouseId  String   @unique            // backing stock pool (reuse Warehouse)
  code         String                      // e.g. CART-12
  name         String                      // e.g. "Fruit Cart 12 — MG Road"
  type         String   @default("WAREHOUSE") // WAREHOUSE | CART | VAN | STORE | KIOSK
  branchId     String?                     // gateway Branch.id (optional grouping)
  operatorId   String?                     // hr.Employee.id (cart operator/driver)
  // Lifecycle (see G10 + §4.4): CREATED → LOADING → READY → ON_ROUTE →
  // PARKED → SETTLEMENT_PENDING → CLOSED. Transitions are audited.
  status       String   @default("CREATED")
  lastLatitude  Float?                      // last known position (denormalised)
  lastLongitude Float?
  lastSeenAt    DateTime?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  warehouse    Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([tenantId, code])
  @@index([tenantId, type])
  @@index([tenantId, status])
}
```

> **Why wrap, not replace, `Warehouse`?** Every existing stock path keys on
> `warehouseId`. Wrapping means transfer/receive/deduct/report all keep working
> unchanged; `StockLocation` just adds the "who/where/what-state" that carts need.

### 4.2 `StockLocationStatusEvent` (inventory service) — lifecycle audit (G10)
Append-only log of every lifecycle transition for accountability.

```prisma
model StockLocationStatusEvent {
  id              String   @id @default(cuid())
  tenantId        String
  stockLocationId String
  fromStatus      String?                   // null for the initial CREATED
  toStatus        String                    // LOADING | READY | ON_ROUTE | PARKED | SETTLEMENT_PENDING | CLOSED
  userId          String                    // who performed the transition
  remarks         String?
  createdAt       DateTime @default(now())

  @@index([tenantId, stockLocationId, createdAt])
}
```

Allowed transitions (enforced in the service, not just the DB):

```
CREATED → LOADING → READY → ON_ROUTE → PARKED → SETTLEMENT_PENDING → CLOSED
         (READY → LOADING allowed for mid-day re-load; PARKED → ON_ROUTE allowed)
```

### 4.3 `CartLocationPing` (Phase 6, inventory or delivery service)
```prisma
model CartLocationPing {
  id              String   @id @default(cuid())
  tenantId        String
  stockLocationId String
  latitude        Float
  longitude       Float
  accuracy        Float?
  capturedAt      DateTime @default(now())

  @@index([tenantId, stockLocationId, capturedAt])
}
```

### 4.4 Column additions
- `Bill.stockLocationId String?` (accounting) + index — per-cart sales/cash.
- `SalesOrder.stockLocationId String?` (sales, optional) — if carts also place
  fulfilment orders.
- `Bill.idempotencyKey String?` (accounting), unique per tenant — safe bill
  retries, no double-deduct (G6).
- `StockMovement.idempotencyKey` already exists (inventory) — reuse for the
  atomic deduction and for refund-reversal movements (G11).

### 4.5 Unit of measure (G8) — extend `Product`, don't duplicate
`Product` already has `unit`, `weightUnit`, `sellByWeight`, `pricingBasis`,
`pricingUom`, `baseRate`. Add only what multi-unit selling needs:

```prisma
// additions to model Product (inventory)
baseUom        String   @default("pcs")   // stock-keeping unit the ledger moves in
sellingUom     String?                    // UoM shown/priced at POS (null = baseUom)
uomConversion  Float    @default(1)        // 1 sellingUom = N baseUom (e.g. 1 dozen = 1.4 kg)
quantityPrecision Int   @default(3)        // decimal places for display/rounding
```

Rule: **the stock ledger always moves in `baseUom`.** POS sells/prices in
`sellingUom` and multiplies by `uomConversion` before calling `stock/deduct`, so
inventory stays single-unit and consistent. Weighing-scale hardware integration
is explicitly **out of initial scope** (future capability).

---

## 5. API surface (generic)

New (inventory service unless noted):

| Method & path | Purpose |
| --- | --- |
| `POST /api/stock-locations` | Create a cart/van/store (code, name, type, operatorId, branchId). |
| `GET /api/stock-locations` | List/filter by `type`, `status`, `branchId`. |
| `GET /api/stock-locations/:id` | One location + backing warehouse. |
| `PATCH /api/stock-locations/:id` | Update operator/status (e.g. `LOADING`→`ON_ROUTE`). |
| `GET /api/stock-locations/:id/inventory` | Live per-cart stock (wraps `reports/stock?warehouseId=`). |
| `POST /api/stock-locations/:id/ping` | (Phase 4) append a GPS ping; updates `lastLatitude/Longitude`. |
| `GET /api/reports/sales?stockLocationId=` (sales/accounting) | Per-cart sales + cash summary. |

Changed:
- `POST /api/stock/transfer` → batch-aware (G2).
- `accounting POST /api/bills` → correct deduct payload + variant handling + persist `stockLocationId` (G1, G3).

---

## 6. End-to-end flows

### 6.1 Onboarding (one-time)
1. Platform/admin provisions the tenant with the **`mobile_retail`** vertical
   recipe → licenses `core, inventory, sales, delivery, pos`, applies the
   cart-ops workflow, seeds a **Central** warehouse.
2. Admin creates **40 `StockLocation`** rows (`type=CART`, `CART-01..40`), each
   backed by its own auto-created warehouse, each assigned an operator.
3. Tenant settings flip labels/policy: `retail.locationLabel="Fruit Cart"`,
   `cash.handover.required=true`, GST profile, branding.

### 6.2 Morning load-out (per cart, daily)
1. Operator/manager sets cart `status=LOADING`.
2. **Batch-aware transfer** Central → Cart-N for each product (fruit lots travel
   with their expiry). `POST /api/stock/transfer` (G2).
3. Cart `status=ON_ROUTE`.
4. Live inventory now visible via `GET /api/stock-locations/CART-N/inventory`.

### 6.3 Selling (walk-up, all day)
1. Operator opens a **cash shift** (accounting) scoped to the cart.
2. POS terminal: search/scan, weigh (Float kg), add lines, take CASH/UPI.
3. `POST /api/bills` with `stockLocationId=CART-N` → creates `Bill`, records
   cash-shift entry, **deducts stock FEFO from Cart-N** (G1 fixed).
4. Live cart inventory decrements in real time; low-stock surfaces on the report.

### 6.4 Restock mid-day (optional)
- Transfer more stock Central → Cart-N (or Cart → Cart) as needed (G2).

### 6.5 Refund / cancellation (any time) (G11)
1. Operator/manager cancels or refunds a bill.
2. A **reversal** writes compensating IN movements (idempotent per bill,
   restoring the original lot where possible) so cart stock goes back up.
3. The tender reconciliation records a **negative entry** for that bill.

### 6.6 End of day (settlement) (G9, G10)
1. Operator sets cart `status=SETTLEMENT_PENDING` (audited transition, §4.4).
2. **Per-tender reconciliation** — expected vs actual, broken out by tender,
   netting refunds/cancellations:

   | Tender | Expected | Actual | Variance |
   | --- | --- | --- | --- |
   | Cash | ₹5,000 | ₹4,950 | −₹50 |
   | UPI | ₹8,000 | ₹8,000 | ₹0 |
   | **Total** | ₹13,000 | ₹12,950 | **−₹50** |

   Capture cash deposited to warehouse/manager, UPI references, shortage/excess.
3. **Per-cart sales report** (G3): units sold, revenue, unsold stock to return to
   Central (reverse transfer, batch-aware).
4. Spoilage/expiry: `stock/expiring` + a write-off adjustment per cart.
5. Manager **approves** the settlement (audit trail); cart → `CLOSED`.

### 6.7 Management live view
- Dashboard lists all 40 carts: on-hand value, today's sales, cash owed,
  low-stock alerts, and (Phase 4) live position on a map.

---

## 7. Generic vs specific — how the split is enforced

| Layer | Mechanism | For the carts case |
| --- | --- | --- |
| **Modules** | `ModuleLicense` (`inventory`, `sales`, `pos`, `delivery`) | Shared code; all tenants. |
| **Vertical recipe** | `VERTICAL_RECIPES` in `apps/gateway/src/lib/provision-tenant.ts` | Add `mobile_retail` = modules + cart workflow + seed. Reusable by any van/kiosk business. |
| **Workflow template** | `apps/sales/src/lib/workflow-templates.ts` | A cart-ops / counter-sale lifecycle template, copied per tenant as `OrderWorkflow`. |
| **Tenant settings** | `TenantSetting` key/value | `retail.locationLabel`, cart count, `cash.handover.required`, GST, branding — **no code**. |

**Rule of thumb:** if a second customer could plausibly want it → build it
generic and gate it with a recipe/setting. If it only makes sense for this one
business → express it as configuration. By that test the 40-carts requirement is
a **generic mobile-retail capability** this fruit-seller *configures*.

---

## 8. Phased delivery plan

Re-sequenced after design review to front-load correctness. **P0 and the
concurrency fix are merged** because they touch the same deduction code — editing
the hot path once.

| Phase | Scope | Gaps | Why |
| --- | --- | --- | --- |
| **P0 — Correct + safe deduction** | Fix POS→deduct payload + variant handling; make deduction **atomic** (guarded conditional decrement, all-or-nothing); idempotency key per bill. Prove sell→deduct on the live stack with a concurrency test. | G1, G6 | Fundamental correctness — live per-cart stock must be right and race-safe. |
| **P1 — Perishable restock** | Batch/expiry-aware transfer Central→Cart. | G2 | Carts carry FEFO/expiry after restock. |
| **P2 — Cart as a concept** | `StockLocation` + CRUD + **audited lifecycle** (§4.4); per-cart inventory endpoint; UoM base/selling conversion. | G4, G8, G10 | Operators, statuses, multi-unit selling. |
| **P3 — Money & accountability** | `stockLocationId` on bills; per-cart sales report; **per-tender cash/UPI reconciliation** + settlement approval; **refund/cancellation reversal**. | G3, G9, G11 | Management answers "what did Cart 12 sell and what's owed." |
| **P4 — Vertical recipe** | `mobile_retail` recipe + tenant settings (label, cart count, policy). | — | One-click onboarding, reusable across industries. |
| **P5 — Offline POS** | Local store, offline txn IDs, background sync, dedupe, conflict resolution, "last synced" UI. **Own design spike.** | G7 | Field reliability; eventual-consistency contract, kept late. |
| **P6 — Live ops (optional)** | Cart GPS pings + dispatcher map. | G5 | Operational visibility; not needed to prove the retail flow. |

Dependencies: P0 → P1 → P2 → P3; P4 after P2; P5 and P6 independent, after P3.
GPS (P6) is optional and not required to prove the core business flow.

---

## 9. Verification strategy (live stack)

Follow the existing pattern in `scripts/` (tsx scripts asserting against running
services, see `verify-*.ts/.mjs`). New suites:

- `verify-cart-stock.mjs` — create 2 carts (StockLocations); transfer Central→Cart
  carrying batches; assert per-cart on-hand + FEFO lots present (covers P1/P2).
- `verify-cart-sale.mjs` — open shift; POS bill on Cart-1; assert stock
  **decremented FEFO** and `Bill.stockLocationId` set; re-read cart inventory
  (covers P0 — proves G1 fixed).
- `verify-cart-concurrency.mjs` — fire two overlapping deduct/bill requests for
  more than the on-hand; assert exactly one succeeds, stock never goes negative,
  and a retried bill (same idempotency key) does not double-deduct (covers G6).
- `verify-cart-settlement.mjs` — multiple sales + a refund → per-cart report
  totals match; **per-tender** cash vs UPI expected = recorded entries (refund
  netted); reverse-transfer unsold stock (covers P3, G9, G11).
- `verify-cart-lifecycle.mjs` — walk the status machine CREATED→…→CLOSED; assert
  illegal transitions are rejected and each legal one writes a
  `StockLocationStatusEvent` (covers G10).
- Regression: existing `verify-fruit-seller.ts` / `verify-portal-*` must stay
  green (warehouse paths unchanged by the wrapping approach).

Each suite exits non-zero on any failed assertion, run with
`SERVICE_SECRET=dev-service-secret node_modules/.bin/tsx <script>`.

---

## 10. Risks & decisions

- **Decision: cart = `StockLocation` wrapping `Warehouse`** (not a parallel
  stock model). Rationale: every stock path already keys on `warehouseId`;
  wrapping is zero-regression and reuses transfer/receive/deduct/report as-is.
  Rejected: a brand-new cart stock table (would duplicate FEFO + movement
  ledger).
- **Decision: generic naming** (`StockLocation`, `mobile_retail`), label via
  settings. Rejected: a `FruitCart` model (locks the feature to one customer).
- **Risk: batch-aware transfer** touches the hot stock path — must be
  transactional and idempotent; cover with `verify-cart-stock.mjs` before
  rollout.
- **Risk: double-counting stock** if POS deduct and OMS dispatch both run for the
  same cart — keep carts on the POS path only; don't mix fulfilment dispatch and
  counter sale on one location without a clear reservation story.
- **Open question:** should unsold end-of-day stock auto-reverse-transfer to
  Central, or stay on the cart overnight? Default: manual reverse transfer;
  make it a tenant setting if customers diverge.
- **Decision (post-review): online path is strictly atomic; offline path is
  eventual-consistency.** The online deduction never oversells (G6). Offline POS
  (G7) deliberately accepts optimistic local decrement reconciled on sync — two
  different consistency contracts, documented so neither pretends to be the
  other. Offline is kept to its own late phase/spike.
- **Decision: formalize UoM by extending `Product`** (baseUom/sellingUom/
  conversion/precision), ledger always in base UoM. Rejected: a separate UoM
  table or storing stock in mixed units (would make reconciliation ambiguous).
- **Risk: refund/cancellation reversal** must be idempotent per bill and restore
  the original lot where possible; a naive IN movement without lot linkage
  distorts FEFO. Cover with `verify-cart-settlement.mjs`.
- **Verification caveat (honest):** the G1 (deduct payload) and G2 (non-batch
  transfer) gaps were confirmed by reading the source; the reviewer assessed the
  design only. All existing-behavior claims should still be re-confirmed at
  implementation time against the running code, not taken from this doc alone.

---

## 11. Changelog

- **v2 (design review incorporated):** added G6 concurrency/atomic deduction, G7
  offline POS, G8 unit-of-measure, G9 cash/UPI reconciliation, G10 audited cart
  lifecycle, G11 refund/cancellation reversal. Added `StockLocationStatusEvent`
  (§4.4) and UoM fields (§4.5). Re-sequenced phases (P0+concurrency merged;
  offline and GPS kept late/optional). Expanded verification suites
  (concurrency, lifecycle, settlement with refunds).
