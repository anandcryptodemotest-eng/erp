# Departmental Store Use Cases

Status: Detailed design baseline
Scope: Counter billing, hold/resume, returns, exchanges, cashier operations, customer lookup, manager overrides
Architecture: Follows `docs/RETAIL-GENERIC-ARCHITECTURE.md`

---

## 1) Why Departmental Store Needs Its Own Use Case Layer

Departmental store is not a separate backend architecture, but it does have a different operational experience from B2B CRM and grocery delivery.

The customer expectation is immediate:

- fast scanning
- visible totals
- accurate discounts
- smooth payment
- simple returns

The cashier expectation is operational:

- minimal clicks
- fast keyboard and barcode flow
- confidence that the bill is saved
- clear shift state
- low-friction manager override path

The store manager expectation is control:

- who opened shift
- who gave discount
- which bill was held or cancelled
- what was refunded
- where cash variance came from

This document defines those use cases from the user point of view while staying inside the generic retail architecture.

---

## 2) Actors and Their Goals

### Customer

Goals:

1. Get billed quickly
2. Understand price and offer clearly
3. Pay using preferred mode
4. Return or exchange with minimal friction
5. Get a receipt and trust the transaction

### Cashier

Goals:

1. Start shift quickly
2. Scan products rapidly
3. Handle queues without confusion
4. Hold a bill without losing customer basket
5. Take payment accurately
6. Handle return or exchange with guardrails

### Manager

Goals:

1. Monitor shift and billing health
2. Approve high-risk discounts, cancellations, and returns
3. Resolve exceptions without database intervention
4. Track cashier performance and variances

### Store Owner / Admin

Goals:

1. Configure catalog, pricing, and taxes
2. Review sales and shift reports
3. Keep operations generic enough to scale to more stores

---

## 3) Departmental Store Journey Map

### Journey A: Normal counter purchase

1. Customer brings items to counter
2. Cashier scans barcode or searches item
3. Cashier adjusts quantity where needed
4. System calculates subtotal, discounts, tax, and total
5. Cashier selects payment mode
6. Customer pays
7. System completes bill, records shift payment, deducts stock
8. Receipt is shown or printed

Customer expectation:

- no surprise price jump at payment step
- payment feels final and trustworthy

Cashier pain points to avoid:

- missing shift
- slow product lookup
- losing bill after scanning many items

### Journey B: Customer pauses purchase

1. Basket is partially built
2. Customer leaves to check more items or compare products
3. Cashier holds the bill
4. Next customer is billed immediately
5. Original customer returns
6. Held bill is resumed and completed

Customer expectation:

- items and prices should still be there

Cashier expectation:

- held bill should resume in one or two clicks

### Journey C: Return with bill

1. Customer brings product and receipt or bill number
2. Cashier or manager finds the bill
3. System shows eligible items and quantities
4. Operator selects return items
5. Refund mode is chosen
6. Stock is restored
7. Shift refund entry is recorded
8. Customer gets refund confirmation

Customer expectation:

- refund value is clear before confirmation

Manager expectation:

- return should be controlled and auditable

### Journey D: Exchange

1. Customer returns one or more items
2. Cashier adds replacement items into a fresh basket
3. System compares refund value and new bill value
4. Operator collects difference or issues balance refund
5. Both return and new bill are linked operationally

This can be implemented in phases.

Phase 1:

- do return and fresh rebill as two explicit steps

Phase 2:

- add guided exchange workflow

### Journey E: Shift closure

1. Cashier counts physical drawer
2. System shows expected amount from shift entries
3. Cashier enters actual closing amount
4. System records variance
5. Manager can review differences later

Cashier expectation:

- close shift should not feel like accounting software

Manager expectation:

- variance should be explainable from entries and refunds

---

## 4) Full Departmental Store Use Case Catalog

### UC-DS-01 Open Shift

Actor: Cashier

Preconditions:

1. User is authenticated
2. No open shift already exists for same cashier

System behavior:

1. Accept opening balance
2. Create `CashShift` with `OPEN`
3. Show shift badge everywhere in POS shell

Failure cases:

1. Existing open shift
2. Missing auth context

### UC-DS-02 Product Lookup by Barcode

Actor: Cashier

Preconditions:

1. Shift open
2. Product active in inventory

System behavior:

1. Match exact barcode quickly
2. Add item to bill
3. Increment quantity if same item scanned again

Failure cases:

1. Barcode not found
2. Product inactive

### UC-DS-03 Product Lookup by Search

Actor: Cashier

System behavior:

1. Search by name, SKU, or known code
2. Return compact result list
3. Add on click or keyboard action

### UC-DS-04 Build Bill

Actor: Cashier

System behavior:

1. Show all lines clearly
2. Support quantity increase/decrease
3. Support decimal quantity for weighted items where applicable
4. Show subtotal, tax, discount, total live

### UC-DS-05 Choose Customer Context

Actor: Cashier

Modes:

1. walk-in anonymous
2. retail customer by phone/name
3. known customer linked for returns/history

Generic rule:

customer linkage is optional for fast POS, but customer details should be capturable when useful.

### UC-DS-06 Hold Bill

Actor: Cashier

System behavior:

1. Save basket as `HELD`
2. Keep it visible in holds queue
3. Do not deduct stock yet
4. Do not create shift payment entry yet

### UC-DS-07 Resume Held Bill

Actor: Cashier

System behavior:

1. Complete held bill with payment
2. Require warehouse context before completion
3. On completion, record shift payment and deduct stock

### UC-DS-08 Complete Bill

Actor: Cashier

System behavior:

1. Validate active shift
2. Validate bill has items
3. Validate payment details when needed
4. Create bill record
5. Create shift payment entry
6. Deduct stock
7. Return bill number to UI

### UC-DS-09 Cancel Bill

Actor: Manager or Admin

System behavior:

1. Only allowed under policy
2. Cancelled bill remains auditable

### UC-DS-10 Return / Refund

Actor: Manager or authorized operator

System behavior:

1. Search bill by bill number
2. Show original line items
3. Limit return quantity to sold quantity
4. Capture return reason and refund mode
5. Restore stock
6. Create refund shift entry

### UC-DS-11 Exchange

Actor: Cashier with manager support if policy requires

System behavior:

1. Return old line items
2. Build new sale basket
3. Settle delta amount

### UC-DS-12 Close Shift

Actor: Cashier / Manager

System behavior:

1. Enter closing amount
2. Compare against expected
3. Save difference
4. Mark shift closed

---

## 5) Customer Point of View Design Rules

### Speed

The customer should never feel that the cashier is fighting the software.

So the UI must:

1. keep scan/search on the main screen
2. keep totals always visible
3. keep payment action obvious

### Confidence

The customer must trust the receipt total.

So the UI must:

1. show discounts before final charge
2. show exact payment mode chosen
3. show change due for cash
4. show a clear success state with bill number

### Recovery

When something goes wrong, the customer should still be served smoothly.

So the UI must:

1. support hold bill
2. support return lookup
3. show errors in plain language

---

## 6) Manager Point of View Design Rules

1. Exception paths must be explicit, not hidden
2. Discount, cancel, and refund actions must be traceable
3. Held bills should not silently bypass stock or payment logic
4. Shift reports should reflect payments and refunds exactly

---

## 7) First Implementation Slice

The best first slice for departmental store is the POS transaction backbone.

### Implement now

1. billing page payload alignment with accounting bill API
2. warehouse-aware billing and held-bill completion
3. bill lookup and return payload alignment
4. better customer capture for walk-in and repeat customers

### Implement next

1. exchange workflow
2. manager override UI
3. PLU and barcode optimization
4. cashier shortcuts and keyboard flow
5. receipt print UX

---

## 8) Definition of Success for This Slice

This first departmental-store implementation slice is successful when:

1. cashier can create completed bill from POS reliably
2. cashier can hold and later complete a held bill reliably
3. manager can process bill return reliably
4. shift entries reflect bill payments and refunds correctly
5. stock deduction and stock restore run from the same generic services used by the wider platform