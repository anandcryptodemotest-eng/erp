# Sankalp Service SRP Catalog

**Status:** Accepted (ADR 0020)  
**Last updated:** 2026-08-14  
**Cursor rule:** [`.cursor/rules/service-srp.mdc`](../../.cursor/rules/service-srp.mdc)

Architecture follows **product workload and ownership**, not microservice count. A process exists because it owns a business capability and has an independent reason to change.

## Three kinds of thing

| Kind | Owns | Examples |
|------|------|----------|
| **Domain service** | Business truth + its Postgres | Sales → SalesOrder; Accounting → Invoice; Inventory → Stock |
| **Gateway capability** | Platform behavior (may share `erp_gateway`) | Identity, Tenant, License, Notification, Communication, Assets |
| **Shared package** | Reusable types / pure functions — **not** business rows | `@erp/documents`, `@erp/tax-india`, `@erp/notifications`, `@erp/auth`, `@erp/ui` |

Do not turn a package into an `apps/*` process. Do not put domain tables in Gateway because Gateway is the public entry point.

## Runtime

```text
Customer / POS / Delivery-app / Platform / Admin
                    │
                  nginx :443
                    │
              Gateway :3010
         identity + BFF + hosted capabilities
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
  Sales         Inventory      Accounting
     │              │              │
     ▼              ▼              ▼
Procurement      Delivery          HR
```

Browser and future mobile call **Gateway (or same-origin BFF) only**. Never `localhost:3001`–`3006` from a UI.

## Introducing a new `apps/*`

A service **may** be introduced when it has:

1. A distinct business capability and data ownership, and
2. A justified independent lifecycle (own deploy/failure domain).

Independent failure isolation and **more than one consumer strengthen the case but are not required**. A legitimate bounded service may start with a single client.

**Not** sufficient: a cleaner diagram, a port in `packages/config`, or “we might scale later.”

**Do not** add a backlog item whose only job is extraction.

Gateway **may temporarily host** a platform capability that does not yet justify an independent lifecycle. That capability must still have:

- An explicit owner boundary (what it owns / does not own)
- A stable caller contract (package + HTTP path)

Gateway is not a miscellaneous dump.

## Hard rules

1. **New table → owning service** (see table map below). If unclear, stop and pick an owner.
2. A domain service may expose APIs to other services. It **must never** depend on another domain’s database. Cross-domain data access is **service contracts only**.
3. One Prisma schema per domain process. Never import another app’s Prisma client.
4. Side effects (notify, audit) after the business transaction. Do not block SO confirm on WhatsApp.
5. Sync `ServiceClient` + `SERVICE_SECRET` for required consistency. No Kafka until a saga needs a bus ([ADR 0016](../adr/0016-gateway-boundaries.md)).
6. New `apps/<name>` requires an ADR and a workload trigger.

## Table → owner

| Table / concept | Owner |
|-----------------|--------|
| Tenant, User, license, OTP, FCM token, in-app inbox | Gateway |
| Customer, SalesOrder, SREQ, Quote, Lead, SO workflow | Sales |
| Product, stock, warehouse, price list | Inventory |
| Invoice, Payment, journal, credit/debit note | Accounting |
| Vendor, PurchaseOrder | Procurement |
| DeliveryAssignment, zone | Delivery |
| Employee, payroll input, leave | HR |

## Domain services

### Sales `:3001` — `erp_sales`

**SRP:** Demand capture and order orchestration.

**Owns:** Customer, addresses, Lead, Opportunity, Quote, SalesRequest, SalesOrder, lines, returns, order documents, SO workflow runtime (`workflow-runtime-v5`).

**Does not own:** Product/stock; Invoice/Payment; DeliveryAssignment; User identity. Must not call Fast2SMS/SMTP/Telegram.

**Talks to:** Inventory (reserve/release/deduct); Accounting (invoice once); Gateway Notification via `@erp/notifications`.

### Inventory `:3002` — `erp_inventory`

**SRP:** Catalog and stock quantities.

**Owns:** Brand, category, product, variant, attributes, price lists, BOM, warehouse, stock, reservations, movements.

**Does not own:** CRM customer; invoices; PO headers (Procurement owns PO; Inventory receives stock).

**Talks to:** Called by Sales and Procurement.

### Accounting `:3003` — `erp_accounting`

**SRP:** Money in the tenant books.

**Owns:** Chart of accounts, journals, Invoice, Payment, credit/debit notes, AP bills, cash shifts, tax amounts snapshotted on documents.

**Does not own:** Tax **engine** (`@erp/tax-india`); SalesOrder; stock. NIC mode lives in tenant settings (Gateway); Accounting calls the adapter.

**Talks to:** Sales, Procurement, HR (payroll journals fail-closed); Notification contract for future dunning.

### Procurement `:3005` — `erp_procurement`

**SRP:** Buy-side.

**Owns:** Vendor, ProductVendor, VendorRequest, PurchaseOrder, PurchaseReturn.

**Does not own:** Stock (Inventory after GRN); AP bills (Accounting). Outbound RFQ uses the Notification contract.

**Talks to:** Inventory (receive); Accounting (AP).

### Delivery `:3006` — `erp_delivery`

**SRP:** Last-mile assignment of an already-confirmed SO.

**Owns:** DeliveryZone, DeliveryAssignment, tracking, earnings.

**Does not own:** SalesOrder as source of truth; Employee master; Invoice.

**Talks to:** Sales (completion sync); optional Notification contract.

### HR `:3004` — `erp_hr`

**SRP:** People and payroll **inputs**. Not Trustwood GA-critical; still bounded.

**Owns:** Employee, leave, tax slabs, PayrollRecord, Payslip.

**Does not own:** Journals/payments. Payroll must not complete if Accounting post fails.

## Gateway `:3010` — `erp_gateway`

**SRP:** Tenant identity, licensing, edge BFF, and **hosted platform capabilities** that do not yet justify their own process.

**Owns:** User, credentials, sessions, Tenant, licenses, settings, branches; OTP (login Fast2SMS only); in-app Notification + FCMToken; outbound NotificationDelivery + channel secrets; Communication (chat); Assets; SaaS billing; tenant audit; banners/coupons; Admin UI host; BFF rewrites.

**Does not own:** Customer, SalesOrder, Product, Stock, Invoice, Vendor, Employee, DeliveryAssignment. Does not calculate GST. Does not run SO workflow.

### Hosted capabilities (explicit, not miscellaneous)

| Capability | Contract | Extract when |
|------------|----------|----------------|
| Identity / OTP | `/api/auth`, Fast2SMS OTP | Never into Notification. Login must not depend on a Notification process. |
| Notification (outbound) | `@erp/notifications`, `POST /api/notifications/send` | Template library + DLT SMS + WhatsApp utility templates + AR dunning + queue/retry/history. Then `:3012` behind Gateway BFF. **No extraction-only BL.** |
| Communication (chat) | `/api/communication/*` | Scale requires a dedicated process ([ADR 0017](../adr/0017-communication-platform-capability.md)). Not port 3008 (POS). |
| Assets | AssetRef / `/api` uploads | Shared store; do not fork per domain. |
| SaaS billing | Gateway billing models | Sankalp-the-vendor billing, not dealer AR. |

`ModuleId "communication"` is a **nav/license key**, not a deployed microservice. POS is `:3008`.

## Channel UIs (no Postgres)

| App | Port | Role |
|-----|------|------|
| Customer | 3007 | Buyer portal |
| POS | 3008 | Counter UI; bills/shifts persist in Accounting |
| Delivery-app | 3009 | Driver UI |
| Platform | 3011 | Sankalp operator UI; APIs stay on Gateway |
| Gateway Admin | 3010 | Tenant admin host |

Future mobile: Mobile → Gateway → same domain APIs. Do not invent mobile-specific business services.

## Shared packages

| Package | Role |
|---------|------|
| `@erp/notifications` | Send command / channels — callers stay unaware of host process |
| `@erp/communication` | Chat types/events |
| `@erp/tax-india` | GST calculation |
| `@erp/documents`, `@erp/document-designer` | Render + Studio |
| `@erp/workflow`, `@erp/process-designer` | Types + canvas; **runtime today is Sales** |
| `@erp/auth`, `@erp/ui`, `@erp/logger`, `@erp/config` | Auth, UI, ops |

New domain logic goes in the owning **app** unless two services need the same pure function.

## Commercial spine

```text
Capture (SREQ / walk-in SO / Quote)
        ↓
   Sales Order (Sales)
        ↓
 Inventory reserve / Delivery assign
        ↓
   Invoice (Accounting)
        ↓
   Payment / AR (Accounting)
```

Notification is a side effect of those steps, not a step that owns the order.

## Anti-patterns

- New `apps/notification` or `apps/communication` because a registry row exists
- OTP via a Notification process (`Login → Notification → SMS → Login`)
- Fast2SMS/SMTP clients inside Sales or Accounting
- `Customer` on Gateway because “users live there”
- `Invoice` on Sales because “it comes from an order”
- Accounting reading `erp_sales` Postgres (must call Sales API)
- Sales reading `erp_inventory` Postgres (must call Inventory API)
- Extraction-only backlog items
- Dumping unrelated tables into Gateway “until we split”
