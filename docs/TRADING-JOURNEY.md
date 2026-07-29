# Trading journey — SREQ → SO (screen-by-screen)

Customer mobile **Sales Request (SREQ)** → Sales converts to **Sales Order (SO)** → parallel prep tasks → dispatch → deliver → invoice → payment → close.

Admin nav defaults to this journey (CRM hidden). Workflow template: `workflow.oms_trading` **v3**.

> **SREQ** = Sales Request. **SR** in returns UI = Sales Return (different document).

---

## A. Customer mobile (`apps/customer` · :3007)

| # | Screen | User does | System |
|---|--------|-----------|--------|
| 1 | Login / Register | Signs in or creates portal account | JWT + tenant; role `CUSTOMER`; Sales `Customer.portalUserId` |
| 2 | Product list | Browses + category + attribute filters | `attr[key]` faceted search |
| 3 | Product detail | Picks size / thickness / qty | Attribute pickers → cart |
| 4 | Cart | Reviews lines | Local cart → checkout |
| 5 | Checkout | Address, notes, payment | `POST /api/sales-requests` → **SREQ-#####** status `OPEN` |
| 6 | My requests | Tracks SREQ + linked SO status | List SREQs; after convert shows SO status |
| 7 | Request detail | Timeline, cancel (while OPEN), reorder | Cancel only `OPEN` SREQ |
| 8 | Profile | Addresses CRUD + inbox | `/customers/me` + notifications |

**Customers never create Sales Orders directly.**

---

## B. Sales desk — OMS (`/oms`)

| # | Screen | User does | Result |
|---|--------|-----------|--------|
| 1 | Open SREQs | Opens customer requests | Queue of `OPEN` SREQs |
| 2 | Convert | Confirms commercial intent | Creates **SO-#####** at `CONFIRMED`; SREQ → `CONVERTED`; SO status visible on SREQ |
| 3 | Parallel prep | Role queues work independently | Tasks: sales review, inventory, pricing, warehouse (+ procurement if shortage) |
| 4 | Prep gate | All required prep complete | SO → `READY_FOR_DISPATCH` |
| 5 | Dispatch | Assign vehicle / driver | → `DISPATCHED` |
| 6 | Deliver | Marks delivered | → `DELIVERED` |
| 7 | Invoice | Finance creates AR invoice | → `INVOICED` |
| 8 | Collect payment | Marks paid | → `PAID` |
| 9 | Close | Closes order | → `CLOSED` |

SO coarse statuses only — **no** linear mid-status ladder (`PENDING_SALES_REVIEW`, `REVIEWED`, …).

Staff-created DRAFT SO: action **activate** → `CONFIRMED` (same parallel prep).

---

## C. Happy-path checklist

1. Apply **OMS Trading** template (v3).  
2. Customer places mobile request → SREQ.  
3. SE on **OMS → Open SREQs** → **Convert to Sales Order**.  
4. Parallel: review / verify stock / pricing / warehouse ready.  
5. Dispatch → Deliver → Invoice → Pay → Close.  
6. Customer sees SO status on the SREQ detail.

---

## D. Supporting admin screens

| Screen | When |
|--------|------|
| **Products** | Catalog, categories, brands |
| **Customers** | Master data for mobile buyers |
| **Vendors** | Supplier contacts when inventory flags shortage |
| **Purchase Orders** | Formal buy when stock must be procured |
| **Invoices** | AR after deliver |

Hidden by default: Leads, Deals, Quotes, Employees, Payroll (CRM / HR).
