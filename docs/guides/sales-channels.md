# Sales channels matrix (ERP Platform v1.0)

Canonical trading spine: **Capture → Order → Fulfil → Invoice → Collect**. User-facing desk name: **Sales Desk** (`/sales-desk`; `/oms` redirects).

**Invariant:** Every fulfilment-bound Sales Order enters through `createConfirmedSalesOrder` and **SO_STANDARD**. Capture channels differ; OMS does not. Quick Bill is **not** fulfilment-bound.

| Channel | Route / surface | Document created | Workflow | When to use |
|---------|-----------------|------------------|----------|-------------|
| **Dealer portal** | `apps/customer` checkout | **SREQ** → convert **SO** (`sourceKind: SREQ`) | Convert → SO_STANDARD | Dealer places intent |
| **Walk-in SO** | Sales Desk → New walk-in order | **SO** CONFIRMED (`sourceKind: WALK_IN`) | SO_STANDARD immediately | Counter order, later pick/dispatch |
| **Walk-in pay-and-take** | `/quick-bill` | Quick Bill → Invoice (`sourceKind: QUICK_BILL`) | **None** | Cash and carry |
| **Lead / CRM** | `/leads` → `/opportunities` → `/quotes` | Lead → Opportunity → Quote → convert **SO** (`sourceKind: QUOTE`) | Convert → SO_STANDARD | Sales-driven selling |
| **POS** | `apps/pos` billing | **Bill** (accounting) — not SalesOrder | — | Retail till |

## Source / channel invariant

Fulfilment-bound create (`createConfirmedSalesOrder`) requires **exactly one** `sourceKind` and matching source reference:

| sourceKind | Required | Forbidden |
|------------|----------|-----------|
| `SREQ` | `salesRequestId` | `quoteId`, walk-in capture |
| `QUOTE` | `quoteId` | `salesRequestId`, walk-in capture |
| `WALK_IN` | existing `customerId` **or** walk-in name/phone | `salesRequestId`, `quoteId` |

`QUICK_BILL` never calls this service. Do not add `SO_WALKIN` / `SO_PORTAL` / `SO_QUOTE` templates.

Quote → SO: `POST /api/quotes/:id/convert` (ACCEPTED only, **idempotent**).

## Naming

| Layer | Name |
|-------|------|
| Navigation | Sales Desk |
| Route | `/sales-desk` |
| UI component | `SalesDeskWorkspace` |
| Backend | `apps/sales` |
| Compat | `/oms` → `/sales-desk` |

## “Quote” disambiguation

- **Price quote** — `POST /api/pricing/quote` via `@erp/pricing` (commercial resolve).  
- **CRM Quote** — `Quote` entity in sales DB; convert via `/api/quotes/:id/convert`.

## Workspace vs Studio

Sales Desk uses **Workspace Framework** (queue → work → complete). Product create uses **Studio Framework** (draft → preview → create). Same cleanliness; different shells.

See [ADR 0014](../adr/0014-erp-ui-framework-classification.md), [TRADING-JOURNEY.md](../TRADING-JOURNEY.md).
