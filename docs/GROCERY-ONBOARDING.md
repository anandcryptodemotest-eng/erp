# Onboarding a Fruits & Vegetables (Grocery) Tenant

This runbook documents the confirmed path to onboard a produce / grocery-cart
customer and the platform capabilities that make it work. It reflects the
sell-by-weight, fractional-quantity, and perishability support added for this
vertical.

## 1. Provision the tenant

A new customer is a new **Tenant** created through the gateway control plane.
There is a single provisioning entry point:

```
POST /api/platform/tenants        (gateway; requires platform operator auth)
```

Body (grocery):

```json
{
  "name": "Green Basket",
  "slug": "green-basket",
  "plan": "starter",
  "adminEmail": "owner@greenbasket.in",
  "adminPassword": "********",
  "customerDomain": "shop.greenbasket.in",
  "adminDomain": "admin.greenbasket.in",
  "vertical": "grocery"
}
```

The `vertical` field selects an onboarding **recipe** (`VERTICAL_RECIPES` in
`apps/gateway/src/app/api/platform/tenants/route.ts`):

| vertical  | modules licensed                     | order workflow            | default warehouse |
| --------- | ------------------------------------ | ------------------------- | ----------------- |
| `grocery` | core, inventory, sales, delivery     | `workflow.grocery_delivery` | yes             |
| `general` | core                                 | `workflow.oms_trading`      | no              |

What the provisioning transaction does (all in the **gateway** database):

- Creates the `Tenant`, customer/admin `TenantDomain`s, and base `TenantSetting`s
  (currency INR, timezone Asia/Kolkata, brand name, `onboarding.vertical`).
- Creates the admin `User` + `TenantUser` (role ADMIN) and password credential.
- Licenses the recipe's modules via `ModuleLicense`.
- Creates a default `Branch` (`MAIN`).
- Enqueues **reconciliation records** for the cross-service setup that cannot run
  in the gateway DB transaction.

### Cross-service setup (sales + inventory)

The gateway, sales, and inventory services each own a separate database, so the
order workflow (sales) and default warehouse (inventory) are set up **after** the
gateway transaction commits. Two durable `ReconciliationRecord` rows are written
and then fired best-effort by `drainOnboardingReconciliation`:

- `APPLY_ORDER_WORKFLOW` → `POST sales /api/order-workflows` with
  `{ templateId: "workflow.grocery_delivery", setDefault: true }`.
- `SEED_DEFAULT_WAREHOUSE` → `POST inventory /api/warehouses` with
  `{ name: "Main", location: <tenant name> }`.

If a downstream service is briefly unavailable the tenant is still created and
usable; the failed record stays `PENDING`/`FAILED` and is retryable via
`POST /api/reconciliation/:id/retry`.

## 2. Build the produce catalog

Create categories (Fruits, Vegetables, Leafy Greens, …) — `ProductCategory` is a
tenant-scoped self-referencing tree, nothing is hardcoded to a vertical.

For each item set the sell-by-weight and perishability fields on the product
(`POST inventory /api/products`):

```json
{
  "sku": "VEG-TOMATO",
  "name": "Tomato (loose)",
  "unit": "kg",
  "sellByWeight": true,
  "pricingBasis": "PER_WEIGHT",
  "pricingUom": "kg",
  "baseRate": 40,
  "pluCode": "4664",
  "reorderLevel": 5,
  "trackBatches": true,
  "shelfLifeDays": 4
}
```

- `sellByWeight` / `pricingBasis = PER_WEIGHT` → the storefront shows a
  weight quantity selector (steps of 0.25, unit suffix) and the cart accepts
  fractional quantities such as 0.5 kg.
- `trackBatches = true` → stock is lot-tracked with expiry and consumed FEFO.
- `shelfLifeDays` → used to auto-compute a lot expiry on receipt when none is given.

## 3. Receive stock (perishable lots)

`POST inventory /api/stock/receive`:

```json
{
  "reference": "GRN-1001",
  "items": [
    { "productId": "...", "warehouseId": "...", "quantity": 25,
      "batchNo": "LOT-A", "expiryDate": "2026-11-01T00:00:00.000Z" }
  ]
}
```

For `trackBatches` products this creates/updates a `StockBatch` and tags the
`IN` movement with its `batchId`. `batchNo`/`expiryDate` are optional — when
omitted, the batch is grouped by day and expiry is derived from `shelfLifeDays`.
The aggregate `WarehouseStock.quantity` remains the source of truth for totals.

## 4. Sell, pick FEFO, and manage expiry

- Orders carry fractional line quantities end to end (`SalesOrderItem.quantity`
  is a float).
- On deduction (`POST inventory /api/stock/deduct`) a batch-tracked product is
  consumed **First-Expired-First-Out**: oldest-expiring lots first, one `OUT`
  movement per lot for traceability. If the lots fall short of the aggregate
  pool (e.g. after a direct adjustment), the uncovered remainder is recorded as a
  single non-lot `OUT` rather than failing the shipment.
- Near-expiry / expired lots: `GET inventory /api/stock/expiring?withinDays=3`
  (markdown planning). `POST inventory /api/stock/expiring/sweep` writes off
  expired lots (zeroes them, flags `isExpired`, and decrements the aggregate with
  an `ADJUSTMENT` movement). Run the sweep on a schedule (cron / agent hook).

## Capability summary

| Need                         | Supported by                                              |
| ---------------------------- | --------------------------------------------------------- |
| Per-kg / sell-by-weight      | `Product.sellByWeight`, `pricingBasis=PER_WEIGHT`, `baseRate`, `pricingUom`, `pluCode` |
| Fractional cart & orders     | measured-aware cart guard, `SalesOrderItem.quantity: Float` |
| Fruit/veg categories         | `ProductCategory` tenant-scoped tree                      |
| Perishability / expiry / FEFO| `Product.trackBatches`/`shelfLifeDays`, `StockBatch`, deduct FEFO, expiry sweep |
| Grocery delivery flow        | `workflow.grocery_delivery` applied at onboarding         |
| Storefront, delivery, COD/UPI| customer PWA, delivery app, existing payment methods      |
