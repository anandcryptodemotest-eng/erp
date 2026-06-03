# Retail / Grocery Mode — Full Flow Blueprint

Status: Active implementation target  
Scope: All retail and grocery use cases layered on top of the ERP monorepo  
Services involved: gateway · sales · inventory · accounting · delivery · hr  
Apps: pos · customer · delivery-app · admin (gateway)

> This blueprint extends the ERP for departmental stores and grocery shops.
> The core B2B sales flow (Lead-to-Cash) is preserved for wholesale/corporate customers.
> Retail mode adds POS, online ordering, delivery, promotions, and customer app flows.

---

## 1) Use Case Catalog

### Group A — POS / Walk-in Billing

#### A1. Open Cash Shift
- Actors: Cashier (USER), Manager (MANAGER), Admin (ADMIN)
- Trigger: Start of work day or new cashier turn
- Preconditions: No open shift exists for this cashier
- Main flow:
  1. Cashier enters opening cash balance
  2. System creates shift with status OPEN
  3. All bills for this session are linked to this shift
- Exception flow:
  - Existing open shift for cashier → 409 Cashier already has an open shift
- Outcome: CashShift in OPEN state

#### A2. POS Billing (Barcode / PLU / Search)
- Actors: Cashier
- Trigger: Customer brings items to counter
- Preconditions: Open shift exists
- Main flow:
  1. Cashier scans barcode or types product name/PLU code
  2. System fetches product from inventory (price, tax rate, unit)
  3. For weight-based items: cashier enters weight, system multiplies by price/kg
  4. Items added to bill lines with quantity and discount controls
  5. System calculates per-line tax, subtotal, discount total, grand total
  6. Cashier selects payment method (CASH/UPI/CARD/WALLET/SPLIT)
  7. For CASH: system shows change amount
  8. Bill created as COMPLETED, stock deducted, shift entry recorded
- Exception flow:
  - Product not found → show "Item not found" with add-to-cart style fallback
  - No open shift → prompt cashier to open shift first
  - Stock deduction fails → show error without confirming bill
- Outcome: Bill in COMPLETED state, stock decremented, shift cash updated

#### A3. Hold Bill
- Actors: Cashier
- Trigger: Customer needs to continue shopping or phone call interruption
- Preconditions: Open shift exists, bill has items
- Main flow:
  1. Cashier clicks "Hold"
  2. Bill saved with HELD status under shift
  3. Cashier can continue with next customer
- Exception flow: None material
- Outcome: Bill in HELD state, retrievable from holds queue

#### A4. Resume Held Bill
- Actors: Cashier
- Trigger: Cashier selects bill from holds queue
- Preconditions: Bill exists in HELD state
- Main flow:
  1. Cashier opens holds list and selects bill
  2. Bill loaded back into billing screen
  3. Cashier completes payment, bill transitions to COMPLETED
- Exception flow:
  - Held bill not found → 404
  - Bill already completed/cancelled → 409
- Outcome: Held bill completed

#### A5. POS Return / Refund
- Actors: Cashier (with MANAGER override for high-value)
- Trigger: Customer brings item back with bill number/phone
- Preconditions:
  - Source bill is in COMPLETED state
  - Return quantity ≤ billed quantity
- Main flow:
  1. Cashier looks up bill by bill number or customer phone
  2. System shows eligible line items with max return quantity
  3. Cashier selects items and quantities
  4. System calls inventory to add stock back
  5. Refund method selected (CASH/UPI/WALLET)
  6. BillReturn created, shift REFUND entry recorded
- Exception flow:
  - Quantity exceeds billed amount → 400 error
  - Bill not COMPLETED → 409
  - Insufficient permissions (high value) → 403
- Outcome: Stock restored, refund issued, BillReturn created

#### A6. Close Cash Shift
- Actors: Cashier, Manager
- Trigger: End of shift
- Preconditions: Shift is OPEN
- Main flow:
  1. Cashier counts physical cash and enters closing balance
  2. System calculates expected balance from opening + bill payments - refunds
  3. Difference (variance) recorded
  4. Shift closed with CLOSED status and timestamp
- Exception flow:
  - Shift already CLOSED → 409
  - Insufficient permissions → 403
- Outcome: CashShift CLOSED with variance record

---

### Group B — Online Orders (Customer App)

#### B1. Customer Browse and Search
- Actors: Customer (app user)
- Trigger: Customer opens app
- Preconditions: Customer is logged in or browsing as guest
- Main flow:
  1. App shows home: banners, featured products, categories
  2. Customer searches, filters by category/price/brand
  3. Product detail shows images, description, price, unit, availability
- Exception flow:
  - Product out of stock → show "Out of Stock" badge, disable add-to-cart
- Outcome: Customer views catalog

#### B2. Add to Cart and Coupon Apply
- Actors: Customer
- Trigger: Customer adds item to cart
- Preconditions: Customer authenticated
- Main flow:
  1. Customer taps "Add to Cart" with quantity
  2. Cart stored locally (and optionally synced)
  3. At checkout, customer enters coupon code
  4. System validates coupon via gateway: limits, expiry, min order, per-user usage
  5. Discount shown in cart summary
- Exception flow:
  - Invalid coupon → show specific reason (expired, limit reached, min order not met)
  - Product deleted while in cart → warn customer at checkout
- Outcome: Cart ready for checkout with applied discount

#### B3. Checkout and Place Online Order
- Actors: Customer
- Trigger: Customer taps "Place Order"
- Preconditions:
  - Cart has valid items
  - Delivery address is set or store pickup selected
  - Delivery zone covers pincode
- Main flow:
  1. Customer selects delivery address
  2. System checks if pincode is in a DeliveryZone, shows fee and ETA
  3. Payment method selected (UPI/CARD/WALLET/COD)
  4. Order created in sales service with isOnline=true, deliveryFee, couponId
  5. Stock reserved in inventory
  6. If coupon used: CouponUsage recorded
  7. Push notification sent via FCM
- Exception flow:
  - Pincode not in any zone → "Delivery not available to your area"
  - Stock reserve fails → "One or more items are out of stock"
  - Coupon validate fails → 400 with reason
- Outcome: SalesOrder in CONFIRMED state, stock reserved

#### B4. Admin Confirms/Processes Online Order
- Actors: Store Manager, Admin
- Trigger: New order appears in admin panel
- Preconditions: Order in CONFIRMED state
- Main flow:
  1. Manager reviews order details and items
  2. Optionally adjusts or rejects items (with notification to customer)
  3. Assigns delivery executive
  4. Order marked as OUT_FOR_DELIVERY
  5. DeliveryAssignment created and linked to order
- Exception flow:
  - No available delivery executive → manager can queue it
- Outcome: Order assigned for delivery

#### B5. Order Tracking by Customer
- Actors: Customer
- Trigger: Customer opens order detail
- Preconditions: Order placed and assigned
- Main flow:
  1. App shows order timeline: CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
  2. Customer sees delivery executive name and ETA
  3. Real-time location shared via DeliveryTracking
- Exception flow:
  - Assignment cancelled → notify customer and re-assign
- Outcome: Customer informed in real time

#### B6. Online Order Return
- Actors: Customer, Manager
- Trigger: Customer requests return from order history
- Preconditions:
  - Order is DELIVERED
  - Return window has not expired
- Main flow:
  1. Customer selects items to return with reason
  2. SalesReturn created in PENDING
  3. Manager approves and initiates return pickup or store drop
  4. On completion: stock restored, credit note issued, wallet credit or refund initiated
- Exception flow:
  - Return window expired → 400
  - Quantity over shipped → 400
- Outcome: SalesReturn COMPLETED, credit note ISSUED

---

### Group C — Delivery Executive Flow

#### C1. View and Accept Assignment
- Actors: Delivery Executive (isDeliveryExecutive=true)
- Trigger: Assignment pushed or executive opens app
- Preconditions: Executive is AVAILABLE, assignment is ASSIGNED
- Main flow:
  1. Executive sees new assignment with order summary and delivery address
  2. Executive accepts: assignment transitions ASSIGNED → ACCEPTED
- Exception flow:
  - Assignment already accepted by another → 409
- Outcome: Assignment ACCEPTED

#### C2. Pickup and Deliver Order
- Actors: Delivery Executive
- Trigger: Executive picks up from store
- Main flow:
  1. Mark PICKED_UP with timestamp
  2. Share GPS coordinates via DeliveryTracking
  3. Arrive at customer: mark DELIVERED with timestamp
  4. For COD: collect payment, record in shift entry or earnings
  5. Order in sales transitions to DELIVERED/SHIPPED
- Exception flow:
  - Customer unavailable → mark FAILED with reason, return to store
- Outcome: Assignment DELIVERED, order updated

#### C3. Failed Delivery Handling
- Actors: Delivery Executive, Manager
- Trigger: Customer not reachable or address wrong
- Main flow:
  1. Executive marks FAILED with reason
  2. Manager reviews and decides: re-attempt, return stock, or cancel order
  3. On cancel: stock released, customer notified
- Outcome: Assignment FAILED, order handled by manager

#### C4. Earnings Summary
- Actors: Delivery Executive
- Trigger: Executive opens earnings screen
- Main flow:
  1. System shows baseFee + bonus per order for current period
  2. Total earnings, paid/unpaid breakdown
- Outcome: Executive has visibility into compensation

---

### Group D — Inventory / Catalog Management

#### D1. Product Catalog Setup
- Actors: Admin, Inventory Manager
- Main flow:
  1. Create categories (hierarchy, icons, banners)
  2. Create brands
  3. Create products with barcode, PLU, unit, weight, sellByWeight flag
  4. Set cost price, selling price, reorder level
  5. Assign to warehouse with opening stock
- Outcome: Catalog ready for billing and customer app

#### D2. Low-Stock Alert
- Actors: System (automated), Inventory Manager
- Trigger: Stock falls below reorderLevel after sale
- Main flow:
  1. After bill/deduction, system checks if stock <= reorderLevel
  2. Notification created (or returned in GET /api/products?lowStock=true)
- Outcome: Manager alerted for reorder

#### D3. Goods Receipt (Procurement)
- Actors: Procurement Officer
- Trigger: Vendor delivery
- Main flow:
  1. PO created and approved
  2. Goods receipt records received quantities
  3. Stock incremented in warehouse
  4. AP invoice created in accounting
- Outcome: Stock updated, payable recorded

---

### Group E — Promotions and Marketing

#### E1. Banner Management
- Actors: Admin, Manager
- Main flow:
  1. Upload banner image with type (HOME/PROMOTIONAL/CATEGORY)
  2. Set schedule (startsAt, endsAt)
  3. Customer app fetches active banners by type
- Outcome: Banners shown on customer home screen

#### E2. Coupon Creation and Validation
- Actors: Admin, Manager
- Main flow:
  1. Create coupon with type (PERCENTAGE/FLAT_AMOUNT/FREE_DELIVERY)
  2. Set min order, max discount, usage limits, expiry
  3. Customer applies at checkout
  4. System validates all constraints and returns discount amount
  5. On order place: CouponUsage recorded, usageCount incremented
- Exception flow:
  - All validation cases: expired, limit reached, min order, per-user limit
- Outcome: Discount accurately applied once per allowed usage

---

## 2) State-Machine Diagram

### CashShift
OPEN → CLOSED

Rules:
- Only the owning cashier or ADMIN/MANAGER can close.
- CLOSED is terminal.

### Bill
HELD → COMPLETED
HELD → CANCELLED
COMPLETED → (REFUNDED via BillReturn, not a status transition but a linked record)

Rules:
- CANCELLED requires ADMIN/MANAGER.
- COMPLETED bills cannot be edited.
- Returns create a separate BillReturn record linked to the Bill.

### Online Order (SalesOrder isOnline=true)
DRAFT → CONFIRMED (stock reserved, coupon usage recorded)
CONFIRMED → PREPARING (admin processes order)
PREPARING → OUT_FOR_DELIVERY (delivery assignment created)
OUT_FOR_DELIVERY → DELIVERED (delivery executive marks complete)
DELIVERED → RETURNED (return request approved and completed)
CONFIRMED → CANCELLED (stock released)

### DeliveryAssignment
ASSIGNED → ACCEPTED
ACCEPTED → PICKED_UP
PICKED_UP → DELIVERED
PICKED_UP → FAILED
ASSIGNED → CANCELLED

Rules:
- DELIVERED and FAILED are terminal.
- On FAILED: manager decides retry or order cancellation.

### SalesReturn (Online)
PENDING → APPROVED → COMPLETED
PENDING → REJECTED

### CouponUsage
Created on order placement. No further transitions.

---

## 3) Screen-by-Screen UX Flow

### POS Terminal App (apps/pos)

#### Home / Shift Screen
- If no open shift: fullscreen "Open Shift" card with opening balance input
- If shift open: entry point to Billing, Holds queue, Returns, Shift Summary
- Shift summary: current bill count, total collected, cash in/out

#### Billing Screen
- Two-panel layout:
  - Left: search bar (barcode/name/PLU), product results list with tap-to-add
  - Right: bill lines (qty stepper, discount per line, remove), totals breakdown
- Barcode scanner integration: auto-trigger product lookup
- Weight modal: for sellByWeight items, prompt weight in kg before adding to line
- Payment drawer: method toggle, CASH → change calculator, confirm button
- Hold button: saves bill to holds, clears screen
- Last bill receipt card shown after completion with print/share option

#### Holds Queue Screen
- List of HELD bills with customer name (if captured), item count, total
- Tap to resume any bill

#### Returns Screen
- Bill lookup: enter bill number or customer phone
- Bill detail shows each line with "Return" toggle and qty input (capped at billed qty)
- Refund method selection
- Confirmation shows total refund amount before submit

#### Shift Close Screen
- Summary: opening balance, bills count, total billed, total refunds, expected cash
- Actual cash input with variance calculation and highlight
- Notes field
- Confirm close button

---

### Customer App (apps/customer)

#### Home Screen
- Auto-rotating banner carousel (HOME type from gateway)
- Category grid with icons (isFeatured categories)
- Featured products horizontal scroll
- Quick action: Search bar prominent at top

#### Product List Screen
- Filter bar: category, price range, brand, in-stock only
- Product card: image, name, price, unit, add-to-cart button
- Out-of-stock overlay on product card

#### Product Detail Screen
- Image gallery, product name, brand, unit, price
- Description and shelf/batch info
- Quantity selector with add-to-cart
- Similar products row

#### Cart Screen
- Grouped by availability (available vs out-of-stock)
- Per-item qty controls with remove
- Coupon code input with instant validation feedback
- Order summary: subtotal, discount, delivery fee, tax, grand total
- Proceed to checkout CTA

#### Checkout Screen
- Address selector with add/edit
- Delivery zone check with fee and ETA
- Payment method selection
- Order summary confirmation
- Place Order CTA with loading state

#### Orders Screen
- Tab: Active / Past
- Order card with status chip, item count, total, date
- Tap → Order Detail

#### Order Detail Screen
- Status timeline: ordered → confirmed → preparing → out for delivery → delivered
- Item list with quantities
- Delivery executive info and contact (when assigned)
- Track on map button (when OUT_FOR_DELIVERY)
- Return button (when DELIVERED, within return window)

#### Profile Screen
- Name, phone, email
- Address book management
- Wallet balance
- Notification preferences
- Logout

---

### Delivery Executive App (apps/delivery-app)

#### Home Screen
- Status toggle: AVAILABLE / NOT_AVAILABLE
- Active assignment card (if any) with full order details
- Quick stats: today's deliveries, earnings

#### Assignments Screen
- New assignments (ASSIGNED) with accept button
- Active assignment (ACCEPTED/PICKED_UP) with action buttons
- Completed today
- Status action flow: Accept → Mark Picked Up → Mark Delivered / Mark Failed

#### Earnings Screen
- Period selector: This Week / This Month / Custom
- Per-order breakdown: base fee, bonus
- Total and paid/pending split

---

### Admin Panel (apps/gateway)

#### Dashboard
- GMV today / week / month with trend
- Orders by status (donut chart)
- Low-stock alerts summary
- Pending delivery assignments
- Top 5 products by revenue

#### Orders Management
- Tab: Online / POS
- Filters: status, date range, delivery executive
- Order detail with assign executive action

#### POS Shifts Management
- List of shifts by cashier and date
- Shift detail with bills and entries
- Close shift on behalf (ADMIN/MANAGER)

#### Promotions
- Banner CRUD with image upload and schedule
- Coupon CRUD with usage stats

---

## 4) Role/Permission Matrix

| Capability | ADMIN | MANAGER | SALES_REP | CASHIER (USER) | DELIVERY_EXEC | CUSTOMER |
|---|---|---|---|---|---|---|
| Open/close shift | Yes | Yes | No | Own shift | No | No |
| POS billing | Yes | Yes | No | Yes | No | No |
| Hold/resume bill | Yes | Yes | No | Yes | No | No |
| POS return | Yes | Yes | No | No (policy) | No | No |
| Cancel bill | Yes | Yes | No | No | No | No |
| View all shifts | Yes | Yes | No | Own only | No | No |
| Online order: place | No | No | No | No | No | Yes |
| Online order: confirm/assign | Yes | Yes | No | No | No | No |
| Online order: cancel | Yes | Yes | No | No | No | Limited (CONFIRMED only) |
| Assignment: accept/pickup/deliver | No | No | No | No | Yes (own) | No |
| Assignment: assign/create | Yes | Yes | No | No | No | No |
| Banners: CRUD | Yes | Yes | No | No | No | No |
| Coupons: CRUD | Yes | Yes | No | No | No | No |
| Coupon: use | No | No | No | No | No | Yes |
| Products/catalog: manage | Yes | Yes | No | No | No | No |
| Products/catalog: browse | Yes | Yes | Yes | Yes | No | Yes |
| Earnings: view own | No | No | No | No | Yes | No |
| Reports: view | Yes | Yes | No | No | No | No |

Policy notes:
- POS return policy for cashier can be toggled per tenant (TenantSetting key: CASHIER_CAN_RETURN)
- CASHIER role uses USER system role + isDeliveryExecutive=false + shift context
- DELIVERY_EXEC uses USER system role + isDeliveryExecutive=true on hr.Employee

---

## 5) Validation and Exception Rules

### POS Billing Rules
1. Shift must be OPEN before any bill can be created.
2. Each bill must have at least one item.
3. HELD bills cannot have payment recorded.
4. Quantity must be positive; for weight items quantity is float.
5. Discount per item cannot exceed item subtotal.
6. Stock deduction must succeed before bill is COMPLETED.
7. Stock deduction failure → bill stays in DRAFT/error, not committed.

### POS Return Rules
1. Source bill must be COMPLETED.
2. Return quantity ≤ billed quantity (per product/variant).
3. Previously returned quantity must be subtracted from available-to-return.
4. Refund total = sum(returnQty × unitPrice).
5. Stock receive-back call to inventory must succeed atomically.

### Online Order Rules
1. At least one item in cart.
2. Delivery address required (or store-pickup flag).
3. Pincode must map to active DeliveryZone.
4. Stock reserve must succeed before order is CONFIRMED.
5. Coupon validate before order placement; CouponUsage recorded on success.
6. COD available only within configured delivery zones.

### Coupon Validation Chain
- Step 1: Coupon exists, isActive=true
- Step 2: Current time within [startsAt, endsAt]
- Step 3: usageCount < usageLimit (if set)
- Step 4: User's CouponUsage count < perUserLimit
- Step 5: orderAmount >= minOrderAmount (if set)
- Step 6: Calculate discount with maxDiscount cap for PERCENTAGE type

### Delivery Assignment Rules
1. Only AVAILABLE executives can be assigned.
2. An executive can have at most 1 ACCEPTED/PICKED_UP assignment at a time.
3. DELIVERED and FAILED are terminal; no further transitions allowed.
4. GPS tracking points are recorded while assignment is PICKED_UP.

### Shift Reconciliation Rules
- expectedBalance = openingBalance + SUM(CASH_IN, BILL_PAYMENT entries) - SUM(CASH_OUT, REFUND entries)
- difference = closingBalance - expectedBalance
- Positive difference = cash over; negative = cash short
- Supervisor review required if abs(difference) > configured threshold

---

## 6) API and Data Touchpoint Map

### 6.1 POS APIs (accounting service)

Shifts
- POST   /api/shifts                → open shift
- GET    /api/shifts                → list shifts (filter: status, cashierId)
- GET    /api/shifts/:id            → shift detail with entries and bill count
- PATCH  /api/shifts/:id            → close shift (closingBalance, notes)
- POST   /api/shifts/:id/entries    → record cash-in or cash-out entry

Bills
- POST   /api/bills                 → create bill (COMPLETED or HELD)
- GET    /api/bills                 → list bills (filter: shiftId, status, customerId)
- GET    /api/bills/:id             → bill detail with items and returns
- PATCH  /api/bills/:id             → HELD→COMPLETED or HELD/COMPLETED→CANCELLED
- GET    /api/bills/:id/returns     → list returns for a bill
- POST   /api/bills/:id/returns     → process POS return (stock + refund)

### 6.2 Online Order APIs (sales service)

Orders
- POST   /api/orders                → create online order (isOnline, deliveryFee, couponId)
- GET    /api/orders                → list (filter: status, isOnline, customerId)
- GET    /api/orders/:id            → order detail
- POST   /api/orders/:id/confirm    → confirm + reserve stock
- POST   /api/orders/:id/ship       → ship + deduct stock + create AR invoice
- POST   /api/orders/:id/cancel     → cancel + release stock
- PATCH  /api/orders/:id            → update status (PREPARING, OUT_FOR_DELIVERY, DELIVERED)

Returns
- POST   /api/sales-returns         → create return request
- POST   /api/sales-returns/:id/approve   → approve return
- POST   /api/sales-returns/:id/complete  → complete (stock restore + credit note)

### 6.3 Delivery APIs (delivery service)

Zones
- POST   /api/zones                 → create zone with pincodes
- GET    /api/zones                 → list zones
- GET    /api/zones/:id             → zone detail
- PATCH  /api/zones/:id             → update zone or deactivate
- POST   /api/zones/check-pincode   → check if pincode is serviceable (returns zone + fee)

Assignments
- POST   /api/assignments           → create assignment (orderId, executiveId)
- GET    /api/assignments           → list (filter: executiveId, status, date)
- GET    /api/assignments/:id       → assignment detail
- PATCH  /api/assignments/:id       → transition status
- POST   /api/assignments/:id/track → record GPS location

Earnings
- GET    /api/earnings              → summary for executive by period
- GET    /api/earnings/detail       → per-assignment breakdown

### 6.4 Promotions APIs (gateway service)

Banners
- POST   /api/banners               → create banner
- GET    /api/banners               → list (filter: type, isActive)
- GET    /api/banners/:id           → banner detail
- PATCH  /api/banners/:id           → update/deactivate
- DELETE /api/banners/:id           → soft deactivate

Coupons
- POST   /api/coupons               → create coupon
- GET    /api/coupons               → list
- GET    /api/coupons/:id           → detail
- PATCH  /api/coupons/:id           → update/deactivate
- POST   /api/coupons/validate      → validate + record usage (orderId required to finalize)

### 6.5 Cross-Service Touchpoints

| Action | Caller | Inventory Call | Accounting Call |
|---|---|---|---|
| Create POS bill (COMPLETED) | accounting | POST /api/stock/deduct | internal — bill record |
| POS return | accounting | POST /api/stock/receive-return | internal — bill return record |
| Confirm online order | sales | POST /api/stock/reserve | — |
| Ship online order | sales | POST /api/stock/deduct | POST /api/invoices/ar |
| Cancel online order | sales | POST /api/stock/release | — |
| Complete sales return | sales | POST /api/stock/receive-return | POST /api/credit-notes |
| Delivery DELIVERED | delivery | — | sales PATCH /api/orders/:id status |

### 6.6 End-to-End Sequence Snapshots

#### POS Bill Creation
1. Cashier scans items, enters payment.
2. Accounting bill route validates shift open.
3. Calculates tax and totals.
4. Accounting → Inventory POST /api/stock/deduct for all lines.
5. Inventory success → Bill committed in prisma.$transaction.
6. Shift entry BILL_PAYMENT recorded.
7. Bill returned to cashier with billNumber.

#### Online Order Checkout
1. Customer places order (cart items, address, coupon, payment).
2. Sales validates pincode against DeliveryZone.
3. Sales → Gateway POST /api/coupons/validate (with orderId to finalize usage).
4. Sales → Inventory POST /api/stock/reserve.
5. On success: SalesOrder created as CONFIRMED.
6. Gateway FCM push notification to customer.

#### Delivery Completion
1. Delivery executive marks DELIVERED.
2. Delivery service → Sales PATCH /api/orders/:id with status DELIVERED.
3. Sales updates order status.
4. Customer receives push notification.
5. If COD: manager reconciles payment via shift entry.

---

## 7) Integration Points With B2B Sales Blueprint

The retail grocery mode reuses the full sales service. Key integration points:

| B2B Flow | Retail Extension | Notes |
|---|---|---|
| SalesOrder | isOnline flag, deliveryFee, couponId, deliveryAddress | Online orders set isOnline=true |
| Customer | wallet, isBlocked, CustomerAddress | Wallet used for refunds/credits |
| Invoice (AR) | Linked to shipped online orders | POS uses Bill model, not Invoice |
| SalesReturn | Same state machine, same APIs | POS returns use BillReturn model |
| CreditNote | Issued on SalesReturn completion | POS returns use direct cash refund |
| Stock Reserve | Same inventory endpoint | Both B2B orders and online orders |
| Stock Deduct | Same inventory endpoint | POS bills and B2B shipments |

---

## 8) Implementation Checklist

### POS
- [x] CashShift open/close/entries API
- [x] Bill create (COMPLETED/HELD) with stock deduction
- [x] Bill detail and HELD→COMPLETED transition
- [x] Bill returns with stock restore
- [x] POS billing UI (barcode, weight, payment, change calc)
- [x] Holds queue UI
- [x] Returns UI
- [ ] Shift close screen with variance display
- [ ] Shift summary/report screen
- [ ] Print/share receipt (thermal printer format)
- [ ] Offline queue for network outage (service worker cache)

### Online Orders
- [x] Customer home with banners, featured products, categories
- [x] Product list/detail UI in customer app
- [x] Cart UI
- [x] Checkout UI with address and coupon
- [x] Order history and detail UI
- [x] SalesOrder API with isOnline flag
- [x] Stock reserve on confirm
- [x] Coupon validate and usage record
- [ ] Delivery zone pincode check at checkout
- [ ] FCM push on order placement
- [ ] Order status tracking screen (timeline)
- [ ] Online return flow in customer app

### Delivery
- [x] DeliveryZone CRUD API
- [x] DeliveryAssignment create/list/detail API
- [x] Assignment status transitions (ACCEPTED/PICKED_UP/DELIVERED/FAILED)
- [x] GPS tracking API
- [x] Earnings summary API
- [x] Delivery app home, assignments, earnings screens
- [ ] Real-time map tracking in customer app
- [ ] COD collection flow in delivery app
- [ ] Re-attempt failed delivery flow

### Promotions
- [x] Banner CRUD API
- [x] Coupon CRUD and validate API
- [ ] Banner management UI in admin panel
- [ ] Coupon management UI with usage stats
- [ ] Admin panel dashboard with GMV, low-stock, pending orders

### Inventory
- [x] Product catalog with barcode, PLU, sellByWeight, reorderLevel
- [x] Brand and category management with isFeatured, icons
- [x] Stock deduct/reserve/release/receive-return APIs
- [ ] Low-stock alert endpoint (GET /api/products?lowStock=true) or push
- [ ] Near-expiry batch/lot tracking (future)

---

## 9) Done Criteria for Retail/Grocery Mode

1. POS full session: open shift → bill with barcode → hold/resume → return → close shift with variance.
2. Online order full session: customer browse → cart + coupon → checkout → delivery → delivered → return.
3. Delivery executive full session: accept → pickup → deliver with GPS → earnings visible.
4. Promotions: banners visible in customer app, coupon discount correctly applied and usage tracked.
5. Inventory: stock accurately reflects every POS deduction, online order reserve/deduct, and return.
6. Accounting: every POS shift close reconciles expected vs actual. Online order invoices linked correctly.
7. E2E tests cover: POS happy path, POS return, online order happy path, delivery completion, coupon edge cases.
8. Role checks: cashier cannot cancel bills, non-manager cannot access returns above threshold.
