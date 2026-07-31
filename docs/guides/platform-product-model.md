# Platform product model (v1.0)

Frozen Platform v1.0 catalog architecture. Trading/distribution default: **SIMPLE SKUs** created from one **Create Product** experience. **VARIANT** remains optional on **Edit** for retail-style parent/child families.

There is **no** ProductDefinition module and **no** user-facing Generator. Expansion of attribute configurations is an internal engine concern.

## Catalog

What the tenant manages under Catalog / Products:

| Entity | Role |
|--------|------|
| **Products** | Operational SKUs — stock, quotes, orders, procurement |
| **Categories** | Classification; scopes which attributes apply |
| **Brands** | Brand identity; part of duplicate fingerprint |
| **Attributes** | Typed fields on products; `isIdentity` marks identity axes |
| **Price Lists** | List/channel pricing overlays (commercial) |

```text
                    Catalog
┌────────────────────────────────────────────────────┐
│  Products · Categories · Brands · Attributes       │
│  Price Lists                                       │
└──────────────────────┬─────────────────────────────┘
                       ▼
              Operational use
┌────────────────────────────────────────────────────┐
│  Stock · Quotes · Orders · Procurement · OMS       │
└────────────────────────────────────────────────────┘
```

## Ownership matrix

| Component | Owns | Never owns |
|-----------|------|------------|
| **Product** (operational SKU) | SKU, name, brand, category, attributes, pricing/cost, structure | Quote math |
| **ProductAttributeDefinition** | Data type, options, `isIdentity` | Stock, orders |
| **ProductCreationEngine** | Analyze → CreatePlan → Persist (1..N SKUs) | Customer browse |
| **`@erp/pricing`** | Quote / line calculation (incl. create preview prices) | Product identity |
| **Warehouse** | Physical stock | Attribute rules |

## Create Product (frozen UX)

Admin **Products** → **+ New Product** opens one **Create Product** editor organized by **business domains**:

```text
Identity → Commercial → Configuration → Pricing → Inventory → [Optional Settings] → Preview → Create
```

| Section | Contents |
|---------|----------|
| **Identity** | Category, Brand, Product Name |
| **Commercial** | **Media** (gallery), Display Name, Description, Display Group |
| **Configuration** | Category attribute options (not labeled “Attributes”) |
| **Pricing** | Basis, price/rate, Price Variation |
| **Inventory** | Cost, Opening Stock, Reorder (same values for every product in the batch) |
| **Optional Settings** | Name/SKU/Barcode templates (collapsed) |
| **Preview** | Primary media + Display Name + product checklist |

- **Product Name** auto-suggests progressively (brand + category + single-valued configuration); multi-valued dimensions are omitted from the family title. Manual edit → touch-guard.
- **Display Name** (`groupName`) tracks Product Name by default; shown in Customer Portal.
- **Display Group** (`groupCode`) auto-slug; editable under Commercial.
- **Media** uses shared `ProductMediaGallery` (Create + Edit). API body: `media: { images: string[] }` → persisted as `Product.imageUrls` on **every** SKU in the batch (v1 denormalization; commercial concern, not warehouse identity).
- Helper: “These images will be shared by all products created here.”
- **Preview** anchors on the primary image. CTA always **Create**.

### API

```http
POST /api/products/preview   → CreatePlan (no persist)
POST /api/products           → façade
```

- Body with **`axes`** (configuration key → selected values) → **ProductCreationEngine** (AnalyzeRequest → BuildCreatePlan → Validate → Persist).
- Engine accepts `media`, `description`, `costPrice`, `reorderLevel`, `openingStock` (opening stock received after create).
- Classic single-SKU body (sku + name + …) remains supported for integrations.
- `POST /api/products/generate*` is a **compat** wrapper around the same engine — not a user-facing concept.

CreatePlan shape:

```json
{ "total": 8, "create": 7, "skip": 1, "invalid": 0, "warnings": [], "products": [/* status, sku, name, unitPrice */] }
```

## Identity and duplicates

### `isIdentity` on attributes

`ProductAttributeDefinition.isIdentity` — when true, the attribute participates in **identity fingerprint** checks. Mark grade / thickness / size (or equivalent) as identity when they change stockable identity.

### Fingerprint (no stored `configKey`)

Duplicate detection uses a **computed fingerprint** of **brand + `isIdentity` attribute values**. It is **not** persisted on Product — computed in the creation engine Analyze phase.

- Same brand + same identity attr values → skip (already exists) on create plan; reject on classic single create/update.
- SKU uniqueness remains a separate constraint.

## Product structure

| Value | Meaning |
|-------|---------|
| `SIMPLE` | One stockable identity (create default) |
| `VARIANT` | Optional parent + physical child SKUs (set on **Edit**) |

```text
VARIANT: Variant → Warehouse → Quantity
SIMPLE:  WarehouseStock.variantId is null (one row per product+warehouse)
```

## Pricing

- Live commercial fields live on **Product** (`pricingBasis`, `pricingUom`, `baseRate`, `sellPrice`, etc.).
- **`@erp/pricing`** powers create Preview measured quotes and customer quotes.
- Customer path: **resolve SKU first**, then quote.

### Pricing Policy (Create Product)

Create Product carries a first-class **PricingPolicy**. The engine calls `resolve(row)`; Preview and Persist share one **CreatePlan**.

```ts
pricingPolicy: {
  type: "SAME" | "CONFIGURATION",  // roadmap: FORMULA | PRICE_LIST | CUSTOMER | BRANCH | PROMOTION
  basePrice: number | null,        // commercial starting price (PER_EACH)
  attribute?: string,              // when CONFIGURATION
  values?: Record<string, number>,
  overrides?: Record<string, number>
}
```

**UI (PER_EACH):** Base Price + Price Variation (Same vs Different by configuration) + **Price varies by** field matrix.  
**UI (PER_AREA / measured):** Rate only — no variation block; all SKUs share `baseRate`.

Resolution order: row override → configuration value → `basePrice`. Preview shows provenance (Base / Configuration / Manual Override / Measured).

## Catalog Service (customer browse)

Customer storefront does **not** invent a second product master. The **Catalog Service** orchestrates browse → configure → **resolve SKU** over operational Products.

| Field | Role |
|-------|------|
| **`groupCode`** (Display Group) | Stable commercial group key (e.g. `CENTURY-BWP`). Optional; `null` = standalone. |
| **`groupName`** | Customer-facing group title |

```http
GET  /api/catalog/groups
GET  /api/catalog/groups/:groupCode
POST /api/catalog/resolve
```

**Selection Completeness:** Add to Cart only when selection uniquely identifies one operational SKU.

## Out of scope (v1.0 freeze)

- **ProductDefinition** — removed
- User-facing **Generator** / Single vs Multiple chooser — replaced by Create Product editor + ProductCreationEngine

## Platform freeze (one of each)

- One Product entity (operational SKU)
- One Create Product experience
- One Product API (`POST /api/products` + preview)
- One ProductCreationEngine
- One Commercial Catalog layer
- One Pricing Engine
- One Inventory / OMS model

## Roadmap

| Phase | Capability |
|-------|------------|
| **1** | Product CRUD + categories / brands / attributes |
| **2** | Create Product editor + ProductCreationEngine (this freeze) |
| **2b** | Catalog Service: group browse → resolve SKU |
| **3** | Templates, imports, governance (same engine pipeline) |
| **4** | Configurable / CPQ → always resolve to a stockable Product SKU |
| **5** | PIM: rich content, media, multilingual, channel syndication |

## Related

- [Pricing engine](./pricing-engine.md)
- [Inventory costing](./inventory-costing.md)
