# Trading journey — screen-by-screen

Customer mobile order → Sales executive call & edit → stock / procurement → pricing → dispatch.

Admin nav defaults to this journey (CRM hidden). Workflow template: `workflow.oms_trading`.

---

## A. Customer mobile (`apps/customer` · :3007)

| # | Screen | User does | System |
|---|--------|-----------|--------|
| 1 | Login / OTP | Signs in as customer | JWT + tenant; role `CUSTOMER` |
| 2 | Product list | Browses plywood / blockboard / laminates | Category filters; **Size** dropdown from category list |
| 3 | Product detail | Picks size / thickness / qty | Validates against attribute definitions |
| 4 | Cart | Reviews lines | Local cart → checkout |
| 5 | Checkout | Confirms address / notes | `POST /api/orders` → status **DRAFT** or **PENDING_SALES_REVIEW** |
| 6 | My orders | Tracks status | Read-only; sees review / dispatch updates |

**Out of scope for v1 mobile:** editing after submit (SE does that on call).

---

## B. Sales executive — Order desk (admin)

Landing: **OMS Workflow** (`/oms`).

| # | Screen | User does | OMS action / status |
|---|--------|-----------|---------------------|
| 1 | OMS queue | Opens new mobile orders | Filter `PENDING_SALES_REVIEW` |
| 2 | Order detail / Orders | Calls customer; changes lines, size, qty, notes | Edit via **Orders** (`/orders`) while in review |
| 3 | Complete sales review | Locks commercial intent with customer | Action **review** → `REVIEWED` |
| 4 | Verify stock | Checks warehouse availability | Action **verify-stock** → `STOCK_VERIFIED` (or shortage flagged) |
| 5a | In stock | Skip vendor | Continue to pricing |
| 5b | Shortage | Starts procurement | Action **request-vendors** → `VENDOR_REQUESTED` |
| 6 | Vendors / PO | WhatsApp RFQ or create PO | **Vendors** + **Purchase Orders**; rates come back |
| 7 | Pricing | Final rates / margins (acts as quote lock) | **start-pricing** → **complete-pricing** → `PRICING_COMPLETED` |
| 8 | Ready for dispatch | Confirms pick list | → `READY_FOR_DISPATCH` |
| 9 | Dispatch | Assigns vehicle / challan | → `DISPATCHED` |
| 10 | Deliver | Marks delivered | → `DELIVERED` → close |

Invoice: created on ship/dispatch (existing sales → accounting hook).

---

## C. Supporting admin screens

| Screen | When |
|--------|------|
| **Products** | Catalog, categories, brands, **Edit lists** for size per category |
| **Customers** | Master data for mobile buyers |
| **Vendors** | Supplier contacts for RFQ / WhatsApp |
| **Purchase Orders** | Formal buy when stock must be procured |
| **Invoices** | AR after dispatch |

Hidden by default: Leads, Deals, Quotes, Employees, Payroll (CRM / HR).

---

## D. Re-enable CRM later

In `apps/gateway/src/lib/nav-access.ts`:

- Set role to `"*"` (full), **or**
- Add `sales_flow` / `leads` / `opportunities` / `quotes` to that role’s list, **or**
- Per-user `navModules` override at login.

---

## E. Happy-path checklist

1. Apply **Plywood / Timber** template; set size lists per category.  
2. Customer places mobile order.  
3. SE sees it on **OMS** → edits on call → **Review**.  
4. **Verify stock** → if short, **Request vendors** + PO / WhatsApp.  
5. **Pricing** → **Dispatch** → **Deliver**.  
6. Customer sees status on **My orders**.
