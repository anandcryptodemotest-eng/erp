# Sales channels matrix (ERP Platform v1.0)

Canonical trading path vs secondary channels. User-facing desk name: **Sales Desk** (`/sales-desk`; `/oms` redirects).

| Channel | Route / surface | Document created | When to use |
|---------|-----------------|------------------|-------------|
| **Sales Desk** | `/sales-desk` | Converts **SREQ → SO**; runs workflow tasks | Trading / distribution (canonical) |
| **Customer portal** | `apps/customer` checkout | **Sales Request (SREQ)** only | Buyer self-serve intent |
| **Orders (counter)** | `/orders` | Staff **SalesOrder** DRAFT / Quick Sale | Counter / grocery-style staff create |
| **Quotes (CRM)** | `/quotes` | CRM **Quote** → optional SO | Lead-to-Cash (nav collapsed by default) |
| **POS** | `apps/pos` billing | **Bill** (accounting) — not SalesOrder | Retail till |

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
- **CRM Quote** — `Quote` entity in sales DB (optional sales-cycle document).

## Workspace vs Studio

Sales Desk uses **Workspace Framework** (queue → work → complete). Product create uses **Studio Framework** (draft → preview → create). Same cleanliness; different shells.

See [ADR 0014](../adr/0014-erp-ui-framework-classification.md), [TRADING-JOURNEY.md](../TRADING-JOURNEY.md).
