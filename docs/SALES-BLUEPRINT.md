# Sales Module Blueprint (Lead-to-Cash + Returns)

Status: Proposed implementation blueprint  
Scope: UC2 Lead-to-Cash and UC10 Sales Return/Credit Note  
Services: sales (owner), inventory (stock ops), accounting (AR/Credit Note), gateway (auth/tenant)

## 1) Complete Use Case Catalog

### UC2.1 Create Lead
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User selects "New Lead"
- Preconditions:
  - Authenticated user with sales module access
  - tenantId available from `x-tenant-id` header
- Main flow:
  1. User enters lead profile (name, contact, source, expected value)
  2. System validates required fields
  3. Sales service stores lead with tenant scoping
  4. System returns created lead
- Exception flow:
  - Validation fails -> 400 with first zod error message
- Outcome: Lead in OPEN state

### UC2.2 Qualify/Update Lead
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: Edit lead details or status
- Preconditions: Lead exists and belongs to tenant
- Main flow:
  1. User edits lead details/status
  2. System validates transition and fields
  3. Lead is updated and audit activity is appended
- Exception flow:
  - Lead not found -> 404
  - Invalid transition -> 400
- Outcome: Lead status updated

### UC2.3 Convert Lead to Opportunity
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User clicks "Convert to Opportunity"
- Preconditions:
  - Lead status allows conversion
  - Required account/contact data is available
- Main flow:
  1. System creates opportunity linked by leadId
  2. Lead marked as CONVERTED
  3. Response returns both updated lead and opportunity
- Exception flow:
  - Duplicate conversion attempt -> 409
- Outcome: Opportunity in OPEN state

### UC2.4 Create/Progress Opportunity
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User creates or edits opportunity
- Preconditions: Customer/lead exists within same tenant
- Main flow:
  1. Capture deal value, expected close date, probability, stage
  2. Validate stage transition
  3. Persist and return opportunity
- Exception flow:
  - Invalid stage transition -> 400
- Outcome: Opportunity lifecycle tracked

### UC2.5 Create Quote (DRAFT)
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User selects "Create Quote"
- Preconditions:
  - Customer exists and active
  - Product/price data is available
- Main flow:
  1. User adds line items and terms
  2. System calculates subtotal, discount, tax, grand total
  3. Quote saved as DRAFT
- Exception flow:
  - Missing/invalid items -> 400
- Outcome: Quote created in DRAFT

### UC2.6 Send Quote
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User clicks "Send"
- Preconditions:
  - Quote is DRAFT
  - Quote has at least one valid line item
- Main flow:
  1. Transition DRAFT -> SENT
  2. Optional outbound notification recorded
- Exception flow:
  - Invalid state transition -> 400
- Outcome: Quote in SENT

### UC2.7 Accept/Reject Quote
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User marks customer response
- Preconditions: Quote is SENT
- Main flow:
  1. Transition SENT -> ACCEPTED or SENT -> REJECTED
  2. If ACCEPTED, quote can generate order
- Exception flow:
  - Already finalized quote -> 409
- Outcome: Quote finalized

### UC2.8 Create Sales Order (from quote or direct)
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User selects "Create Order"
- Preconditions:
  - Customer active
  - Valid item list with price and quantity
- Main flow:
  1. Create order in DRAFT
  2. Store line-level orderedQty and unit pricing
  3. Return order summary
- Exception flow:
  - Invalid product or pricing data -> 400
- Outcome: Order in DRAFT

### UC2.9 Confirm Sales Order with Credit and Stock Reservation
- Actors: ADMIN, MANAGER (recommended), SALES_REP (if policy allows)
- Trigger: User clicks "Confirm"
- Preconditions:
  - Order in DRAFT
  - Customer credit policy available
- Main flow:
  1. Check credit exposure against customer credit limit
  2. Call inventory reserve API for order items
  3. On success, transition DRAFT -> CONFIRMED
- Exception flow:
  - Credit limit exceeded -> 403
  - Reserve failure (insufficient stock) -> 409
  - Downstream inventory unavailable -> 503
- Outcome: Stock reserved, order CONFIRMED

### UC2.10 Ship Sales Order (Partial/Full)
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User clicks "Ship"
- Preconditions:
  - Order is CONFIRMED or PARTIALLY_SHIPPED
  - Ship qty <= remaining qty per line
- Main flow:
  1. Validate shipment quantities
  2. Call inventory deduct API
  3. Update shippedQty per line
  4. Transition to PARTIALLY_SHIPPED or SHIPPED
  5. Create or update AR invoice in accounting
- Exception flow:
  - Over-shipment attempt -> 400
  - Accounting invoice creation failure -> compensate stock deduction and return 500
- Outcome: Shipment posted with inventory and AR consistency

### UC2.11 Cancel Sales Order
- Actors: ADMIN, MANAGER
- Trigger: User clicks "Cancel"
- Preconditions:
  - Order is DRAFT or CONFIRMED (policy controlled)
  - If shipped quantity exists, cancellation blocked
- Main flow:
  1. If reservation exists, call inventory release
  2. Transition to CANCELLED
- Exception flow:
  - Invalid state (already shipped/invoiced) -> 400
  - Release failure -> 500 and no transition
- Outcome: Order cancelled safely

### UC2.12 Invoice and Payment Lifecycle (AR)
- Actors: ACCOUNTANT, ADMIN, MANAGER
- Trigger: Shipment posts invoice or finance user issues invoice manually where allowed
- Preconditions:
  - Shipment/order linkage exists
- Main flow:
  1. Accounting creates AR invoice with sourceRef
  2. Invoice transitions through ISSUE/PARTIAL PAID/PAID
  3. Payment events sync status back to sales view model
- Exception flow:
  - Duplicate invoice sourceRef -> 409
- Outcome: Receivable lifecycle traceable from order

### UC10.1 Create Sales Return
- Actors: ADMIN, MANAGER, SALES_REP
- Trigger: User creates return request
- Preconditions:
  - Referenced order/shipment exists
  - returnQty <= shippedQty - alreadyReturnedQty
- Main flow:
  1. User enters reason and return lines
  2. System validates quantity against shipped quantities
  3. Return created in PENDING
- Exception flow:
  - Excess return quantity -> 400
- Outcome: Return request captured

### UC10.2 Approve/Reject Sales Return
- Actors: ADMIN, MANAGER
- Trigger: Approver action
- Preconditions: Return in PENDING
- Main flow:
  1. Transition to APPROVED or REJECTED
  2. Approval metadata stored (actor/time)
- Exception flow:
  - Unauthorized role -> 403
- Outcome: Controlled return governance

### UC10.3 Complete Sales Return (Stock + Credit Note)
- Actors: ADMIN, MANAGER
- Trigger: User clicks "Complete"
- Preconditions: Return in APPROVED
- Main flow:
  1. Call inventory receive-return to add stock
  2. Call accounting create-credit-note
  3. Transition return APPROVED -> COMPLETED
- Exception flow:
  - Credit note creation fails -> compensate inventory adjustment and return 500
  - Inventory failure -> 503
- Outcome: Stock restored and credit note issued

## 2) State-Machine Diagram (Text)

### Lead
OPEN -> QUALIFIED -> CONVERTED
OPEN -> LOST
QUALIFIED -> LOST

Rules:
- CONVERTED and LOST are terminal states.

### Opportunity
OPEN -> PROPOSAL
PROPOSAL -> NEGOTIATION
NEGOTIATION -> WON
NEGOTIATION -> LOST
OPEN -> LOST

Rules:
- WON and LOST are terminal states.

### Quote
DRAFT -> SENT
SENT -> ACCEPTED
SENT -> REJECTED

Rules:
- ACCEPTED and REJECTED are terminal states.
- Only DRAFT quotes are editable.

### Sales Order
DRAFT -> CONFIRMED
CONFIRMED -> PARTIALLY_SHIPPED
PARTIALLY_SHIPPED -> SHIPPED
SHIPPED -> INVOICED
CONFIRMED -> CANCELLED
DRAFT -> CANCELLED

Rules:
- CANCELLED is terminal.
- Once SHIPPED, cancellation is blocked.
- INVOICED only when accounting invoice exists and is linked.

### Sales Return
PENDING -> APPROVED
PENDING -> REJECTED
APPROVED -> COMPLETED

Rules:
- REJECTED and COMPLETED are terminal.
- COMPLETE requires successful inventory + accounting operations.

### Credit Note
ISSUED -> APPLIED
ISSUED -> REFUNDED

Rules:
- APPLIED and REFUNDED are terminal.

## 3) Screen-by-Screen UX Flow

### Sales Workspace Information Architecture
- Sales Home
- Leads
- Opportunities
- Quotes
- Orders
- Invoices (view/proxy)
- Returns
- Customers
- Activities

### Core UX Principles
- Always show current status and next valid actions.
- Use workflow-driven actions (primary action based on current state).
- Keep list page action latency low with inline quick actions.
- Keep right-side timeline panel for audit/activity on all transaction detail pages.

### Screen Flows

#### A. Leads
1. Leads List
- Components: search, owner filter, status filter, quick create
- Row actions: view, edit, qualify, convert, mark lost

2. Lead Create/Edit Drawer
- Fields: contact, source, expected value, next follow-up
- Save as draft style interaction with instant validation hints

3. Lead Detail
- Panels: profile, notes, activity timeline, linked opportunity
- Primary CTA changes by state (Qualify / Convert / Mark Lost)

#### B. Opportunities
1. Opportunity List
- Pipeline board toggle and table toggle
- Stage movement with confirmation modal

2. Opportunity Detail
- Deal summary card, probability, expected close
- CTA: Create Quote

#### C. Quotes
1. Quote Builder
- Split layout: line items left, totals/terms right
- Inline product search and quantity editor

2. Quote Detail
- Header status chip + action rail: Send / Accept / Reject / Clone
- Read-only lock after finalization

#### D. Orders
1. Order List
- Saved filters: "Needs Confirmation", "Partially Shipped", "Ready to Invoice"
- Bulk actions for print/export; state transitions remain single-order with guardrails

2. Order Detail
- Stepper: Draft -> Confirmed -> Partially Shipped -> Shipped -> Invoiced
- Item-level fulfillment table with ordered, shipped, remaining quantities
- Primary CTA by state:
  - DRAFT: Confirm
  - CONFIRMED/PARTIALLY_SHIPPED: Ship
  - SHIPPED: View Invoice

3. Ship Modal
- Per-line ship quantity controls with remaining cap
- Pre-submit validations surfaced inline

#### E. Returns
1. Return Create
- Requires source order selection first
- Auto-populates shippable lines and max returnable qty

2. Return Detail
- Stepper: Pending -> Approved -> Completed
- Actions gated by role and state

3. Completion Review Modal
- Shows impacted stock and expected credit-note amount before commit

#### F. Invoices (Sales Lens)
1. Invoice List/Detail (read + action depending on role)
- Clear sourceRef back-link to order
- Payment status chips and overdue indicators

### Global UX Enhancements for Better Experience
- Universal command bar for "Create Lead", "Create Quote", "Create Order", "Create Return".
- Sticky action bar on transaction detail pages.
- Unsaved changes guard on all editable forms.
- Empty states with single clear CTA and sample data hint.
- Keyboard-first data entry in item tables.

## 4) Role/Permission Matrix

Legend: C=create, R=read, U=update, A=approve/transition, X=cancel, P=post/financial

| Capability | ADMIN | MANAGER | SALES_REP | ACCOUNTANT | USER |
|---|---|---|---|---|---|
| Leads (C/R/U) | Yes | Yes | Yes | Read | Read |
| Lead convert | Yes | Yes | Yes | No | No |
| Opportunities (C/R/U) | Yes | Yes | Yes | Read | Read |
| Quotes (C/R/U) | Yes | Yes | Yes | Read | Read |
| Quote send/accept/reject | Yes | Yes | Yes | No | No |
| Orders create/edit draft | Yes | Yes | Yes | Read | Read |
| Order confirm | Yes | Yes | Conditional | No | No |
| Order ship | Yes | Yes | Yes | No | No |
| Order cancel | Yes | Yes | No | No | No |
| Returns create | Yes | Yes | Yes | Read | Read |
| Returns approve/reject | Yes | Yes | No | No | No |
| Returns complete | Yes | Yes | No | No | No |
| AR invoice issue/payment post | Yes | Policy | No | Yes | No |
| View financial fields (credit exposure, aging) | Yes | Yes | Limited | Yes | No |

Policy notes:
- SALES_REP order confirm can be disabled tenant-by-tenant.
- ACCOUNTANT can own invoice/payment transitions in strict finance mode.

## 5) Validation and Exception Rules

### Mandatory Validation Rules
1. tenantId always from header, never from payload.
2. List endpoints enforce page/limit with bounded values.
3. Order confirm requires credit check before reserve call.
4. Ship quantity must satisfy: 0 < shipQty <= remainingQty.
5. Return quantity must satisfy: 0 < returnQty <= (shippedQty - previouslyReturnedQty).
6. State transition must be allowed by state machine matrix.
7. Customer must be active for quote/order creation.
8. Only terminal-safe transitions on finalized states.

### Error Mapping Standard
- 400: zod validation errors or invalid transition
- 401: missing/invalid auth token
- 403: role denied or credit policy fail
- 404: missing resource
- 409: duplicate/ref conflict or stock reserve conflict
- 500: unexpected server failure
- 503: downstream service unavailable

### Compensation Rules
1. Ship flow:
- If inventory deduct succeeds and accounting invoice fails, reverse inventory via compensating adjustment and keep order state unchanged.

2. Return completion:
- If inventory receive succeeds and credit note creation fails, reverse stock receipt and keep return in APPROVED.

3. Confirm flow:
- No state transition to CONFIRMED unless reserve succeeds.

### Idempotency Rules
- Confirm, ship, complete-return endpoints should accept idempotency key in headers for retried requests.
- Duplicate idempotency key with same payload returns previous success response.

## 6) API and Data Touchpoint Map

## 6.1 Sales Service Endpoints (Primary)

Leads
- POST /api/leads
- GET /api/leads?page=&limit=&status=&ownerId=
- GET /api/leads/:id
- PATCH /api/leads/:id
- POST /api/leads/:id/convert

Opportunities
- POST /api/opportunities
- GET /api/opportunities?page=&limit=&stage=
- GET /api/opportunities/:id
- PATCH /api/opportunities/:id

Quotes
- POST /api/quotes
- GET /api/quotes?page=&limit=&status=
- GET /api/quotes/:id
- PATCH /api/quotes/:id
- POST /api/quotes/:id/send
- POST /api/quotes/:id/accept
- POST /api/quotes/:id/reject

Orders
- POST /api/orders
- GET /api/orders?page=&limit=&status=&customerId=
- GET /api/orders/:id
- PATCH /api/orders/:id
- POST /api/orders/:id/confirm
- POST /api/orders/:id/ship
- POST /api/orders/:id/cancel

Returns
- POST /api/sales-returns
- GET /api/sales-returns?page=&limit=&status=
- GET /api/sales-returns/:id
- POST /api/sales-returns/:id/approve
- POST /api/sales-returns/:id/reject
- POST /api/sales-returns/:id/complete

Response contract (all endpoints):
- Success list: { data: T[], meta: { page, limit, total, pages } }
- Success single: { data: T }
- Error: { error: string }

## 6.2 Cross-Service Touchpoints

Inventory
- POST /api/stock/reserve (on order confirm)
- POST /api/stock/release (on order cancel/unconfirm)
- POST /api/stock/deduct (on shipment)
- POST /api/stock/receive-return (on approved return completion)
- POST /api/stock/adjustment (compensation fallback)

Accounting
- POST /api/invoices/ar (on shipment/full or partial policy)
- POST /api/invoices/:id/payments (on payment posting)
- POST /api/credit-notes (on sales return completion)

## 6.3 Data Touchpoint Matrix

| Sales Entity | Inventory Touchpoint | Accounting Touchpoint | Key Fields |
|---|---|---|---|
| SalesOrder confirm | reserve | none | tenantId, orderId, items[] |
| SalesOrder ship | deduct | create AR invoice | tenantId, orderId, shipment lines, totals |
| SalesOrder cancel | release | none | tenantId, orderId, reserved lines |
| SalesReturn complete | receive-return | create credit note | tenantId, returnId, sourceOrderId, lines |

## 6.4 End-to-End Sequence Snapshots

### Confirm Order
1. Sales validates state + role + credit.
2. Sales -> Inventory reserve.
3. Inventory success.
4. Sales updates state to CONFIRMED.

### Ship Order
1. Sales validates remaining quantities.
2. Sales -> Inventory deduct.
3. Inventory success.
4. Sales -> Accounting create AR invoice.
5. If accounting fails -> Sales compensates inventory and returns error.
6. If both succeed -> Sales transitions to PARTIALLY_SHIPPED or SHIPPED.

### Complete Return
1. Sales validates APPROVED return state.
2. Sales -> Inventory receive-return.
3. Sales -> Accounting create credit note.
4. If accounting fails -> compensate inventory receipt.
5. On success -> transition to COMPLETED.

## 7) Implementation Checklist

- Build state transition guard utility for quotes, orders, returns.
- Add credit limit evaluator at confirm endpoint.
- Add shipped/returned quantity validator used by ship and return endpoints.
- Add compensation handlers around inventory/accounting dual-step operations.
- Add timeline/audit events for all transitions.
- Add role-aware action rendering on UI detail screens.
- Add E2E suites for UC2 happy/negative and UC10 happy/negative.

## 8) Done Criteria for Sales Module

1. All UC2 and UC10 use cases implemented with success and exception handling.
2. All transitions blocked when invalid by state, role, or quantity constraints.
3. Cross-service compensation tested for ship and return completion failures.
4. UI supports full operator journey without hidden/manual workarounds.
5. E2E tests pass for role matrix and critical negative cases.
