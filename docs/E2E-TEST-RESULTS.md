# E2E Test Results — ERP Microservices

**Test date:** 2025  
**Result:** 27 / 27 PASS  
**Test script:** `scripts/e2e-test.ps1`  
**Gateway:** `http://localhost:3010`  
**Seed tenant:** `simhapuri-fresh` / `admin@simhapurifresh.com`

---

## How to Run

```powershell
# Start all services first
pnpm turbo dev

# Then run the E2E test
powershell -ExecutionPolicy Bypass -File "scripts/e2e-test.ps1"
```

---

## Test Summary

| # | Test | Status |
|---|------|--------|
| 1 | Login | PASS |
| 2 | List Products (inventory) | PASS |
| 3 | Stock Receive | PASS |
| 4 | **UC2** Create Lead | PASS |
| 5 | **UC2** Create Customer | PASS |
| 6 | **UC2** Create Quote | PASS |
| 7 | **UC2** Create Order | PASS |
| 8 | **UC2** Confirm Order (`?action=confirm`) | PASS |
| 9 | **UC2** Ship Order (`?action=ship`) | PASS |
| 10 | **UC2** Invoice Order (`?action=invoice`) | PASS |
| 11 | **UC2** AR Invoice Auto-Created | PASS |
| 12 | **UC2** Issue AR Invoice (`?action=issue`) | PASS |
| 13 | **UC2** Pay AR Invoice (`?action=pay`) | PASS |
| 14 | **UC10** Create Sales Return | PASS |
| 15 | **UC3** Create Vendor | PASS |
| 16 | **UC3** Create PO | PASS |
| 17 | **UC3** Submit PO (`?action=submit`) | PASS |
| 18 | **UC3** Approve PO (`?action=approve`) | PASS |
| 19 | **UC3** Receive PO (`?action=receive`) | PASS |
| 20 | **UC3** AP Invoice Auto-Created | PASS |
| 21 | **UC4** Create Employee | PASS |
| 22 | **UC4** Create Payroll | PASS |
| 23 | **UC4** Process Payroll (→ journal) | PASS |
| 24 | **UC4** Pay Payroll (→ journal) | PASS |
| 25 | **Delivery** Order → AWAITING\_PICKUP | PASS |
| 26 | **Delivery** Order → OUT\_FOR\_DELIVERY | PASS |
| 27 | **Delivery** Order → DELIVERED (COD auto-paid) | PASS |

---

## UC2 — Lead-to-Cash

**State machine:** `Lead → Customer → Quote → SalesOrder (DRAFT → CONFIRMED → SHIPPED → INVOICED)`  
**AR Invoice auto-created:** yes, on `?action=invoice`  
**AR Invoice states:** `DRAFT → ISSUED → PAID`

### API Sequence

```
POST   /api/auth/login           { email, password }        → JWT token
GET    /api/products             ?limit=100                 → products list

POST   /api/stock/receive        { productId, warehouseId, qty, unitCost }  → stock added

POST   /api/leads                { name, phone, source }    → lead created
POST   /api/customers            { name, phone, email }     → customer created

POST   /api/quotes               {
  customerId, date, validUntil,
  items: [{ productId, productName, quantity, unitPrice, discount }]
}                                                           → quote created

POST   /api/orders               {
  customerId, date, paymentMethod,
  items: [{ productId, productName, quantity, unitPrice }]
}                                                           → order DRAFT

PATCH  /api/orders/:id?action=confirm  { warehouseId }       → CONFIRMED (stock reserved)
PATCH  /api/orders/:id?action=ship     {
  warehouseId,
  items: [{ orderItemId, shippedQty }]
}                                                           → SHIPPED
PATCH  /api/orders/:id?action=invoice  {}                    → INVOICED + AR Invoice DRAFT created

PATCH  /api/invoices/:id?action=issue  {}                    → AR Invoice ISSUED
PATCH  /api/invoices/:id?action=pay    {
  amount, method: "BANK_TRANSFER", date: ISO
}                                                           → PAID
```

### Key Notes

- `productName` is **required** in each order item (denormalized for history).
- `date` is required on order create — use `new Date().toISOString()`.
- `warehouseId` is required on `confirm` and `ship`.
- `ship` requires `items[]` with `orderItemId` and `shippedQty` (partial shipping supported).
- AR Invoice is auto-created when order transitions to `INVOICED`; `invoiceId` is returned.
- Pay endpoint requires `method` and `date` in addition to `amount`.

---

## UC3 — Procure-to-Pay

**State machine:** `PO (DRAFT → SUBMITTED → APPROVED → RECEIVED)`  
**AP Invoice auto-created:** yes, on `?action=receive`

### API Sequence

```
POST   /api/vendors              { name, phone, email }    → vendor created

POST   /api/purchase-orders      {
  vendorId, date,
  items: [{ productId, productName, quantity, unitPrice }]
}                                                          → PO DRAFT

PATCH  /api/purchase-orders/:id?action=submit    {}        → SUBMITTED
PATCH  /api/purchase-orders/:id?action=approve   {}        → APPROVED

PATCH  /api/purchase-orders/:id?action=receive   {
  warehouseId,
  items: [{ orderItemId, receivedQty }]
}                                                          → RECEIVED + stock added + AP Invoice DRAFT
```

### Key Notes

- Partial receiving supported: use `PARTIALLY_RECEIVED` state.
- AP Invoice auto-created on full or partial receive.
- `productName` required in PO items.

---

## UC4 — Hire-to-Payroll

**State machine:** `Payroll (DRAFT → PROCESSED → PAID)`  
**Journal entries:** auto-posted on `process` (salary expense) and `pay` (bank payment)

### API Sequence

```
POST   /api/employees            {
  employeeId, firstName, lastName, email,
  department, position, hireDate, salary
}                                                          → employee created

POST   /api/payroll              {
  employeeId,          ← string ID (not DB id)
  period: "YYYY-MM",
  allowances: 0,
  deductions: 0
}                                                          → payroll DRAFT (netSalary calculated)

PATCH  /api/payroll/:id?action=process  {}                 → PROCESSED + journal posted
                                                              Dr Salary Expense (6000)
                                                              Cr Salary Payable (2100)

PATCH  /api/payroll/:id?action=pay      {}                 → PAID + journal posted
                                                              Dr Salary Payable (2100)
                                                              Cr Cash & Bank (1010)
```

### Key Notes

- `employeeId` in payroll create is the **employee's ID string** (e.g. `EMP-001`), not the DB `id`.
- `period` format is `"YYYY-MM"` (e.g. `"2026-05"`).
- `netSalary = salary + allowances - deductions`.
- Journal entries use account codes; journals route resolves code → accountId internally.

---

## UC10 — Sales Return (Partial)

**State machine:** `SalesReturn (PENDING → APPROVED → COMPLETED)`  
**Credit Note auto-created:** yes, on `COMPLETED`

### API Sequence (tested: creation only)

```
POST   /api/returns              {
  orderId,
  items: [{ orderItemId, quantity, reason }]
}                                                          → SalesReturn PENDING

PATCH  /api/returns/:id?action=approve   {}                → APPROVED
PATCH  /api/returns/:id?action=complete  {}                → COMPLETED + stock restored + CreditNote
```

### Key Notes

- Return quantity validated against `shippedQty` on the order item.
- `reason` is required per line.
- Credit note auto-issued on `complete`.

---

## Grocery Delivery Flow

**State machine (online orders):** `CONFIRMED → AWAITING_PICKUP → OUT_FOR_DELIVERY → DELIVERED`  
**COD orders:** `paymentStatus` auto-set to `PAID` on `delivered`.

### API Sequence

```
POST   /api/orders               {
  customerId, date,
  isOnlineOrder: true,
  paymentMethod: "COD",
  items: [{ productId, productName, quantity, unitPrice }]
}                                                          → order DRAFT

PATCH  /api/orders/:id?action=confirm        { warehouseId }   → CONFIRMED
PATCH  /api/orders/:id?action=awaiting_pickup {}               → AWAITING_PICKUP
PATCH  /api/orders/:id?action=out_for_delivery {}              → OUT_FOR_DELIVERY
PATCH  /api/orders/:id?action=delivered      {}                → DELIVERED (COD: paymentStatus=PAID)
```

### Key Notes

- Delivery flow does **NOT** use the `ship` action. Ship is for B2B warehouse dispatch.
- `awaiting_pickup` requires `CONFIRMED` status (not `SHIPPED`).
- UPI / prepaid online orders: `paymentStatus` remains as set; COD auto-marks paid on delivery.

---

## API Conventions

### All State Transitions

```
PATCH /{resource}/{id}?action={actionName}
```

Never `POST /{resource}/{id}/{action}`.

### Response Shape

```json
// List
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 5, "pages": 1 } }

// Single
{ "data": { ... } }

// Error
{ "error": "message" }
```

### Auth Headers (all protected routes)

```
Authorization: Bearer <jwt>
x-tenant-id: <tenantId>
```

### Pagination

```
GET /api/resource?page=1&limit=20
```

---

## Account Codes (Chart of Accounts)

| Code | Name | Used By |
|------|------|---------|
| 1010 | Cash & Bank | Payroll pay |
| 1020 | Accounts Receivable | AR invoices |
| 2010 | Accounts Payable | AP invoices |
| 2100 | Salary Payable | Payroll process |
| 2110 | TDS Payable | Payroll process |
| 2120 | Deductions Payable | Payroll process |
| 4010 | Sales Revenue | Sales invoices |
| 6000 | Salary Expense | Payroll process |

---

## Known Gaps / Pending Flows

| UC | Flow | Status |
|----|------|--------|
| UC2 | Quote → Order auto-convert | Pending |
| UC6 | Financial Reporting (P&L, Balance Sheet) | Pending |
| UC7 | Product Catalogue & Pricing | Pending |
| UC8 | Tax Management | Pending |
| UC9 | Fixed Assets & Multi-Currency | Pending |
| UC10 | Sales Return approval → complete → credit note | Partial (create only tested) |
| UC11 | Purchase Return full cycle | Pending |
| — | Delivery app driver assignment | Pending |
| — | POS shift open/close | Pending |
| — | Customer portal order tracking | Pending |

---

## Services & Ports

| Service | Port | Domains |
|---------|------|---------|
| gateway | 3010 | Auth, Tenants, Admin UI |
| sales | 3001 | Leads, Customers, Quotes, Orders, Returns |
| inventory | 3002 | Products, Warehouses, Stock |
| accounting | 3003 | CoA, Journals, Invoices, Credit/Debit Notes |
| hr | 3004 | Employees, Payroll |
| procurement | 3005 | Vendors, Purchase Orders |
