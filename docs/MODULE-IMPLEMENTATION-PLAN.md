# Module Implementation Plan

## Objective

Deliver ERP capabilities module by module, completing one module end-to-end (API, UI, roles, E2E, operations) before starting the next.

## Delivery Principle

- Finish one module fully, then move forward.
- Prioritize market-critical workflows over broad but shallow coverage.
- Every module release must include:
  - Happy path
  - Exception path
  - Role authorization checks
  - E2E automation
  - Operational readiness (seed data, runbook, monitoring)

## Current Sequence (Approved)

1. Sales (first focus)
2. Procurement
3. Inventory hardening (advanced controls)
4. HR/Payroll hardening
5. Accounting hardening and reporting
6. Delivery and channel apps hardening

Rationale:
- Sales delivers fastest business value and touches core cross-service behavior.
- Procurement and payroll complete the operating cycle.
- Accounting/reporting hardening comes after transaction flows stabilize.

## Scope Per Module (Market-Ready V1)

## 1) Gateway (Platform Core)

In scope:
- Login, register, refresh, logout, forgot/reset password
- Tenant switch, invitation acceptance, member role lifecycle
- Module access control and secure proxy routing
- Security audit for auth and membership events

Exit criteria:
- Role-based auth and tenant boundaries validated by E2E
- Stable auth flows and no cross-tenant leakage

## 2) Sales (Lead-to-Cash + Returns)

In scope:
- Leads, opportunities, quotes, customers
- Sales order states: DRAFT, CONFIRMED, PARTIALLY_SHIPPED, SHIPPED, INVOICED, CANCELLED
- Credit limit validation at confirm
- Invoice generation and payment lifecycle linkage
- Sales return baseline and credit-note linkage

Exit criteria:
- UC2 complete with happy + exception flows
- UC10 complete for create, approve, complete
- Role and state-machine constraints validated by E2E

## 3) Inventory

In scope:
- Products, categories, brands, variants
- Warehouses and stock operations (reserve/release/deduct/receive/transfer)
- Stock movement traceability and low-stock alerting

Exit criteria:
- No negative stock in tested flows
- Reservation and deduction consistency under retries

## 4) Procurement

In scope:
- Vendor management
- PO states: DRAFT, SUBMITTED, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
- Receive flow with stock update and AP linkage
- Purchase return baseline

Exit criteria:
- UC3 complete with approvals and receive scenarios
- AP linkage validated and role checks enforced

## 5) Accounting

In scope:
- Chart of accounts, journals, AR/AP invoice lifecycle
- Credit/debit notes baseline
- Payment posting
- Tax rate baseline

Exit criteria:
- Auto-posting reconciliation for sales, procurement, payroll
- Trial-balance consistency checks pass

## 6) HR

In scope:
- Employee master
- Leave baseline
- Payroll states: DRAFT, PROCESSED, PAID
- Accounting journal integration

Exit criteria:
- UC4 complete with accounting posting verification

## 7) Delivery

In scope:
- Assignment lifecycle
- Delivery status transitions for online orders
- COD settlement behavior

Exit criteria:
- End-to-end order delivery transition consistency

## 8) POS

In scope:
- Shift open/close
- Billing, hold/resume, returns baseline
- Accounting and stock integration

Exit criteria:
- Shift closure and billing reconciliation validated

## 9) Customer App

In scope:
- Browse, cart, checkout, order history, profile basics

Exit criteria:
- Checkout-to-order pipeline verified into core services

## 10) Delivery App

In scope:
- Assignment view and status updates
- Earnings summary baseline

Exit criteria:
- Assignment and order status sync validated

## Focus Module Decision: Sales First

This plan now locks Sales as the active module until all target use cases are complete.

## Sales Completion Plan (Do Not Move Module Until Done)

## A. Use Cases to Complete

- UC2 Lead-to-Cash (full)
- UC10 Sales Return and Credit Note (full)

## B. Functional Checklist

1. Master Data and CRM
- Customer CRUD with block/unblock
- Lead CRUD with conversion readiness
- Opportunity and quote lifecycle baseline

2. Order Lifecycle
- Create order from customer and from quote
- Confirm with credit-limit checks
- Reserve stock on confirm
- Partial and full ship with shipped-qty guardrails
- Invoice transition with AR creation
- Cancel with reservation release and compensation handling

3. Invoicing and Payment Link
- AR invoice creation and status transitions
- Issue and pay flows with method/date validation
- Source reference traceability (order -> invoice)

4. Returns
- Sales return creation with shippedQty validation
- Approve and complete transitions
- Stock restore and credit note issuance linkage

5. Security and Roles
- ADMIN/MANAGER/USER behavior matrix finalized
- Restricted transitions return 403 consistently

6. API Contract Hardening
- Standard response shape across endpoints
- Pagination and filters on list endpoints
- zod validation and conflict handling for key mutations

7. UI Completion
- Customers, leads, quotes, orders, invoices, returns pages
- Action buttons mapped to state machine transitions
- Error messaging for business-rule failures

8. E2E Completion
- Happy paths for UC2 and UC10
- Negative paths (credit limit, invalid transition, over-return qty)
- Role-based path validations

## C. Quality Gates to Exit Sales

All must pass:
- 0 critical defects in UC2 and UC10
- State transitions verified and idempotency checked
- E2E API and role suites passing in CI/local
- UAT checklist signed for sales personas
- Documentation updated with final API and UI test guide

## D. Only Then Move to Procurement

Next module can start only after Sales exit gate is satisfied.

## Execution Cadence (per module)

1. Design freeze
2. API completion
3. UI completion
4. E2E and role validation
5. UAT signoff
6. Release + handover

No parallel feature expansion in next module before step 6.

## Immediate Next Action

Start Sales deep-focus sprint with two tracks:
- Track 1: UC2 completion and exception handling hardening
- Track 2: UC10 completion including credit-note linkage and E2E negative tests
