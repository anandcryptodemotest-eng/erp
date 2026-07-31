# Pricing engine (`@erp/pricing`)

Cross-cutting commercial pricing. Sales, Inventory, OMS, and customer apps **call** the engine — they do not own pricing logic.

**UI never calculates prices.** Admin, OMS, Quotes, and future surfaces only:

1. Collect inputs  
2. Call `POST /api/pricing/quote`  
3. Render the returned breakdown  
4. Allow authorized override  
5. Persist the pricing snapshot  

All measure resolution, UOM conversion, rate ladder, strategy, and rounding stay in `@erp/pricing`.

Tax is **outside** this engine (fiscal value vs commercial value).

## Cost vs sell (frozen architecture)

Inventory cost and commercial pricing are **independent**. `@erp/pricing` never reads `costPrice` or `costingMethod`.

```text
Commercial Pricing (@erp/pricing)     Inventory
  → Customer sell quote                 → costPrice / costingMethod
                                        → Valuation (qty × cost)
OMS meets both via snapshots (unitPrice + purchasePrice) for margin — not live catalog cost.
```

| Field | Domain | Example (plywood) |
|-------|--------|-------------------|
| `baseRate` | Sell | ₹50 / sq_ft |
| Quote `unitPrice` | Sell | ₹1,600 / sheet |
| `sellPrice` | Catalog / soft-fallback | Display or OMS soft fail |
| `costPrice` | Inventory COGS (optional until known) | ₹1,100 / sheet or null |
| `costingMethod` | Inventory | `MANUAL` (v1) |

See [`inventory-costing.md`](inventory-costing.md) and [`platform-product-model.md`](platform-product-model.md).

## Pipeline

```text
PricingContext
  → MeasureResolver (+ UnitConverter)
  → RateResolver
  → StrategyRegistry → PricingStrategy
  → RoundingPolicy
  → PriceQuote + PricingSnapshot
```

## Bases

| Basis | Industries |
|-------|------------|
| `PER_EACH` | Discrete units |
| `PER_AREA` | Plywood, tiles, glass, fabric (area) |
| `PER_WEIGHT` | Steel, chemicals |
| `PER_VOLUME` | Paint, concrete, chemicals |
| `FORMULA` / `CUSTOM` | Stubbed in v1 (register later) |

## Where to configure in Admin UI

**Products → Pricing**

1. Pricing Basis  
2. For `PER_EACH`: Sell Price (per each) only  
3. For measured bases: Pricing UOM + Rate per {UOM} (no list sell price in Admin — stored as `null`)  
4. **Pricing Preview** — short quote API summary only  

Measured products use `sellPrice: null` (“no fixed list price”), not `0` (which would mean free). Quotes use `baseRate` + measure.

The Admin Pricing form is **basis-driven**: for `PER_EACH`, Pricing UOM and rate are hidden (values preserved in the client until save, then normalized to `pricingUom: each`, `baseRate: null`). Measured bases reveal UOM + **Rate per {UOM}**.

**Products → Stock** (ops — not pricing)

- Cost Price (₹ per inventory unit)  
- Costing method (`MANUAL` …)  
- Reorder level / initial stock  

Basis validation blocks save when measures are missing (e.g. `PER_AREA` without size/area derivation).

Product list shows a small badge (`PER_AREA` or `₹50 / sq_ft`) when not each-priced.

**OMS / Quotes**

Adding a catalog line calls the quote API and seeds `unitPrice` from the response. OMS does not know how the price was calculated.

## API

### Saved product

```http
POST /api/pricing/quote
{ "productId": "…", "quantity": 2, "attributes": { "size": "8x4" } }
```

### Unsaved product editor (`draftProduct`)

```http
POST /api/pricing/quote
{
  "productId": null,
  "draftProduct": {
    "pricingBasis": "PER_AREA",
    "baseRate": 50,
    "pricingUom": "sq_ft",
    "sellPrice": 1600,
    "categoryId": "…",
    "attributes": { "size": "8x4" }
  },
  "quantity": 1
}
```

Provide **exactly one** of `productId` or `draftProduct`.

Success: `{ "data": { "quote", "snapshot" } }`  
Hard failure (invalid config): `400` `{ "error": "…" }` — UI blocks the action.  
Soft failure (service down / 5xx): UI may fall back to `sellPrice` and show a warning.

## Plywood example

- Size attribute `8x4` with `sizePattern: "{L}x{W}"`, `measureUnit: ft`
- `pricingBasis: PER_AREA`, `pricingUom: sq_ft`, `baseRate: 50`
- Qty 2 sheets → area 32 × rate 50 = **₹1600 / sheet**, `resolvedQuantity = 64` sq ft, line **₹3200**

## Rate resolution (v1)

Price list (minQty) → product/variant `baseRate` → `sellPrice` (PER_EACH only)

**Future ladder (documented):** Contract → Customer → Group → Channel → Branch → Price list → Product → Default

## Snapshot on sales orders

When seeding an order line, always persist under `customSnapshot.pricing`:

- `pricingSnapshot` (full engine snapshot)  
- `pricingEngineVersion`  
- `quoteTimestamp`  
- `quotedUnitPrice`  

If the user later overrides `unitPrice`, keep the original snapshot and set `overridden: true`.

## Rounding

v1: currency minor units (2 dp). Future policies (nearest / up / down / bankers) plug in as `RoundingPolicy` without changing strategies.

## Package layout

`packages/pricing/src/{context,measures,converter,rates,strategies,registry,rounding,snapshots}`

## Later (not in v1 UI)

- Client-side quote response cache until pricing-relevant inputs change  
- Customer portal / cart / procurement — same quote API only  
