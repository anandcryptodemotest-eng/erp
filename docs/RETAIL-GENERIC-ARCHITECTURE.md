# Generic Retail Architecture

Status: Design baseline for departmental store and grocery implementation
Scope: Departmental store POS, grocery retail, and hybrid retail tenants on one ERP foundation
Goal: Keep one generic architecture and let store profile, channel, and workflow decide behavior.

---

## 1) Core Decision

Departmental store should not be built as a separate product architecture.

It should run on the same generic retail foundation already present in this monorepo:

- gateway for auth, tenant, settings, notifications, coupons
- inventory for catalog, stock, warehouses, barcode, pricing
- sales for customers, orders, returns, CRM, online order orchestration
- accounting for POS bills, shifts, invoices, credit notes, payments
- hr for cashier, manager, and delivery staff identity
- delivery only when the tenant profile requires fulfillment beyond the counter

The architectural rule is simple:

- shared domains stay generic
- store profile changes workflow entry points
- channel changes UI and transaction lifecycle
- service ownership never changes by tenant type

---

## 2) Retail Profiles

Retail should be profile-driven, not codebase-driven.

### Suggested tenant retail profiles

| Profile | Primary channel | Typical examples | Fulfillment style |
|---|---|---|---|
| `DEPARTMENT_STORE` | POS first | fashion, home, electronics, general merchandise | counter sale, pickup, occasional home delivery |
| `GROCERY` | POS + online | grocery, fresh food, quick commerce | counter sale + scheduled or same-day delivery |
| `HYBRID_RETAIL` | all channels | supermarket + departmental + local delivery | POS + online + delivery |

### Suggested supporting dimensions

These should remain generic concepts across profiles:

- `sellingChannel`: `POS` | `ONLINE` | `B2B`
- `fulfillmentMode`: `COUNTER`, `PICKUP`, `DELIVERY`
- `customerType`: `WALK_IN`, `REGISTERED_RETAIL`, `B2B_ACCOUNT`
- `pricingContext`: walk-in price, offer price, price list, quote price
- `paymentMode`: `CASH`, `UPI`, `CARD`, `WALLET`, `SPLIT`, `COD`

These are architectural concepts first. They should drive implementation, routing, and reporting instead of creating departmental-only tables or services.

---

## 3) Generic Domain Ownership

The ownership model must remain stable across all retail profiles.

| Domain | Owner | Why it stays generic |
|---|---|---|
| Tenant, auth, user role, tenant settings | gateway | every profile needs same identity and authorization model |
| Product, barcode, warehouse stock, reservation, deduction | inventory | stock rules do not depend on whether store is grocery or departmental |
| Customer, order, return, CRM, online checkout orchestration | sales | customer and order domain stays shared across retail channels |
| Bill, hold/resume, shift, refund, cash variance | accounting | POS settlement is a finance concern, not a sales or inventory concern |
| Staff identity and availability | hr | cashier, manager, picker, delivery executive are all workforce concepts |
| Delivery zone and assignment | delivery | only used when fulfillment mode is delivery |

### Anti-patterns to avoid

- do not create a separate departmental-store service
- do not duplicate product or customer models for POS tenants
- do not move POS billing into sales just because it is retail
- do not encode store-type behavior in route names when a profile flag or workflow state is enough

---

## 4) Departmental Store Use Case Map

Departmental store should primarily optimize for speed at counter, cashier control, and accurate cash/stock movement.

### Primary journeys

1. Open shift
2. Search or scan product
3. Add line items and quantity
4. Apply promotion or line discount under role rules
5. Hold bill when customer pauses purchase
6. Resume held bill
7. Complete payment and print receipt
8. Process refund or exchange against existing bill
9. Close shift and record variance

### Secondary journeys

1. End-of-day cash reconciliation
2. Counter pickup against online or phone order
3. Item exchange with difference settlement
4. Manager override for restricted discount or return
5. Stock inquiry by cashier without leaving billing screen
6. Customer lookup by phone for repeat billing or returns

### Success criteria

1. Common baskets should complete in under one minute
2. Barcode-first workflow should be the default path
3. Billing should fail closed if stock deduction or settlement write fails
4. Return and exchange should restore inventory correctly
5. Shift closure must remain auditable

---

## 5) Channel Model

Departmental store uses the same backend, but different entry screens and transaction objects depending on channel.

| Channel | UI entry | Primary transaction | Accounting result | Stock result |
|---|---|---|---|---|
| POS counter | `apps/pos` | `Bill` | immediate bill settlement and shift entry | immediate stock deduction |
| Assisted order desk | admin/gateway | `SalesOrder` | later invoice / payment flow | reserve then deduct |
| Online storefront | `apps/customer` | `SalesOrder` | invoice/payment based on checkout path | reserve then deduct |

### Rule

Use `Bill` for instant counter settlement.

Use `SalesOrder` when fulfillment is delayed, staged, or externally assigned.

This distinction is generic and should hold for departmental store, grocery, and hybrid retail.

---

## 6) Generic Data and Extension Strategy

Departmental store requirements should extend generic models, not replace them.

### Product model should stay generic enough for both departmental and grocery

- barcode
- SKU
- unit
- optional weight / weightUnit
- optional variant attributes such as size, color, pack
- sell price and cost price
- category and brand
- stock by warehouse

This supports:

- fashion and apparel variants
- electronics with barcode scanning
- FMCG with simple quantity billing
- grocery items with optional weighed sale

### Customer model should stay shared

- walk-in usage
- registered retail customers
- loyalty-ready identity by phone or email
- B2B account customers

### Promotion model should stay generic

- coupon
- percentage or flat discount
- line discount authorization rules
- campaign applicability by product, category, customer segment, or channel

### Settlement model should stay generic

- payment method chosen at transaction time
- split tender allowed where supported
- refund method explicit on return
- shift variance tracked separately from sales total

---

## 7) Workflow Configuration Instead of Forks

Departmental store behavior should come from configuration and permissions.

### Examples

| Need | Generic solution |
|---|---|
| Departmental store wants no delivery screens | hide delivery workflows by tenant profile and fulfillment mode |
| Grocery wants pincode validation | enable delivery capability for `GROCERY` or `HYBRID_RETAIL` |
| Some stores allow hold bills, some do not | tenant setting: `pos.allowHoldBills` |
| Discount above threshold needs approval | role-based rule with threshold setting |
| Exchange allowed only within 7 days | tenant return policy setting |
| Counter pickup from online order | same `SalesOrder`, different fulfillment mode |

### Suggested tenant setting groups

- `retail.profile`
- `pos.*`
- `returns.*`
- `pricing.*`
- `delivery.*`
- `loyalty.*`

---

## 8) Departmental Store Architecture Rules

These rules should guide implementation work from here onward.

### A. POS stays lean

- POS app should optimize for billing speed, not deep admin editing
- product search, scan, hold, pay, refund, and shift actions belong here
- heavy setup stays in admin

### B. Admin stays operational

- admin manages catalog, promotions, reporting, customer lookup, and exception handling
- manager overrides and audit views should live here

### C. Inventory stays authoritative

- every completed bill writes a stock deduction through inventory
- every refund or exchange writes restore or adjustment through inventory
- cashier UI never mutates stock directly

### D. Accounting stays authoritative for settlement

- shift open/close and cash variance live in accounting
- POS bill completion must write settlement state once, not in multiple services
- refunds must create finance trace, not just UI reversal

### E. Sales stays authoritative for non-instant retail flows

- reserve/ship/invoice belongs to `SalesOrder`
- counter billing belongs to `Bill`
- returns against `SalesOrder` stay in sales; returns against `Bill` stay in accounting

---

## 9) Departmental Store Use Cases to Prioritize Next

If departmental store is the current focus, the next implementation slice should be:

1. cashier speed and resilience in `apps/pos`
2. shift close and variance review in accounting-backed UI
3. bill return and exchange flow
4. promotion and manager-override rules
5. customer lookup and repeat billing
6. department-wise and cashier-wise reporting

### Recommended order

1. POS billing hardening
2. hold/resume refinement
3. refund and exchange refinement
4. shift reports and cash reconciliation
5. promotions and approval thresholds
6. hybrid pickup and assisted-order support

---

## 10) Implementation Definition of Done

Departmental store support is considered architecture-correct only if:

1. No departmental-only service is introduced
2. POS uses `Bill` and `CashShift` as the transaction backbone
3. Inventory remains the sole owner of stock movements
4. Accounting remains the sole owner of shift and bill settlement records
5. Customer, catalog, and promotions remain reusable across grocery and hybrid retail
6. Delivery remains optional capability, not a hard dependency
7. Tenant profile and settings drive behavior instead of code duplication

---

## 11) Immediate Direction for This Repository

For this codebase, departmental store should be treated as:

- `apps/pos` as the main frontline UI
- gateway admin as the setup and exception-management UI
- accounting as the settlement and shift backbone
- inventory as the stock backbone
- sales as the customer, returns, and non-instant order backbone

That gives one generic retail architecture that can support:

- departmental store only
- grocery only
- hybrid store with both counter and delivery

without re-architecting the platform.