# Fruit-Seller Demo Runbook (macOS)

A complete, reproducible demo of the grocery/produce use case on
**Simhapuri Fresh** — a sell-by-weight fruit & vegetable seller — exercising
sell-by-weight pricing, perishable batch/FEFO stock, and the full order
lifecycle across every staff role.

Everything runs locally with **no Docker and no system Postgres** (an embedded
Postgres is used). Verified on macOS with Node 20 + pnpm.

> For the nine end-to-end gaps that were closed to make this flow production-grade
> (auto driver-assignment, multi-channel buyer notifications, OTP fallback,
> self-serve provisioning, real line-level tax, online payment, instant orders,
> delivery tracking + proof-of-delivery, and customer-initiated returns) — with
> the verification suites and the production environment variables each one needs
> — see **[E2E-GAPS-CLOSED.md](./E2E-GAPS-CLOSED.md)**.

---

## 1. One-time setup

```bash
# from the repo root
pnpm install

# Build the two compiled packages BEFORE starting any service.
# They publish from ./dist and ship no dist/, so services 500 with
# "Cannot find module '@erp/logger/ids'" until this runs.
pnpm --filter @erp/logger --filter @erp/telemetry build
```

Environment files are already created for local dev:
`.env` (root) and `apps/{gateway,inventory,sales,accounting}/.env.local`, each
pointing at its own database with dev secrets (`SERVICE_SECRET=dev-service-secret`).

---

## 2. Start the database

In its own terminal (leave it running):

```bash
cd tools/local-pg && npm install && node start.mjs
```

This boots embedded PostgreSQL on `localhost:5432` and creates the 7 service
databases.

First time only — push the schemas (from the repo root, in another terminal):

```bash
DATABASE_URL="postgresql://erp:erp_dev_password@localhost:5432/erp_gateway"    pnpm --filter @erp/gateway    exec prisma db push
DATABASE_URL="postgresql://erp:erp_dev_password@localhost:5432/erp_inventory"  pnpm --filter @erp/inventory  exec prisma db push
DATABASE_URL="postgresql://erp:erp_dev_password@localhost:5432/erp_sales"      pnpm --filter @erp/sales      exec prisma db push
DATABASE_URL="postgresql://erp:erp_dev_password@localhost:5432/erp_accounting" pnpm --filter @erp/accounting exec prisma db push

# Seed the platform operator (needed to provision tenants)
DATABASE_URL="postgresql://erp:erp_dev_password@localhost:5432/erp_gateway" pnpm seed:platform
```

---

## 3. Start the services

Each in its own terminal (or use one terminal per line with `&`):

```bash
pnpm dev:gateway      # http://localhost:3010/admin
pnpm dev:sales        # http://localhost:3001
pnpm dev:inventory    # http://localhost:3002
pnpm dev:accounting   # http://localhost:3003
# Customer storefront (optional, for the live click-through):
pnpm --filter @erp/customer dev   # http://localhost:3007
```

Wait until each `/api/health` returns 200:

```bash
curl -s http://127.0.0.1:3010/admin/api/health
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3002/api/health
curl -s http://127.0.0.1:3003/api/health
```

---

## 4. Seed the fruit-seller tenant

```bash
pnpm --filter @erp/scripts exec tsx seed-fruit-seller.ts
```

Idempotent. It provisions:

- **Tenant** `Simhapuri Fresh` (slug `simhapuri-fresh`), vertical **grocery** —
  licenses core/inventory/sales/delivery, applies the grocery order workflow,
  seeds a default warehouse, and grants the Growth plan (enables the `oms`
  feature so orders can be placed).
- **Published SO_STANDARD v5 workflow** + form catalog (required before any
  order can be created).
- **Staff users** (one per role) and a **storefront customer**.
- **Produce catalog** — all sell-by-weight (₹/kg), batch-tracked with a shelf
  life. Each item is received as **two lots**: `LOT-A` 20 kg expiring in 1 day
  (near-expiry, consumed first by FEFO) and `LOT-B` 30 kg expiring at the full
  shelf life.

Catalog (11 items, each with an image and opening stock):
- **Fruits:** Banana, Apple, Mango, Grapes, Orange
- **Vegetables:** Tomato, Onion, Potato, Carrot, Lemon
- **Leafy Greens:** Spinach

Product images are lightweight SVG tiles in
`apps/customer/public/media/products/` (served at `/media/products/<file>`).
Swap in real photos by dropping `.jpg`/`.png` files there and pointing each
product's `imageUrls[0]` at them (the seed sets these).

---

## 5. Verify the whole flow (two scripts)

Both are idempotent and self-asserting; each exits non-zero on any failure.

**A) Staff / walk-in path** — proves role gating + the full lifecycle:

```bash
pnpm --filter @erp/scripts exec tsx verify-fruit-seller.ts
```
Expected **19 passed, 0 failed**: a 0.5 kg + 1.5 kg walk-in order is created
CONFIRMED; a DELIVERY user is rejected from a SALES task (403); the lifecycle
advances review → verify-stock → pricing → warehouse-ready → dispatch → deliver
→ invoice by role; stock drops by the exact weight and FEFO consumes LOT-A first.

**B) Real portal path (customer → staff)** — the genuine storefront flow:

```bash
pnpm --filter @erp/scripts exec tsx verify-portal-fruit-seller.ts
```
Expected **26 passed, 0 failed**: the **customer** places a weight order
(0.75 kg + 1.25 kg + 2 kg) that becomes a **Sales Request**; the customer sees
it and is blocked from converting it; **Sales** converts it to a CONFIRMED order;
staff fulfil it to INVOICED by role; fractional quantities persist and FEFO
deducts the near-expiry lot first.

---

## 6. Logins

Tenant slug for all logins: **`simhapuri-fresh`**

| Role | Email | Password | Does in the demo |
| --- | --- | --- | --- |
| Admin | admin@simhapurifresh.com | Admin@123 | Catalog, stock, oversight |
| Sales | sales@simhapurifresh.com | Sales@123 | Place order, review, verify stock |
| Pricing | pricing@simhapurifresh.com | Pricing@123 | Confirm ₹/kg pricing |
| Dispatch | dispatch@simhapurifresh.com | Dispatch@123 | Weigh/pick, dispatch |
| Delivery | delivery@simhapurifresh.com | Delivery@123 | Out for delivery, deliver |
| Accounts | accounts@simhapurifresh.com | Accounts@123 | Invoice |
| Customer | buyer@simhapurifresh.com | Buyer@12345 | Storefront shopping |
| Platform | platform@erp.local | Platform@123 | Provision tenants |

- Admin / staff desk: `http://localhost:3010/admin/login?tenant=simhapuri-fresh`
- Customer storefront: `http://localhost:3007/shop?tenant=simhapuri-fresh`

---

## 7. Live demo click-path (customer → staff)

1. **Customer (storefront).** Open
   `http://localhost:3007/shop?tenant=simhapuri-fresh`, log in as the buyer.
   Browse the produce catalog (images + per-kg prices). Open a product priced
   **per kg** and add a **fractional quantity** (e.g. 0.75 kg bananas) — the
   weight stepper and sub-unit cart add are the sell-by-weight feature. Check
   out → this creates a **Sales Request** (the customer's order request).
2. **Sales** (staff desk, `…/admin/login?tenant=simhapuri-fresh`). Open the
   Sales Request, **convert** it to a Sales Order (CONFIRMED, stock reserved),
   then review + verify stock.
3. **Pricing.** Confirm the per-kg rate.
4. **Dispatch.** Mark warehouse-ready (weighed/bagged), then dispatch with a
   vehicle + driver.
5. **Delivery.** Mark out for delivery, then delivered — this deducts stock
   **FEFO**, consuming the near-expiry lot first.
6. **Accounts.** Generate the invoice.
7. **Admin.** Show stock dropped by the sold weight, and
   `GET /api/stock/expiring?withinDays=2` listing the near-expiry lots. Run the
   expiry sweep (`POST /api/stock/expiring/sweep`) to write off expired lots.

> Prefer a staff-only demo? Skip step 1 and have Sales place a **walk-in** order
> directly — that is the `verify-fruit-seller.ts` path.

---

## Notes & gotchas

- **Build shared packages first** (step 1). This is the most common cause of a
  broken local boot.
- **Order lifecycle uses the SO_STANDARD v5 task graph.** The grocery
  `OrderWorkflow` provides the status labels, but the runtime task engine (and
  therefore the demo transitions) is `SO_STANDARD`: review → verify-stock →
  pricing → warehouse → dispatch → deliver → invoice. A dedicated grocery v5
  task template does not exist yet — a worthwhile follow-up if you want the
  shorter confirm → pickup → deliver path end to end.
- The seed and verify scripts are **idempotent** — safe to re-run.
- Reset everything: stop the services, delete `tools/local-pg/data`, and redo
  step 2.
