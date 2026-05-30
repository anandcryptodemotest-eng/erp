# UI Testing Guide — Simhapuri Fresh ERP

**Admin Portal:** http://localhost:3010  
**Login:** admin@simhapurifresh.com / Admin@123

Test each use case in order. Confirm completion before moving to the next.

---

## UC-PRE: Prerequisites — Add Stock
**Pages:** Products  
**Must do before UC2 and UC3**

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to **Products** | 4 products listed (Banana, Tomato, Milk, Basmati Rice) |
| 2 | Click **+ Receive Stock** on any product | Stock receive form opens |
| 3 | Enter Qty: `50`, Unit Cost: `20` | — |
| 4 | Click **Save** | Success message, stock updated |

✅ **Done when:** Products show stock > 0

---

## UC2: Lead-to-Cash (B2B Sales Order)
**Pages:** Customers → Orders → Invoices  
**Flow:** Customer → Order(DRAFT→CONFIRMED→SHIPPED→INVOICED) → AR Invoice(DRAFT→ISSUED→PAID)

| Step | Page | Action | Expected Result |
|------|------|--------|-----------------|
| 1 | **Customers** | Click **+ New Customer** | Form opens |
| 2 | | Fill: Name=`Test Retailer`, Phone=`9100000001`, Email=`retailer@test.com` | — |
| 3 | | Click **Create** | Customer appears in list |
| 4 | **Orders** | Click **+ New Order** | Order form opens |
| 5 | | Select customer: `Test Retailer` | — |
| 6 | | Select product, Qty=`5`, Price auto-filled | — |
| 7 | | Click **Create Order** | Order in list with status `DRAFT` |
| 8 | | Click **Confirm** on the order | Status → `CONFIRMED` |
| 9 | | Click **Ship All** | Status → `SHIPPED` |
| 10 | | Click **Invoice** | Status → `INVOICED` |
| 11 | **Invoices** | Refresh — new AR invoice with status `DRAFT` | Invoice in list |
| 12 | | Click **Issue** button | Status → `ISSUED` |
| 13 | | Click **Pay** button | Pay modal opens |
| 14 | | Amount pre-filled, Method=`BANK_TRANSFER`, Date=today | — |
| 15 | | Click **Confirm** | Status → `PAID` |

✅ **Done when:** Invoice shows `PAID`

---

## UC3: Procure-to-Pay (Purchase from Vendor)
**Pages:** Vendors → Purchase Orders  
**Flow:** Vendor → PO(DRAFT→SUBMITTED→APPROVED→RECEIVED) → AP Invoice auto-created

| Step | Page | Action | Expected Result |
|------|------|--------|-----------------|
| 1 | **Vendors** | Click **+ New Vendor** | Form opens |
| 2 | | Fill: Name=`Fresh Farms`, Phone=`9200000001`, Email=`farms@test.com` | — |
| 3 | | Click **Create** | Vendor in list |
| 4 | **Purchase Orders** | Click **+ New PO** | PO form opens |
| 5 | | Select vendor: `Fresh Farms` | — |
| 6 | | Select product, Qty=`100`, Price auto-filled | — |
| 7 | | Click **Create PO** | PO in list with status `DRAFT` |
| 8 | | Click **Submit** | Status → `SUBMITTED` |
| 9 | | Click **Approve** | Status → `APPROVED` |
| 10 | | Click **Receive All** | Status → `RECEIVED`, stock increased |
| 11 | **Invoices** | Refresh — new AP invoice with status `DRAFT` | Invoice in list (type=AP) |

✅ **Done when:** PO shows `RECEIVED` and AP invoice appears

---

## UC4: Hire-to-Payroll
**Pages:** Employees → Payroll  
**Flow:** Employee → Payroll(DRAFT→PROCESSED→PAID) → Journal entries posted

| Step | Page | Action | Expected Result |
|------|------|--------|-----------------|
| 1 | **Employees** | Click **+ New Employee** | Form opens |
| 2 | | Employee ID: `EMP-101` | — |
| 3 | | First Name: `Ravi`, Last Name: `Kumar` | — |
| 4 | | Email: `ravi.kumar@simhapuri.com` | — |
| 5 | | Position: `Store Manager`, Department: `Operations` | — |
| 6 | | Salary: `30000`, Hire Date: (today's date) | — |
| 7 | | Click **Create** | Employee in list |
| 8 | **Payroll** | Click **+ Create Payroll** | Form opens |
| 9 | | Select employee: `Ravi Kumar (EMP-101)` | — |
| 10 | | Period: `2026-05`, Allowances: `2000`, Deductions: `800` | — |
| 11 | | Click **Generate** | Payroll in list, status=`DRAFT`, Net=`31200` |
| 12 | | Click **Process** | Status → `PROCESSED` (journal posted) |
| 13 | | Click **Mark Paid** | Status → `PAID` (bank journal posted) |

✅ **Done when:** Payroll shows `PAID`

---

## UC5: Inventory Stock Management
**Pages:** Products  
**Flow:** Receive stock → verify quantities update

| Step | Page | Action | Expected Result |
|------|------|--------|-----------------|
| 1 | **Products** | View all products | 4 products listed with current stock |
| 2 | | Click **+ Receive Stock** on `Basmati Rice` | Receive form opens |
| 3 | | Qty: `200`, Unit Cost: `85` | — |
| 4 | | Click **Save** | Stock updated, value shown |
| 5 | | Verify stock shows `200` for Basmati Rice | — |

✅ **Done when:** Stock numbers update correctly

---

## UC-DELIVERY: Grocery Delivery (Online Order)
**Note:** This flow requires API testing — no UI page exists for delivery transitions yet.  
Use the E2E test script or Postman for now.

**State Machine:** `DRAFT → CONFIRMED → AWAITING_PICKUP → OUT_FOR_DELIVERY → DELIVERED`

---

## Checklist

| UC | Name | Status |
|----|------|--------|
| PRE | Add Stock | ⬜ Pending |
| UC2 | Lead-to-Cash | ⬜ Pending |
| UC3 | Procure-to-Pay | ⬜ Pending |
| UC4 | Hire-to-Payroll | ⬜ Pending |
| UC5 | Inventory Stock | ⬜ Pending |
| DELIVERY | Grocery Delivery | ⬜ API only |
