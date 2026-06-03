# Multi-Channel E2E Blueprint

Status: Execution-ready design
Scope: CRM / B2B sales, departmental store POS, and grocery / online retail
Goal: One ERP platform that supports three selling motions with shared inventory, accounting, delivery, and tenant/auth layers.

Reference architecture: see `docs/RETAIL-GENERIC-ARCHITECTURE.md` for the generic retail rules that departmental store, grocery, and hybrid retail should all follow.

---

## 1) Product Strategy

This application should work as one core ERP with three front doors:

- B2B CRM portal for lead-to-cash sales
- POS terminal for counter billing and departmental store operations
- Customer storefront for grocery and online retail

The services stay shared. Only the UI and workflow entry points change.

### Shared platform rules

- One tenant, one data boundary
- One product catalog
- One inventory stock ledger
- One accounting ledger
- One customer identity model
- Separate channel-specific screens and permissions

### Channel mapping

| Channel | Primary app | Main users | Main outcome |
|---|---|---|---|
| CRM / B2B | Gateway admin portal | Admin, sales manager, sales rep | Lead-to-cash, returns, invoices |
| Departmental store POS | POS app | Cashier, manager | Fast walk-in billing, shift control |
| Grocery / online retail | Customer app + delivery app + admin | Shopper, store manager, delivery executive | Cart, checkout, delivery, tracking |

---

## 2) End-to-End Use Case Coverage

### A. CRM / B2B Sales Flow

Business objective: convert prospects into repeat customers and invoices.

#### Flow

Lead -> Opportunity -> Quote -> Sales Order -> Ship -> Invoice -> Payment -> Return / Credit Note

#### Use cases

1. Create lead
2. Qualify lead
3. Convert lead to opportunity
4. Create opportunity and track stage
5. Create quote
6. Send quote
7. Accept / reject quote
8. Convert quote to sales order
9. Confirm order with credit and stock checks
10. Ship partial or full order
11. Invoice order
12. Record payment
13. Create sales return
14. Approve sales return
15. Complete return with stock restoration and credit note

#### Success criteria

- Sales rep can run the full pipeline without database shortcuts
- Credit limit is checked before confirm
- Stock reserve happens before confirmation
- Stock deduction happens during ship
- Returned goods flow back through inventory and accounting

---

### B. Departmental Store POS Flow

Business objective: process walk-in transactions quickly with accurate shift control.

#### Flow

Open Shift -> Scan / Search Items -> Build Bill -> Pay -> Print Receipt -> Close Shift

#### Use cases

1. Open cash shift
2. Scan barcode or search product
3. Add weighted products
4. Apply line discounts
5. Hold bill
6. Resume held bill
7. Complete bill with payment
8. Create bill return / refund
9. Close shift and calculate variance

#### Success criteria

- Cashier can bill in under a minute for common baskets
- Shift is required before billing
- Stock is deducted on completed bill
- Returns restore stock and record refund
- Shift close compares expected vs actual cash

---

### C. Grocery / Online Retail Flow

Business objective: support storefront ordering, cart checkout, delivery, and tracking.

#### Flow

Browse -> Add to Cart -> Apply Coupon -> Check Serviceability -> Checkout -> Order -> Assign Delivery -> Track -> Deliver -> Return if needed

#### Use cases

1. Browse catalog
2. Search and filter products
3. Add items to cart
4. Save cart in session or local persistence
5. Validate coupon
6. Check pincode serviceability
7. Place order
8. Reserve stock
9. Assign delivery executive
10. Track delivery status
11. Mark delivered
12. Handle failed delivery
13. Create online return
14. Refund or wallet credit

#### Success criteria

- Cart is easy to use on mobile
- Checkout blocks invalid pincodes
- Coupon validation is transparent
- Order tracking is visible to customer and delivery executive
- Fulfillment and returns do not break stock integrity

---

## 3) Channel-Specific UI Design

### CRM / B2B portal

Pages:

- Dashboard
- Leads
- Opportunities
- Quotes
- Orders
- Invoices
- Returns
- Customers
- Products
- Vendors
- Purchase Orders
- Employees
- Payroll

Primary UX principles:

- Pipeline-first navigation
- Quick create actions
- Detailed drawers for status transitions
- Tables with filters and lifecycle actions

### POS terminal

Pages:

- Login
- Billing
- Held bills
- Shift open / close
- Bill history
- Return/refund screen

Primary UX principles:

- Keyboard-first
- Barcode-first
- Minimal clicks
- Big totals and payment controls
- Fast item add/remove flow

### Customer storefront

Pages:

- Home
- Category listing
- Product detail
- Cart
- Checkout
- Orders
- Profile

Primary UX principles:

- Mobile-first
- Fast add-to-cart
- Sticky cart summary
- Coupon and delivery feedback before payment
- Clear status timeline after ordering

### Delivery app

Pages:

- Login
- Assignment list
- Assignment detail
- Route / tracking
- Earnings

Primary UX principles:

- One active task at a time
- Very large action buttons
- Offline-friendly status updates when possible

---

## 4) Data Model and Domain Ownership

### Shared domains

| Domain | Owning service | Notes |
|---|---|---|
| Authentication / tenant access | gateway | JWT and service login |
| Customer records | sales | Shared by CRM and retail |
| Product catalog | inventory | Used by all channels |
| Stock movements | inventory | Reserve, deduct, restore |
| Sales orders, quotes, leads, returns | sales | B2B and online retail |
| Bills, shifts, bill returns | accounting | POS only |
| Invoices, journals, credit notes, debit notes | accounting | Finance layer |
| Coupons, banners, notifications | gateway | Marketing and engagement |
| Delivery zones and assignments | delivery | Online orders only |
| Employee delivery flags | hr | Delivery executive identity |

### Key rule

Each business action should have a single owner:

- Leads and quotes belong to sales
- Product availability belongs to inventory
- Cash shifts and bills belong to accounting
- Delivery status belongs to delivery
- Login and tenant context belong to gateway

---

## 5) Cart Design

Cart should be channel-aware.

### Option A: Session cart

Best for customer app.

- Stored in browser state
- Fastest UX
- Easy to reset
- Suitable for guest browsing

### Option B: Persisted cart

Best when customers need continuity.

- Store in localStorage or server table
- Survives refresh
- Good for logged-in shoppers
- Can support abandoned cart recovery

### Recommended approach

- Customer app: session cart with optional localStorage persistence
- POS: in-memory bill state with hold/resume
- CRM / B2B: no cart, use quotes and orders instead

### Cart behavior rules

- Validate product exists and is active
- Recheck stock at checkout
- Reprice on checkout if product price changed
- Apply coupon only after item totals are known
- Block checkout if zone is not serviceable

---

## 6) State Machines

### Lead

NEW -> CONTACTED -> QUALIFIED -> CONVERTED
NEW -> DISQUALIFIED

### Opportunity

PROSPECTING -> QUALIFICATION -> PROPOSAL -> NEGOTIATION -> WON
PROSPECTING -> LOST

### Quote

DRAFT -> SENT -> ACCEPTED
SENT -> REJECTED
SENT -> EXPIRED

### Sales Order

DRAFT -> CONFIRMED -> PARTIALLY_SHIPPED -> SHIPPED -> INVOICED
DRAFT -> CANCELLED
CONFIRMED -> CANCELLED

### Sales Return

PENDING -> APPROVED -> COMPLETED
PENDING -> REJECTED

### Cash Shift

OPEN -> CLOSED

### Bill

HELD -> COMPLETED
COMPLETED -> CANCELLED

### Delivery Assignment

ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
ASSIGNED -> FAILED
ASSIGNED -> CANCELLED

---

## 7) Validation and Exception Rules

### Common rules

- tenantId must always come from headers
- zod validates all request bodies
- paginated endpoints must accept page and limit
- soft deletes only for business records
- multi-service mutations need compensation logic

### CRM / B2B

- Quote requires customer and at least one item
- Order confirm requires stock reserve and credit check
- Ship quantity cannot exceed remaining quantity
- Return quantity cannot exceed shipped quantity
- Sales return completion requires inventory restore and credit note

### POS

- Shift must be open before billing
- Bill cannot complete if stock deduction fails
- Return quantity cannot exceed billed quantity
- Close shift must calculate variance from expected cash

### Grocery / online retail

- Pincode must be serviceable before order placement
- Coupon must pass expiry, limits, and minimum order checks
- Cart must revalidate stock at checkout
- Delivery assignment must exist before customer sees out-for-delivery status

---

## 8) API Touchpoint Map

### Gateway

- `/api/auth`
- `/api/banners`
- `/api/coupons`
- `/api/coupons/validate`
- `/api/customers`
- `/api/leads`
- `/api/opportunities`
- `/api/quotes`
- `/api/orders`
- `/api/returns`

### Inventory

- `/api/products`
- `/api/categories`
- `/api/warehouses`
- `/api/stock`
- `/api/price-lists`
- `/api/reports/stock`

### Accounting

- `/api/shifts`
- `/api/bills`
- `/api/bills/:id/returns`
- `/api/reports/shifts`
- `/api/invoices`
- `/api/credit-notes`

### Delivery

- `/api/delivery-zones`
- `/api/zones/check-pincode`
- `/api/assignments`
- `/api/earnings`

### HR

- `/api/employees`
- delivery executive flags on employee records

---

## 9) E2E User Journeys

### Journey 1: B2B sales rep

1. Login to admin portal
2. Create lead
3. Qualify lead
4. Convert to opportunity
5. Create quote
6. Send quote
7. Accept quote
8. Create sales order
9. Confirm order
10. Ship order
11. Invoice order
12. Receive payment
13. Handle return if needed

### Journey 2: Cashier at departmental store

1. Login to POS
2. Open shift
3. Scan items
4. Adjust quantities or weights
5. Hold and resume bill if needed
6. Complete payment
7. Print receipt
8. Close shift
9. Process bill return if customer comes back

### Journey 3: Grocery shopper

1. Browse catalog
2. Add items to cart
3. Apply coupon
4. Enter address and pincode
5. Checkout
6. Order is confirmed
7. Manager assigns delivery executive
8. Shopper tracks delivery
9. Delivery completed
10. Return request created if needed

---

## 10) Implementation Plan

### Phase 1 — Foundation

- Confirm tenant/auth flow
- Confirm env and seed state
- Ensure proxies exist for all required services
- Lock shared types and enums

### Phase 2 — B2B CRM readiness

- Finalize lead/opportunity/quote/order screens
- Add customer creation and detail pages
- Add quote-to-order conversion flow
- Add return flow and finance view

### Phase 3 — POS readiness

- Finalize shift open/close UX
- Improve barcode and PLU search
- Add held bills queue
- Add bill return / refund UX

### Phase 4 — Retail grocery readiness

- Finalize cart and checkout UX
- Add pincode serviceability in checkout
- Add coupon validation and delivery assignment
- Add order tracking screens

### Phase 5 — Operations and reporting

- Sales reports
- Stock valuation
- Shift variance reports
- Delivery earnings reports
- Promotions management UI

### Phase 6 — Hardening

- Error handling consistency
- Empty states and loading states
- Permission matrix enforcement
- E2E regression testing

---

## 11) Suggested Build Order

If implementation starts now, the safest order is:

1. CRM sales core UI
2. Customer and product management screens
3. POS billing and shift flow
4. Customer cart and checkout
5. Delivery assignment and tracking
6. Returns and finance hardening
7. Reports and admin utilities

---

## 12) Definition of Done

This product is ready when:

- B2B, POS, and grocery flows can each complete end to end
- All three channels use shared stock and accounting correctly
- Cart, quote, bill, and order lifecycles are consistent
- Returns restore stock and generate finance records
- The app can be tested by role without backend workarounds

---

## 13) Immediate Next Step

Before coding, confirm these are all true:

- Login works with the seeded tenant and admin user
- Gateway proxies the required API routes
- Sales, inventory, accounting, delivery, and hr services are running
- UI routes exist for the three channels
- The cart model is finalized for customer app

Once that is green, implementation can start from Phase 1 and proceed in the build order above.
