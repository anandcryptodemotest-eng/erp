# Order Management System (OMS) — Requirements & Enterprise Product Attribute Design

> **Status:** Implementation in progress (Phase 1–4 core landed in codebase)  
> **Last updated:** July 2026  
> **Decision:** Extend existing ERP monorepo (do not create a separate OMS project)  
> **Related:** `docs/ARCHITECTURE.md`

### Implementation checklist (code)

| Area | Status | Location |
|------|--------|----------|
| Hybrid attributes schema + validation | Done | `apps/inventory` — `ProductAttributeDefinition`, `customAttributes`, index |
| Industry templates (plywood/steel/apparel) | Done | `GET/POST /api/attribute-templates` |
| Attribute admin UI | Done | Gateway `/attributes` |
| ProductVendor + WhatsApp RFQ | Done | `apps/procurement` — `/api/product-vendors`, `/api/vendor-requests` |
| OMS order lifecycle actions | Done | `PATCH /api/orders/:id?action=submit\|review\|verify-stock\|…` |
| OMS workflow UI | Done | Gateway `/oms` |
| Branch model | Schema + API | `apps/gateway` — `Branch`, `/api/branches` |
| Fine-grained permission matrix UI | Pending | Roles still string-based |
| Real WhatsApp Business API | Pending | Deep-link + message queue stub |
| Blob file storage (S3/R2) | Pending | Document URL upload only |
| Native mobile apps | Pending | Web/PWA first |

**Apply DB schemas locally:** from each app run `pnpm run db:push` (inventory, sales, procurement, gateway).

### UI placement (July 2026)

Custom attributes are **not** a separate sidebar module. They live under **Products**:

1. **Products → Custom fields** — apply industry pack (Plywood/Steel) or add a field  
2. **Products → Catalog → New Product** — pick category → Thickness / Size / Grade appear on the same form  

Values store in `Product.customAttributes`; definitions stay in `ProductAttributeDefinition`.

### Order lifecycle (configurable workflows)

Do **not** add customer-specific statuses in global enums. Use templates:

| Template ID | Code | Use when |
|-------------|------|----------|
| `workflow.oms_trading` | OMS_TRADING | Manual stock, vendor WhatsApp, pricing, dispatch |
| `workflow.grocery_delivery` | GROCERY_DELIVERY | Confirm → pickup → delivery → invoice |

**Models:** `OrderWorkflow`, `OrderWorkflowStep` (sales DB, tenant-scoped).  
**APIs:** `GET/POST /api/order-workflows`, `GET /api/order-workflows/templates`.  
**Orders:** `workflowId` set from tenant default; `PATCH ?action=` gated by workflow steps; `GET /api/orders/:id` returns `nextActions`.  
**UI:** OMS page → apply / switch template; action buttons rendered from config.


---

## Table of Contents

1. [Objective](#1-objective)
2. [Architecture Fit Decision](#2-architecture-fit-decision)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Enterprise Product Attribute Design](#5-enterprise-product-attribute-design) ← **core generalization**
6. [Industry Templates (Seed Packs)](#6-industry-templates-seed-packs)
7. [Order Lifecycle & State Machine](#7-order-lifecycle--state-machine)
8. [Vendor, Pricing, Dispatch](#8-vendor-pricing-dispatch)
9. [RBAC & Branch Model](#9-rbac--branch-model)
10. [API Outline](#10-api-outline)
11. [Notifications & Reports](#11-notifications--reports)
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Objective

Digitize the full order lifecycle for businesses that today manage inventory manually and communicate with vendors over WhatsApp.

**Scope:** Order creation → sales review → stock verification → vendor WhatsApp RFQ → pricing → dispatch → delivery → acknowledgement → closure.

**Clients:** Multi-tenant SaaS. Each organization (tenant) may sell completely different product types (plywood today, steel/chemicals/apparel tomorrow) without code or schema redeploys.

---

## 2. Architecture Fit Decision

| Question | Answer |
|----------|--------|
| Fit current ERP? | **Yes** (~65–70% foundations exist) |
| New separate project? | **No** |
| Approach | Extend `sales`, `inventory`, `procurement`, `delivery`, `gateway`; add `integrations` for WhatsApp + file storage |

**Reuse:** `SalesOrder`, `Product`, `Vendor`, delivery assignment, tenant JWT auth.  
**Add:** Branch, fine RBAC, OMS status stages, product attribute registry, product↔vendor map, WhatsApp RFQ, document upload.

---

## 3. Functional Requirements

### 3.1 Admin Hierarchy & Access Control

Configurable role-based hierarchy:

- Super Admin  
- Organization Admin  
- Branch Admin  
- Sales Executive  
- Pricing Executive  
- Dispatch Executive  
- Delivery Executive  
- Viewer  

Requirements: RBAC, configurable permissions, multi-branch, user assignment, audit log, approval history.

### 3.2 Product Management

See [Section 5](#5-enterprise-product-attribute-design) — hybrid fixed core + dynamic attributes.

### 3.3 Vendor Management

Each product can have multiple vendors.

| Field | Notes |
|-------|--------|
| Vendor Name | Required |
| Contact Person | |
| Mobile / WhatsApp / Email | WhatsApp used for RFQ |
| Address | |
| Preferred Vendor | Flag |
| Lead Time | Days |
| Active Status | |

Support: product ↔ vendor mapping, multiple vendors per product, vendor priority.

### 3.4 Customer Order Flow

Order: customer, products, quantity, delivery address, notes.  
Statuses: `DRAFT` → `SUBMITTED`.

### 3.5 Sales Review

Sales Executive can change quantity, remove/add items, modify delivery date, add remarks.  
Track every modification.  
Statuses: `PENDING_SALES_REVIEW` → `REVIEWED`.

### 3.6 Stock Verification

No full WMS required initially. Sales enters available stock per line:

- Requested Qty  
- Available Qty  
- Shortage Qty (computed)  

On shortage: auto-generate WhatsApp message to mapped vendor(s). Keep message history.

### 3.7 Pricing

Pricing Executive enters purchase price, selling price, discount, tax, transportation, additional charges.  
System calculates subtotal, tax, grand total, margin.  
Statuses: `PRICING_PENDING` → `PRICING_COMPLETED`.

### 3.8 Delivery Preparation & Dispatch

Dispatch Executive: assign delivery person, vehicle, remarks, schedule.  
Dispatch: date, vehicle, driver, tracking number (optional), notes.  
Statuses: `READY_FOR_DISPATCH` → `DISPATCHED`.

### 3.9 Order Closure

Upload signed acknowledgement, delivery proof, optional invoice copy.  
Statuses: `DELIVERED` → `CLOSED`. Maintain document history.

---

## 4. Non-Functional Requirements

- Responsive Web, Android, iOS (start with web/PWA; native via Capacitor later)
- Cloud deployment, multi-branch, multi-organization
- Audit logs, notifications, WhatsApp integration
- File / image / PDF upload
- Scalable, high performance, secure authentication

---

## 5. Enterprise Product Attribute Design

### 5.1 The Problem

| Client | Industry | Example attributes |
|--------|----------|--------------------|
| Client A (today) | Plywood / timber | Thickness, Size, Grade, Brand, Vendor, Qty unit |
| Client B (tomorrow) | Steel | Grade, Diameter, Length, Finish, Weight |
| Client C | Apparel | Color, Size, Fabric, Gender, Season |
| Client D | Chemicals | Concentration, Pack size, Hazard class, CAS |

**Hard requirement:** One codebase. No per-client columns. No DB migration when a tenant adds “Thickness” or “CAS Number”.

### 5.2 Approaches Compared

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. Fixed product columns** | Simple SQL, fast reports | Every new industry needs schema change | Reject as sole model |
| **B. Pure EAV** (`attr_key` / `attr_value` rows) | Infinite flexibility | Slow filters, awkward reporting, type chaos | Reject as sole model |
| **C. JSON only** | Flexible, Postgres-native | Weak validation without a registry | Incomplete alone |
| **D. Hybrid (recommended)** | Indexed core + validated custom JSONB + definitions | Slightly more design | **Adopt** |

### 5.3 Recommended Architecture: Hybrid Attribute Platform

Think in **three layers**:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — UNIVERSAL PRODUCT CORE (same for every tenant)   │
│  sku, name, description, categoryId, brandId, unit,         │
│  costPrice, sellPrice, tax/HSN, barcode, isActive, images   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — ATTRIBUTE DEFINITION REGISTRY (per tenant)       │
│  Admin defines: key, label, dataType, options, validation,  │
│  scope (global / category), filterable, required, sortOrder │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — ATTRIBUTE VALUES (per product / variant)         │
│  customAttributes JSONB: { "thickness_mm": 18, "grade":"BWR"}│
│  + optional search index rows for hot filters               │
└─────────────────────────────────────────────────────────────┘
```

**Brand** and **Vendor** are **not** free-text custom fields — they are first-class entities (`Brand`, `Vendor`, `ProductVendor`). Qty belongs on **order/stock lines**, not as a product attribute definition (unless “standard pack qty”).

### 5.4 What Stays Fixed vs What Is Dynamic

| Concept | Storage | Why |
|---------|---------|-----|
| Name, SKU, Unit, Status | Fixed columns | Universal, always indexed |
| Brand | `Brand` FK | Shared master, not a string attribute |
| Category | `ProductCategory` FK | Tree + attribute templates attach here |
| Vendor(s) | `ProductVendor` M:N | Multiple vendors, priority, lead time |
| Tax / HSN / barcode | Fixed columns | Compliance & billing |
| Thickness, Grade, Size, Color, Material… | **Dynamic attributes** | Industry-specific |
| Order quantity | Order line | Transactional, not catalog |

**Plywood example mapping:**

| Client word | System model |
|-------------|--------------|
| Thickness | Attribute `thickness_mm` (NUMBER) on category Plywood |
| Size | Attribute `size` (TEXT or SELECT: 8x4, 7x3…) |
| Grade | Attribute `grade` (SELECT: MR, BWR, BWP…) |
| Brand | `brandId` → Brand |
| Vendor | `ProductVendor` links |
| Qty | Order / stock quantity |

### 5.5 Data Model

```prisma
// ── Attribute registry (tenant-scoped) ──────────────────────────

enum AttributeDataType {
  TEXT
  NUMBER
  BOOLEAN
  DATE
  SELECT        // single choice
  MULTI_SELECT  // multi choice
  UNIT_NUMBER   // number + unit (e.g. 18 mm)
}

model ProductAttributeDefinition {
  id              String   @id @default(cuid())
  tenantId        String
  key             String   // stable machine key: "thickness_mm" (immutable after create)
  label           String   // UI label: "Thickness"
  description     String?
  dataType        String   // AttributeDataType
  unit            String?  // "mm" | "inch" | "kg" — for UNIT_NUMBER / NUMBER display
  options         Json?    // ["MR","BWR","BWP"] for SELECT / MULTI_SELECT
  validation      Json?    // { "min": 1, "max": 50, "regex": "..." }
  isRequired      Boolean  @default(false)
  isFilterable    Boolean  @default(true)   // show in list filters
  isSearchable    Boolean  @default(false)  // include in full-text / search
  isVariantAxis   Boolean  @default(false)  // creates ProductVariant dimensions
  showOnLabel     Boolean  @default(false)  // print on invoice / packing slip
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  categoryLinks   AttributeCategoryLink[]
  // If no category links → applies to ALL products for this tenant (global)

  @@unique([tenantId, key])
  @@index([tenantId])
}

// Bind definitions to one or more categories (e.g. only Plywood)
model AttributeCategoryLink {
  id             String @id @default(cuid())
  tenantId       String
  attributeId    String
  categoryId     String
  isRequiredOverride Boolean? // optional override per category

  attribute ProductAttributeDefinition @relation(...)
  category  ProductCategory @relation(...)

  @@unique([attributeId, categoryId])
  @@index([tenantId, categoryId])
}

// ── Product values ──────────────────────────────────────────────

model Product {
  // ... existing universal core fields ...
  customAttributes Json @default("{}")
  // Example: { "thickness_mm": 18, "grade": "BWR", "size": "8x4" }

  // optional: attribute schema version for migrations of keys
  attributeSchemaVersion Int @default(1)
}

model ProductVariant {
  // existing attributes Json becomes the variant-axis slice of the same system
  attributes Json  // { "size": "8x4", "thickness_mm": 18 }
}
```

**Optional performance table** (only for filterable attributes under heavy load):

```prisma
model ProductAttributeIndex {
  id         String @id @default(cuid())
  tenantId   String
  productId  String
  key        String
  valueText  String?  // normalized string for equality filters
  valueNum   Float?   // for range filters (thickness 12–18)
  valueBool  Boolean?

  @@unique([tenantId, productId, key])
  @@index([tenantId, key, valueText])
  @@index([tenantId, key, valueNum])
}
```

Sync index rows on product create/update for definitions where `isFilterable = true`.

### 5.6 How the UI Works (Admin)

1. **Org Admin → Product Attributes**  
   Create definition: key `thickness_mm`, label `Thickness`, type `NUMBER`, unit `mm`, required, filterable.  
2. **Link to category** `Plywood` (or leave global).  
3. **Product form** loads definitions for the selected category and renders dynamic fields (no code change).  
4. **List / filter** shows filter chips for filterable attributes.  
5. **Tomorrow’s client** creates their own definitions (or applies an Industry Template) — same screens, different fields.

```
[ Category: Plywood ▼ ]

  Name *     [ Marine Ply 18mm        ]
  SKU *      [ PLY-BWR-18-8X4         ]
  Brand *    [ Greenply ▼             ]
  Unit *     [ sheet ▼                ]

  ── Category attributes (dynamic) ──
  Thickness (mm) *  [ 18     ]
  Size *            [ 8x4 ▼  ]
  Grade *           [ BWR ▼  ]

  ── Vendors ──
  [ + Add vendor ]  Preferred: Vendor A (priority 1)
```

Steel tenant sees Diameter / Length / Finish instead — **same form engine**.

### 5.7 Validation Rules

On product create/update:

1. Load definitions for `tenantId` + `categoryId` (category-linked ∪ global).  
2. Validate each `customAttributes` key against definition:  
   - unknown keys → reject (or strip, based on tenant setting)  
   - required missing → 400  
   - type mismatch → 400  
   - SELECT value not in `options` → 400  
   - NUMBER outside min/max → 400  
3. Persist JSONB + refresh `ProductAttributeIndex` for filterable keys.

### 5.8 Search, Filter, Reporting

| Need | Strategy |
|------|----------|
| Filter by grade = BWR | JSONB `@>` or `ProductAttributeIndex` equality |
| Thickness between 12–18 | Index `valueNum` range query |
| Product list columns | Core columns + selected `showOnLabel` / pinned attributes |
| Sales report by thickness | Join index table or `jsonb_to_record` in reporting views |
| Cross-tenant analytics | Only on universal core (SKU, category, brand, revenue) — never assume shared custom keys |

**Postgres example (JSONB):**

```sql
-- Equality
WHERE custom_attributes @> '{"grade":"BWR"}'::jsonb

-- Numeric range (prefer index table in production)
WHERE (custom_attributes->>'thickness_mm')::float BETWEEN 12 AND 18
```

### 5.9 Variants vs Attributes

| Use case | Model |
|----------|-------|
| Same product, sellable SKUs differ by size/thickness | `isVariantAxis = true` → generate `ProductVariant` rows |
| Spec that does not create a separate SKU | Product-level `customAttributes` only |

Plywood often: **one product family** + variants on `(thickness, size, grade)` **or** separate SKUs per combination — tenant chooses via `isVariantAxis`.

### 5.10 Industry Templates (Configuration, Not Code)

Ship **seed packs** as JSON. On tenant onboarding, Org Admin picks “Plywood / Timber”, “Steel”, “Apparel”, “Generic”, etc. System inserts `ProductAttributeDefinition` + optional categories — **zero code deploy**.

```json
{
  "templateId": "industry.plywood",
  "version": 1,
  "categories": [
    { "name": "Plywood", "attributes": ["thickness_mm", "size", "grade"] },
    { "name": "Blockboard", "attributes": ["thickness_mm", "size", "grade"] }
  ],
  "attributes": [
    {
      "key": "thickness_mm",
      "label": "Thickness",
      "dataType": "NUMBER",
      "unit": "mm",
      "isRequired": true,
      "isFilterable": true,
      "isVariantAxis": true,
      "validation": { "min": 3, "max": 50 }
    },
    {
      "key": "size",
      "label": "Size",
      "dataType": "SELECT",
      "options": ["8x4", "7x3", "6x3"],
      "isRequired": true,
      "isFilterable": true,
      "isVariantAxis": true
    },
    {
      "key": "grade",
      "label": "Grade",
      "dataType": "SELECT",
      "options": ["MR", "BWR", "BWP"],
      "isRequired": true,
      "isFilterable": true,
      "showOnLabel": true
    }
  ]
}
```

Steel template would define `diameter_mm`, `length_m`, `steel_grade`, `finish` — same loader.

### 5.11 Multi-Tenant Isolation Rules

1. Attribute definitions are **always** `tenantId`-scoped.  
2. Keys may collide across tenants (`grade` for plywood ≠ `grade` for steel) — that is fine.  
3. Never share definition IDs across tenants.  
4. Platform Super Admin may publish global templates; tenants copy on apply (not live-link) so customization does not break others.  
5. Reports and APIs must never assume another tenant’s keys exist.

### 5.12 Why Not Pure EAV or Pure Fixed

- **Fixed columns** force you to ship `thickness`, `diameter`, `color` for everyone — most columns null, migrations constant.  
- **Pure EAV** (`product_id, attr_id, value`) works for storage but makes “top products by thickness” and faceted search painful without rebuilding an index layer anyway.  
- **Hybrid** gives: relational integrity for universal ERP fields + JSONB flexibility + definition-driven UI/validation + optional index table for enterprise filter/report performance.

### 5.13 Migration Path from Current Schema

Current state (`apps/inventory`):

- `Product` — fixed commercial fields  
- `ProductVariant.attributes` — already `Json`  
- `Brand`, `ProductCategory` — exist  

**Steps:**

1. Add `ProductAttributeDefinition` + `AttributeCategoryLink`.  
2. Add `Product.customAttributes Json @default("{}")`.  
3. Align variant `attributes` keys with definitions where `isVariantAxis`.  
4. Add `ProductAttributeIndex` when filter volume requires it.  
5. Ship plywood template for first client; add steel/apparel templates as new tenants onboard.  
6. Keep Brand / Vendor as entities (do not move them into JSON).

### 5.14 Design Principles (Enterprise Checklist)

| Principle | Implementation |
|-----------|----------------|
| Configuration over code | Definitions + templates, not columns |
| Stable machine keys | `key` immutable; `label` editable |
| Strong typing | `dataType` + `validation` JSON |
| Category-scoped schemas | Same tenant, different categories, different forms |
| First-class masters | Brand, Vendor, Unit, Tax stay relational |
| Query performance | Core indexes + optional attribute index |
| Forward compatible | New tenant = new definitions, no deploy |
| Auditability | Log definition changes; product value diffs in OMS audit |

---

## 6. Industry Templates (Seed Packs)

| Template ID | Sample attributes |
|-------------|-------------------|
| `industry.plywood` | thickness_mm, size, grade |
| `industry.steel` | steel_grade, diameter_mm, length_m, finish |
| `industry.apparel` | color, size_apparel, fabric, gender |
| `industry.chemical` | concentration_pct, pack_size, hazard_class |
| `industry.generic` | (none — admin builds from scratch) |

Onboarding flow: Select template → Preview attributes → Apply → Optionally edit options (e.g. add grade `BB/CC`) → Create products.

---

## 7. Order Lifecycle & State Machine

```
DRAFT
  → SUBMITTED
  → PENDING_SALES_REVIEW
  → REVIEWED
  → STOCK_VERIFIED          (shortages may spawn VendorRequest)
  → VENDOR_REQUESTED        (optional; skip if no shortage)
  → PRICING_PENDING
  → PRICING_COMPLETED
  → READY_FOR_DISPATCH
  → DISPATCHED
  → DELIVERED
  → CLOSED

Any non-terminal → CANCELLED (with reason)
```

Reject paths may return to `PENDING_SALES_REVIEW` or `PRICING_PENDING` with remarks.

**Modification history:** every sales/pricing/dispatch change stored in `OrderModification` / audit log.

---

## 8. Vendor, Pricing, Dispatch

### Vendor

- `ProductVendor`: productId, vendorId, priority, isPreferred, leadTimeDays, isActive  
- Shortage → select preferred then next by priority → WhatsApp template via integrations service  
- Persist `VendorMessage` history (payload, status, timestamps)

### Pricing

Per order (or per line): purchase price, sell price, discount, tax, transport, additional charges → subtotal, tax, grand total, margin.

### Dispatch / Closure

Vehicle, driver, schedule, tracking number, documents (ack, proof, invoice).

---

## 9. RBAC & Branch Model

- Tenant = Organization  
- `Branch` under tenant; users assigned to one or more branches  
- Roles map to permission keys (`orders.review`, `orders.price`, `orders.dispatch`, …)  
- Viewer = read-only within assigned branch scope  

---

## 10. API Outline

```
# Attribute platform
GET/POST     /api/attribute-definitions
PATCH/DELETE /api/attribute-definitions/:id
POST         /api/attribute-definitions/apply-template
GET          /api/categories/:id/attribute-definitions

# Products (customAttributes validated server-side)
GET/POST     /api/products
GET/PATCH    /api/products/:id
GET          /api/products?filter[grade]=BWR&filter[thickness_mm][gte]=12

# Vendors
CRUD         /api/vendors
CRUD         /api/products/:id/vendors

# OMS orders
CRUD         /api/orders
PATCH        /api/orders/:id?action=submit|review|verify-stock|request-vendors|
             complete-pricing|ready-dispatch|dispatch|deliver|close
```

---

## 11. Notifications & Reports

**Notifications:** Sales Review Pending, Stock Shortage, Vendor Request Sent, Pricing Pending, Dispatch Pending, Delivery Completed, Order Closed.

**Reports:** Sales, Pending Orders (by stage), Stock Shortages, Vendor Requests, Dispatch Status, Closed Orders, Product-wise Sales, Customer-wise Orders.  
Faceted product reports use attribute index / JSONB only within a single tenant’s definition set.

---

## 12. Future Roadmap

1. Full inventory / WMS  
2. Barcode & QR  
3. Auto Purchase Orders from shortage  
4. Vendor portal  
5. Customer portal  
6. Online payments  
7. Analytics dashboard  
8. AI demand forecasting  
9. Auto vendor recommendation  
10. WhatsApp bot  
11. OCR for delivery acknowledgements  

---

## Appendix A — Plywood vs Steel (Same Engine)

| Concern | Plywood tenant | Steel tenant |
|---------|----------------|--------------|
| Template | `industry.plywood` | `industry.steel` |
| Category | Plywood | TMT Bars |
| Dynamic fields | thickness, size, grade | diameter, length, steel_grade |
| Brand | Greenply, Century | Tata, JSW |
| Vendors | Local timber yards | Mill distributors |
| Order flow | Same OMS state machine | Same OMS state machine |
| Code deploy needed? | **No** | **No** |

---

## Appendix B — Summary Decision

| Decision | Choice |
|----------|--------|
| OMS hosting | Extend current ERP monorepo |
| Product attributes | **Hybrid**: fixed core + definition registry + JSONB values (+ optional index) |
| Brand / Vendor | Relational masters, not JSON attributes |
| Qty | Order/stock lines, not product attribute |
| Multi-industry | Industry template seed packs per tenant |
| Per-client schema migrations | **Never** |

This is the enterprise pattern: **one product platform, many industry schemas, configured per tenant.**
