# Inventory costing

Inventory cost is **independent** of `@erp/pricing`. Valuation and COGS never go through the commercial quote pipeline.

## Product fields

| Field | Required? | Role |
|-------|-----------|------|
| `costPrice` | Recommended, not mandatory | COGS baseline in **inventory units** (e.g. ₹ per sheet). `null` = unknown. |
| `sellPrice` | Required for `PER_EACH`; **`null` for measured** | Fixed list price, or “no fixed sell price” when quotes use `baseRate` |
| `costingMethod` | Yes (default `MANUAL`) | How `costPrice` is maintained — Admin UI shows Manual only in v1 |
| `reorderLevel` | Optional (default 10) | Low-stock alerts |
| Opening stock | Optional (default 0) | Create-only opening balance |

**Valuation (v1):** when cost is known, `onHandQty × costPrice`. If cost is null: show “Inventory valuation unavailable” — do not invent a cost.

## Cost at product creation

Allow blank/`null` (or explicit `0`) so catalogs can be built before purchase cost is known (new SKU, supplier import, dropship, pre-procurement).

Warn in UI when cost is missing:

- Inventory valuation unavailable  
- Margin cannot be calculated until cost is entered  

Require a real cost before operations that depend on it (valuation reports, margin), not before creating the SKU.

## CostingMethod

```ts
enum CostingMethod {
  MANUAL            // v1 — user sets costPrice
  LAST_PURCHASE     // later — latest receipt updates cost
  WEIGHTED_AVERAGE  // later — WAC after each receipt
  FIFO              // later — cost layers
}
```

Stored on `Product.costingMethod` (default `MANUAL`).

UI labels non-manual options as **Coming Soon**; until engines exist, cost is always edited manually regardless of selected method.

```text
Create Product → (optional) Cost → Initial Stock 0
       → Purchase Receipt → Inventory updated
       → Cost updated (future: per costing method)
```

Sell path stays independent: Product → Pricing Engine → Quote → Sales Order. OMS joins both for margin via snapshots.

## OMS margin

Commercial sell (`unitPrice` from quote) and operational cost (`purchasePrice` on the order line) meet in OMS. Prefer the order snapshot over “today’s” product `costPrice` after later cost changes.

## Admin UI

**Products → Stock:** Cost Price (optional), Costing method, Reorder Level, Initial Stock (create only).

**Products → Pricing:** sell quotes only — never writes inventory cost.
