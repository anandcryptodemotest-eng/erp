# Simhapuri Fresh — Complete BE + FE Design Document
# User Journeys · State Machines · API Reference · Use Case Coverage

> **Version:** 1.0 — May 2026
> **Scope:** Full end-to-end design for Grocery SaaS platform built on ERP monorepo
> **Audience:** Engineering team — covers every screen, API, state, and user journey

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [All User Roles & Actors](#2-all-user-roles--actors)
3. [Backend Design — Service by Service](#3-backend-design)
4. [State Machines](#4-state-machines)
5. [Frontend Design — App by App](#5-frontend-design)
6. [Complete User E2E Journeys](#6-complete-user-e2e-journeys)
7. [Use Case Coverage Matrix](#7-use-case-coverage-matrix)
8. [Full API Reference](#8-full-api-reference)
9. [Component Architecture](#9-component-architecture)
10. [Development Readiness Checklist](#10-development-readiness-checklist)

---

## 1. Platform Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SIMHAPURI FRESH PLATFORM                                │
│                    Built on Generic SaaS ERP Monorepo                           │
├─────────────────┬──────────────────┬───────────────────┬────────────────────────┤
│  CUSTOMER APP   │   ADMIN PANEL    │    POS TERMINAL   │   DELIVERY EXEC APP    │
│  apps/customer  │   apps/admin     │    apps/pos       │   apps/delivery-app    │
│     :3008       │     :3007        │      :3010        │       :3009            │
│                 │                  │                   │                        │
│  Browse & Shop  │ Manage all ops   │ Walk-in billing   │ View & fulfill orders  │
│  Track orders   │ Analytics        │ Barcode scan      │ Track deliveries       │
│  Return items   │ Staff mgmt       │ POS billing       │ Report earnings        │
│  PWA (mobile)   │ Desktop-first    │ Tablet-optimized  │ Mobile-first PWA       │
└─────────────────┴──────────────────┴───────────────────┴────────────────────────┘
                              │ All via Bearer JWT
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    GATEWAY  :3000   (Single Entry Point)                        │
│   Auth · Tenants · Licenses · Notifications · Banners · Coupons · FCM Push     │
└─────┬──────────┬──────────┬──────────┬────────────┬────────────┬───────────────┘
      │          │          │          │            │            │
      ▼          ▼          ▼          ▼            ▼            ▼
  sales      inventory  accounting    hr        procure      delivery
  :3001        :3002      :3003      :3004       :3005        :3006
  Orders       Products   POS Bills  Delivery   Vendors      Zones
  Customers    Stock      Invoices   Executives  POs         Assignment
  Returns      Variants   GST        Earnings   Receiving    Tracking
  CRM          Brands     Shifts     Payroll
```

---

## 2. All User Roles & Actors

| Actor | App Used | Role in System | Key Actions |
|---|---|---|---|
| **Customer** | Customer App (mobile/web) | End consumer | Browse, order, pay, track, return |
| **Admin** | Admin Panel (desktop) | Business owner / ADMIN role | Full access — all modules |
| **Store Manager** | Admin Panel | MANAGER role | Orders, stock, staff, reports |
| **Cashier** | POS Terminal (tablet) | USER role | Billing, cash shift, returns |
| **Delivery Executive** | Delivery App (mobile) | USER + `isDeliveryExecutive` | Accept, pickup, deliver orders |
| **Inventory Manager** | Admin Panel | MANAGER role | Products, stock, procurement |
| **Accountant** | Admin Panel | ACCOUNTANT role | Invoices, bills, GST, reports |
| **Service (internal)** | N/A | Service-to-service | Stock reserve/deduct, invoicing |

---

## 3. Backend Design

### 3.1 Gateway Service (:3000)

**Owns:** Auth, Tenants, Licensing, Notifications, Banners, Coupons, FCM

#### Models Summary

```
User            — email, password(bcrypt), name, isActive
Tenant          — name, slug, profile("grocery"), currency, timezone
TenantUser      — userId + tenantId + role (ADMIN|MANAGER|USER|ACCOUNTANT...)
ModuleLicense   — tenantId + moduleId + plan + expiresAt
TenantSetting   — key/value store per tenant (gstNumber, storeName, etc.)
Invitation      — invite by email with expiring token
RefreshToken    — hashed, 7-day rotation
PasswordReset   — hashed token, 1-hour expiry
Notification    — in-app notifications (per user)
AuditLog        — action log (all services replicate this pattern)
Banner          — HOME|PROMOTIONAL|CATEGORY banners          [NEW]
Coupon          — promo codes, % or flat discount             [NEW]
CouponUsage     — per-user usage tracking                     [NEW]
FCMToken        — device push tokens (Android/iOS/Web)        [NEW]
```

#### Key API Routes

```
POST   /api/auth                    → login, refresh, logout, forgot-password, reset-password, switch-tenant
GET    /api/tenants/me              → my tenants list
POST   /api/tenants                 → create tenant (onboarding)
GET    /api/modules                 → list licensed modules for tenant
GET    /api/users                   → list users (admin)
POST   /api/invitations             → invite user by email
PATCH  /api/users/:id/role          → change user role

GET    /api/banners                 → list active banners (public)
POST   /api/banners                 → create banner (admin)
PATCH  /api/banners/:id             → update banner
DELETE /api/banners/:id             → deactivate

POST   /api/coupons                 → create coupon
GET    /api/coupons                 → list coupons (admin)
POST   /api/coupons/validate        → validate { code, orderTotal } → { discount, couponId }

POST   /api/fcm-tokens              → register device token
POST   /api/notifications/push      → send FCM push notification
GET    /api/notifications           → my notifications (paginated)
PATCH  /api/notifications/:id/read  → mark as read
```

---

### 3.2 Inventory Service (:3002)

**Owns:** Categories, Products, Variants, Brands, Warehouses, Stock, BOM

#### Models Summary

```
ProductCategory  — name, parentId(sub-cat), sortOrder, isFeatured, bannerImageUrl  [EXTENDED]
Brand            — name, logoUrl                                                    [NEW]
Product          — sku, name, categoryId, brandId, barcode, imageUrls,
                   weight, weightUnit, isFeatured, sortOrder, reorderLevel         [EXTENDED]
ProductVariant   — sku, attributes(JSON), costPrice, sellPrice, expiryDate
PriceList        — name, currency, validFrom/To
PriceListItem    — productId/variantId, minQty, price
Warehouse        — name, location
WarehouseStock   — productId + warehouseId + quantity + reservedQty
VariantStock     — variantId + warehouseId + qty + reservedQty + batchNumber + expiryDate
StockMovement    — type(IN|OUT|ADJUSTMENT|RESERVE|RELEASE|RETURN_IN|RETURN_OUT), qty, reference
StockReservation — orderId, productId, quantity, status(RESERVED|RELEASED|FULFILLED)
BOM / BOMLine    — product → component relationships
```

#### Key API Routes

```
── Categories ──────────────────────────────────────────────────────────────
GET    /api/categories              → tree list (nested, with sortOrder)
POST   /api/categories              → create (admin)
PATCH  /api/categories/:id          → update (sort, featured, banner)
DELETE /api/categories/:id          → soft delete

── Brands ──────────────────────────────────────────────────────────────────
GET    /api/brands                  → list brands
POST   /api/brands                  → create brand
PATCH  /api/brands/:id              → update

── Products ────────────────────────────────────────────────────────────────
GET    /api/products                → list (filter: categoryId, brandId, barcode, search, isFeatured)
POST   /api/products                → create product
GET    /api/products/:id            → product detail + variants + stock
PATCH  /api/products/:id            → update
DELETE /api/products/:id            → soft delete (isActive = false)

── Variants ────────────────────────────────────────────────────────────────
GET    /api/products/:id/variants   → list variants
POST   /api/products/:id/variants   → create variant
PATCH  /api/variants/:id            → update variant

── Stock ───────────────────────────────────────────────────────────────────
GET    /api/stock                   → all stock levels (filter: warehouseId, low-stock)
POST   /api/stock/reserve           → reserve stock for order (service call)
POST   /api/stock/release           → release reservation (service call)
POST   /api/stock/deduct            → deduct on shipment/billing (service call)
POST   /api/stock/receive           → receive stock from PO (service call)
POST   /api/stock/receive-return    → restore stock from return (service call)
POST   /api/stock/adjustment        → manual adjustment (admin)
GET    /api/stock/alerts            → products below reorderLevel
GET    /api/stock/valuation         → SUM(qty × costPrice) per warehouse
GET    /api/stock/movements         → movement history (paginated)

── Warehouses ──────────────────────────────────────────────────────────────
GET    /api/warehouses              → list
POST   /api/warehouses              → create
PATCH  /api/warehouses/:id          → update
```

---

### 3.3 Sales Service (:3001)

**Owns:** Customers, CustomerAddresses, Orders, OrderItems, Returns, CreditNotes (ref), Discounts

#### Models Summary

```
Customer         — name, email, phone, creditLimit, isBlocked, blockedReason,
                   wallet, paymentTerms, priceListId                            [EXTENDED]
CustomerAddress  — label, line1, line2, city, state, pincode, isDefault        [NEW]
DiscountRule     — promoCode, percentage/flat, minOrder, validFrom/To
SalesOrder       — orderNumber, customerId, status, isOnlineOrder, deliveryFee,
                   paymentMethod, paymentStatus, couponId, couponDiscount       [EXTENDED]
SalesOrderItem   — productId, variantId, qty, shippedQty, unitPrice, total
SalesReturn      — returnNumber, orderId, status, creditNoteId (ref)
SalesReturnItem  — productId, qty, reason
Quote / QuoteItem — (B2B, existing)
Lead/Opportunity/Activity — (CRM, existing)
```

#### Key API Routes

```
── Customers ───────────────────────────────────────────────────────────────
GET    /api/customers               → list (filter: search, isBlocked, isActive)
POST   /api/customers               → create
GET    /api/customers/:id           → profile + stats (LTV, order frequency)
PATCH  /api/customers/:id           → update profile
PATCH  /api/customers/:id/block     → { reason } → isBlocked=true
PATCH  /api/customers/:id/unblock   → isBlocked=false
GET    /api/customers/:id/orders    → order history
GET    /api/customers/:id/addresses → address list
POST   /api/customers/:id/addresses → add address
PATCH  /api/customers/:id/addresses/:addrId → update address
DELETE /api/customers/:id/addresses/:addrId → remove address

── Orders ──────────────────────────────────────────────────────────────────
GET    /api/orders                  → list (filter: status, paymentMethod, customerId, dateRange, search)
POST   /api/orders                  → create order (reserves stock → confirms)
GET    /api/orders/:id              → full detail with items + timeline
PATCH  /api/orders/:id/confirm      → DRAFT → CONFIRMED (stock reserved)
PATCH  /api/orders/:id/ship         → CONFIRMED → SHIPPED (deduct stock, create invoice)
PATCH  /api/orders/:id/cancel       → any → CANCELLED (release reservation)
PATCH  /api/orders/:id/pay          → update paymentStatus (webhook from payment gateway)
POST   /api/orders/bulk-status      → bulk update { ids[], status }
GET    /api/orders/stats            → { total, byStatus{}, byPayment{}, today, thisWeek }

── Returns ─────────────────────────────────────────────────────────────────
GET    /api/orders/:id/returns      → returns for order
POST   /api/orders/:id/returns      → initiate return { items[] }
GET    /api/returns                 → all returns (admin)
PATCH  /api/returns/:id/approve     → PENDING → APPROVED
PATCH  /api/returns/:id/reject      → PENDING → REJECTED { reason }
PATCH  /api/returns/:id/receive     → APPROVED → COMPLETED (restore stock, issue credit note)

── Reports ─────────────────────────────────────────────────────────────────
GET    /api/reports/sales           → ?range=daily|weekly|monthly|yearly|custom&from=&to=&format=json|xlsx
GET    /api/reports/orders          → order summary, payment breakdown, cancellations
GET    /api/reports/customers       → customer stats, LTV, frequency
```

---

### 3.4 Accounting Service (:3003)

**Owns:** CoA, Journals, Invoices, CreditNotes, DebitNotes, Payments, TaxRates, Bills, CashShifts

#### Models Summary

```
ChartOfAccount   — ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
JournalEntry     — debit/credit lines (double-entry)
Invoice          — AR invoices (online orders)                   [EXISTING]
CreditNote       — issued on return approval                     [EXISTING]
DebitNote        — issued on purchase return                     [EXISTING]
TaxRate          — GST rate codes                                [EXISTING]
Payment          — payments against invoices                     [EXISTING]
CashShift        — openingBalance, closingBalance, cashierId     [NEW]
CashShiftEntry   — CASH_IN|CASH_OUT|BILL_PAYMENT|REFUND         [NEW]
Bill             — POS walk-in bill                              [NEW]
BillItem         — line items on bill                            [NEW]
BillReturn       — POS return/refund                             [NEW]
BillReturnItem   — per-item return                               [NEW]
```

#### Key API Routes

```
── POS Cash Shifts ─────────────────────────────────────────────────────────
GET    /api/cash-shifts             → list shifts (filter: cashierId, status, date)
POST   /api/cash-shifts             → open shift { openingBalance }
GET    /api/cash-shifts/:id         → shift detail + summary
PATCH  /api/cash-shifts/:id/close   → close shift { closingBalance }
GET    /api/cash-shifts/:id/report  → shift sales summary

── POS Bills ───────────────────────────────────────────────────────────────
GET    /api/bills                   → list bills (filter: shiftId, date, customerId)
POST   /api/bills                   → create bill (triggers stock deduction)
GET    /api/bills/:id               → bill detail for reprint
PATCH  /api/bills/:id/cancel        → cancel bill (restore stock)
POST   /api/bills/:id/returns       → create bill return { items[], refundMethod }

── AR Invoices ─────────────────────────────────────────────────────────────
GET    /api/invoices                → list
POST   /api/invoices                → create AR invoice (from sales service)
GET    /api/invoices/:id            → invoice detail
PATCH  /api/invoices/:id/finalize   → mark SENT/PAID
POST   /api/invoices/:id/payments   → record payment

── Reports ─────────────────────────────────────────────────────────────────
GET    /api/reports/sales           → daily/weekly/monthly revenue
GET    /api/reports/gst             → GST input/output report ?period=
GET    /api/reports/cash-collection → shift-wise cash report
GET    /api/reports/profit-margin   → revenue vs cost breakdown
```

---

### 3.5 HR Service (:3004)

**Owns:** Employees, PayGrades, Payroll, Payslips, Leave, TaxSlabs

#### Extensions for Grocery

```
Employee model extensions:
  isDeliveryExecutive  Boolean  @default(false)     [NEW]
  availabilityStatus   String   @default("AVAILABLE") // AVAILABLE|BUSY|OFF_DUTY  [NEW]
  vehicleType          String?  // BIKE|SCOOTER|VAN  [NEW]
  vehicleNumber        String?                       [NEW]
  currentOrderId       String?                       [NEW]
```

#### Key API Routes (Delivery-specific)

```
GET    /api/employees               → list (filter: isDeliveryExecutive, availabilityStatus)
PATCH  /api/employees/:id/availability  → { status: AVAILABLE|BUSY|OFF_DUTY }
GET    /api/employees/:id/earnings  → delivery earnings summary ?period=2026-05
GET    /api/reports/delivery-staff  → all executive performance summary
```

---

### 3.6 Delivery Service (:3006) — NEW

**Owns:** Zones, Assignments, Tracking, EarningLogs, CompensationConfig

#### Models Summary

```
DeliveryZone          — name, pincodes[], baseFee, perKmFee, freeAbove, estimatedMin/Max
DeliveryCompensation  — fixedSalary, perOrderBonus, bonusThreshold, incentiveRules
DeliveryAssignment    — orderId, executiveId, zoneId, status, timestamps, proofImageUrl
DeliveryTracking      — assignmentId, status, lat/lng, notes, recordedAt
DeliveryEarningLog    — executiveId, assignmentId, orderId, baseEarning, bonus, period
```

#### Key API Routes

```
── Zones ───────────────────────────────────────────────────────────────────
GET    /api/zones                   → list zones
POST   /api/zones                   → create zone { name, pincodes[], baseFee, freeAbove }
PATCH  /api/zones/:id               → update
DELETE /api/zones/:id               → deactivate
POST   /api/zones/calculate-fee     → { pincode, orderTotal } → { fee, zone }

── Assignments ─────────────────────────────────────────────────────────────
GET    /api/assignments             → list (filter: executiveId, status, date)
POST   /api/assignments             → create { orderId, executiveId?, zoneId }
GET    /api/assignments/:id         → detail
PATCH  /api/assignments/:id/status  → { status: PICKED_UP|OUT_FOR_DELIVERY|DELIVERED|FAILED }
POST   /api/assignments/:id/proof   → upload delivery proof image
GET    /api/assignments/:id/tracking → tracking history

── Executive View ──────────────────────────────────────────────────────────
GET    /api/executive/assignments   → my current assignments (for delivery app)
GET    /api/executive/history       → my completed deliveries
GET    /api/executive/earnings      → my earnings ?period=2026-05

── Reports ─────────────────────────────────────────────────────────────────
GET    /api/reports/performance     → avg delivery time, on-time %, by executive
GET    /api/reports/earnings        → earnings summary by executive by period

── Compensation ────────────────────────────────────────────────────────────
GET    /api/config/compensation     → current config
PUT    /api/config/compensation     → update config
```

---

## 4. State Machines

### 4.1 Online Order State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                  ONLINE ORDER                │
                    └──────────────────────────────────────────────┘

    Customer places order
         │
         ▼
    ┌─────────┐   stock reserve fails   ┌──────────────────┐
    │  DRAFT  │ ──────────────────────▶ │ STOCK_UNAVAILABLE│ (return 409)
    └────┬────┘                         └──────────────────┘
         │ stock reserved + coupon validated
         ▼
    ┌───────────┐                        ┌──────────────┐
    │ CONFIRMED │ ─── payment failed ──▶ │ PAYMENT_FAIL │ → release reservation
    └─────┬─────┘                        └──────────────┘
          │ payment success → invoice created → delivery assigned
          ▼
    ┌─────────────────┐
    │ AWAITING_PICKUP │ (delivery executive assigned)
    └────────┬────────┘
             │ executive picks up
             ▼
    ┌──────────────────────┐
    │  OUT_FOR_DELIVERY    │
    └──────────┬───────────┘
               │ delivered
               ▼                         ┌──────────────┐
    ┌───────────────┐                    │   RETURNED   │◀── customer initiates
    │   DELIVERED   │──────────────────▶ │   (partial)  │    within return window
    └───────────────┘                    └──────────────┘
               │
               ▼
    ┌───────────────┐
    │   INVOICED    │ (invoice finalized, payment settled)
    └───────────────┘

    CANCELLED  ← from DRAFT, CONFIRMED, AWAITING_PICKUP (releases stock reservation)
```

### 4.2 POS Bill State Machine

```
    Cashier opens shift
         │
         ▼
    ┌──────────────┐
    │  SHIFT OPEN  │
    └──────┬───────┘
           │
           │ scan + add items
           ▼
    ┌─────────────┐   payment collected   ┌───────────────┐   stock deducted
    │  CART/OPEN  │ ──────────────────▶   │   COMPLETED   │ ─────────────▶ inventory updated
    └─────────────┘                       └───────┬───────┘
           │                                      │
           │ hold                                 │ customer requests return
           ▼                                      ▼
    ┌──────────┐   resume                 ┌───────────────┐   items returned   ┌──────────────┐
    │   HELD   │ ──────────────────────▶  │  BILL RETURN  │ ───────────────▶   │   REFUNDED   │
    └──────────┘                          └───────────────┘                    └──────────────┘
           │
           │ cancel
           ▼
    ┌──────────────┐
    │  CANCELLED   │ (no stock impact)
    └──────────────┘
           │
           │ all bills done for day
           ▼
    ┌───────────────┐
    │  SHIFT CLOSE  │ → cash difference report generated
    └───────────────┘
```

### 4.3 Delivery Assignment State Machine

```
    Order confirmed + payment received
              │
              ▼
    ┌──────────────────┐
    │    ASSIGNED      │ ← POST /api/assignments (auto or manual)
    └────────┬─────────┘   FCM push to executive
             │ executive accepts / picks up from store
             ▼
    ┌──────────────────┐
    │    PICKED_UP     │ ← PATCH status (executive app)
    └────────┬─────────┘   FCM push to customer "on the way"
             │
             ▼
    ┌──────────────────────┐
    │  OUT_FOR_DELIVERY    │ ← optional intermediate status
    └────────┬─────────────┘
             │ delivered + proof photo
             ▼                          ┌─────────────────────────────┐
    ┌──────────────────┐                │         FAILED              │
    │    DELIVERED     │                │  (customer not home, etc.)  │
    └──────────────────┘                └─────────────────────────────┘
             │
             ▼
    → trigger: SalesOrder → DELIVERED
    → trigger: DeliveryEarningLog created
    → trigger: Executive availabilityStatus → AVAILABLE
    → trigger: FCM push to customer "delivered"
```

### 4.4 Sales Return State Machine

```
    Customer initiates return (within return window)
              │
              ▼
    ┌──────────────┐
    │   PENDING    │ ← POST /api/orders/:id/returns
    └──────┬───────┘
           │ admin reviews
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐  ┌──────────┐
│ APPROVED │  │ REJECTED │ ← reason provided to customer
└────┬─────┘  └──────────┘
     │ stock physically received back
     ▼
┌──────────────┐
│  COMPLETED   │
└──────────────┘
     │
     ├─▶ inventory /api/stock/receive-return  (stock restored)
     ├─▶ accounting /api/credit-notes         (credit note issued)
     └─▶ gateway /api/notifications/push      (customer notified of refund)
```

---

## 5. Frontend Design

### 5.1 Admin Panel (apps/admin :3007)

**Stack:** Next.js 15 + Tailwind CSS + shadcn/ui + Recharts (analytics)
**Auth:** JWT stored in httpOnly cookie via gateway proxy
**Pattern:** Each page = server component fetching data, client components for interactivity

#### Page Structure

```
/                          → redirect to /dashboard
/login                     → login form

/dashboard                 → KPI cards + charts + live order feed + low stock alerts
  Components:
  ├── KpiCard              (Total Orders, Revenue, Active Customers, Low Stock count)
  ├── SalesChart           (bar chart — daily/weekly/monthly toggle)
  ├── OrderStatusDonut     (pending/confirmed/delivered/cancelled breakdown)
  ├── TopProductsTable     (top 10 by revenue)
  ├── LiveOrderFeed        (latest 10 orders, auto-refreshes every 30s)
  ├── LowStockAlert        (products below reorder level)
  └── DeliveryStatusBoard  (assignments by status)

/orders                    → order list with filters + bulk actions
  /orders/[id]             → order detail: items, timeline, status, assign delivery button

/products                  → product grid with search/filter
  /products/new            → create product form (name, sku, category, brand, barcode, images, variants)
  /products/[id]           → edit product + variant management + stock view

/categories                → category tree view with drag-drop sort
  /categories/[id]         → edit category (name, banner image, featured toggle)

/inventory                 → stock levels table per warehouse + filter by low-stock
  /inventory/adjustments   → manual stock adjustment form + adjustment history
  /inventory/movements     → stock movement log (all IN/OUT/ADJUST)

/brands                    → brand list + CRUD

/billing
  /billing/shifts          → cash shift list + open shift button
  /billing/shifts/[id]     → shift detail: bills list, cash summary, close shift
  /billing/bills           → all POS bills with filters + reprint
  /billing/reports         → daily billing report, GST report, profit/margin

/delivery
  /delivery/zones          → zone list + create/edit (map view + pincode input)
  /delivery/assignments    → live assignment board (Kanban: assigned → picked → out → delivered)
  /delivery/executives     → executive list + availability status + today's stats
  /delivery/executives/[id] → executive profile + earnings + performance history
  /delivery/compensation   → compensation config (salary, per-order, bonus rules)

/customers                 → customer list with search, filter blocked
  /customers/[id]          → profile + address list + order history + LTV stats + block/unblock

/promotions
  /promotions/banners       → banner list + create (image upload, schedule, type)
  /promotions/coupons       → coupon list + create (code, type, value, usage limits)

/procurement
  /procurement/vendors      → vendor list
  /procurement/orders       → PO list + create
  /procurement/orders/[id]  → PO detail + receive goods

/reports
  /reports/sales            → sales by date range, payment method, category, product
  /reports/orders           → order summary, payment, cancellation, return reports
  /reports/inventory        → stock report, low-stock, valuation, expiry alerts
  /reports/delivery         → executive performance, earnings, zone-wise delivery stats
  /reports/gst              → GST input/output, period selector
  [Export to Excel button on all report pages]

/notifications              → send push notification to all/selected customers
  /notifications/logs       → notification delivery log

/settings
  /settings/store           → store name, GST number, address, logo
  /settings/users           → user list + invite + role management
  /settings/modules         → licensed module management
  /settings/delivery        → delivery zone config shortcuts
```

---

### 5.2 Customer App (apps/customer :3008)

**Stack:** Next.js 15 PWA + Tailwind + Mobile-first responsive
**Auth:** JWT in localStorage + refresh token in httpOnly cookie
**Pattern:** App Router, ISR for product pages, client components for cart/checkout

#### Page Structure

```
/                          → homepage
  Components:
  ├── BannerCarousel       (fetches gateway /api/banners?type=HOME)
  ├── CategoryGrid         (top-level categories with icons)
  ├── FeaturedProducts     (isFeatured=true products)
  ├── OffersStrip          (active promotions)
  └── SearchBar            → /search

/search                    → real-time product search with filters (category, brand, price range)

/categories/[id]           → product grid for category
  Components:
  ├── SubCategoryTabs      (child categories as filter tabs)
  ├── ProductCard          (image, name, price, weight, add-to-cart button)
  ├── SortBar              (price asc/desc, newest, popular)
  └── FilterSidebar        (brand, price range, in-stock only)

/products/[id]             → product detail
  Components:
  ├── ImageGallery         (product images)
  ├── VariantSelector      (size/weight options)
  ├── StockBadge           (In Stock / Out of Stock / Low Stock)
  ├── QuantitySelector
  ├── AddToCartButton
  └── SimilarProducts

/cart                      → cart page
  Components:
  ├── CartItemList         (items, qty change, remove)
  ├── CouponInput          → validates via gateway /api/coupons/validate
  ├── DeliveryFeeEstimate  → fetches /api/zones/calculate-fee by pincode
  ├── OrderSummary         (subtotal, discount, delivery, GST, total)
  └── CheckoutButton

/checkout                  → checkout flow (multi-step)
  Step 1: Address
  ├── AddressList          (saved addresses)
  └── AddAddressForm       (new address with pincode)

  Step 2: Delivery Slot (if enabled)
  └── SlotPicker

  Step 3: Payment
  ├── PaymentMethodSelect  (COD / UPI / Card)
  ├── WalletBalance        (apply wallet)
  └── PlaceOrderButton     → POST /api/orders

  Step 4: Confirmation
  └── OrderConfirmation    (order number, estimated delivery time)

/orders                    → order history list
  /orders/[id]             → order detail + live tracking
  Components:
  ├── OrderTimeline        (placed→confirmed→picked up→out for delivery→delivered)
  ├── TrackingMap          (latitude/longitude from DeliveryTracking — optional)
  ├── OrderItems
  ├── PaymentSummary
  └── ReturnButton         (within return window, only for DELIVERED orders)

/orders/[id]/return        → return initiation
  Components:
  ├── ReturnableItemList   (select items + qty + reason)
  └── SubmitReturnButton

/profile                   → customer profile
  /profile/addresses       → address management
  /profile/notifications   → notification preferences

/auth/login                → login / register
/auth/register             → registration form
```

---

### 5.3 POS Terminal (apps/pos :3010)

**Stack:** Next.js 15 + Tailwind — Optimized for 10" tablet landscape
**Auth:** Cashier JWT, role must include POS access
**Pattern:** Single-page app feel — no page reloads during billing

#### Page Structure

```
/                          → redirect to /shift or /billing depending on active shift

/shift                     → cash shift management
  Components:
  ├── OpenShiftForm        (opening cash balance input)
  ├── ActiveShiftInfo      (start time, bills count, cash total so far)
  └── CloseShiftForm       (closing balance input → shows expected vs actual difference)

/billing                   → main POS screen
  Layout: 2-column (left = product search, right = cart/bill)

  Left Panel:
  ├── BarcodeInput         (auto-focus, scan triggers product lookup)
  ├── ProductSearch        (search by name/SKU, debounced)
  ├── ProductGrid          (quick-access tiles for popular items)
  └── CategoryFilter       (filter product grid by category)

  Right Panel (Cart):
  ├── CartItemList         (product, qty +/-, price, line total)
  ├── CustomerSelect       (search existing customer or guest)
  ├── BillSummary          (subtotal, GST, discount, total)
  ├── PaymentSection       (CASH/UPI/CARD/WALLET/SPLIT buttons)
  ├── HoldBillButton       → saves bill as HELD
  ├── CancelBillButton     → confirms and discards
  └── CompleteSaleButton   → POST /api/bills

/billing/held              → list of HELD bills → resume
/billing/bills             → today's bills list + reprint
/billing/returns           → initiate return from previous bill

/reports                   → POS reports (shift summary, daily, GST, product-wise)
```

---

### 5.4 Delivery Executive App (apps/delivery-app :3009)

**Stack:** Next.js 15 PWA — Mobile-first, offline-ready (service worker for maps)
**Auth:** Executive JWT (`isDeliveryExecutive = true`)
**Key feature:** Status updates work even with poor connectivity (optimistic UI + retry)

#### Page Structure

```
/                          → active assignments dashboard
  Components:
  ├── AvailabilityToggle   → PATCH /api/executive/availability
  ├── AssignmentCard       (order ID, customer name, address, distance, items count)
  ├── AcceptButton         → triggers PICKED_UP status
  └── EmptyState           (no assignments — you're all caught up!)

/assignments/[id]          → assignment detail
  Components:
  ├── CustomerInfo         (name, phone — click to call)
  ├── DeliveryAddress      → opens Google Maps
  ├── OrderItemList        (what's in the delivery)
  ├── StatusTimeline       (ASSIGNED → PICKED UP → OUT → DELIVERED)
  ├── StatusUpdateButtons  (context-aware: "Mark Picked Up" / "Mark Delivered")
  ├── ProofUpload          (camera capture for delivery confirmation)
  └── FailedDeliveryButton → { reason } → FAILED status

/history                   → completed deliveries
  Components:
  ├── DeliveryList         (date, order, customer, time taken)
  └── MonthSelector        (filter by month)

/earnings                  → earnings dashboard
  Components:
  ├── EarningsSummary      (today, this week, this month)
  ├── EarningsBreakdown    (base per order, bonuses)
  └── EarningsHistory      (month-by-month)

/profile                   → name, vehicle, availability, contact
/auth/login                → executive login
```

---

## 6. Complete User E2E Journeys

### Journey 1 — New Customer First Order (Online)

```
ACTOR: Customer (Ravi, new user, mobile browser)

Step 1: Discovery & Registration
  → Opens simhapurifresh.com on phone
  → Sees homepage banner carousel (fetched from gateway /api/banners)
  → Clicks "Sign Up" → enters name, phone, email, password
  → POST gateway /api/auth (register) → receives JWT + refreshToken
  → Redirected to homepage — now logged in

Step 2: Browse Products
  → Taps "Vegetables" category tile
  → GET inventory /api/products?categoryId=xxx&page=1&limit=20
  → Sees product grid: Tomato, Potato, Onion with prices and stock badges
  → Taps "Tomato 1kg" → product detail page
  → Sees images, price ₹45, stock: In Stock, variant: 500g / 1kg
  → Selects 1kg variant → taps "Add to Cart"

Step 3: Build Cart
  → Continues browsing, adds: Tomato 1kg, Onion 2kg, Milk 1L, Bread
  → Taps Cart icon → /cart page
  → Enters coupon code "FRESH10" → POST gateway /api/coupons/validate
  → Coupon valid: 10% off → ₹38 discount shown
  → Address section: no addresses saved → taps "Add Address"
  → Enters: Home, Street 12, Hyderabad, 500032
  → POST sales /api/customers/:id/addresses

Step 4: Checkout
  → /checkout → address pre-selected
  → Delivery fee ₹30 (zone calculation for pincode 500032)
  → Payment method: COD → taps "Place Order"
  → POST sales /api/orders:
      {
        items: [...],
        addressId: "addr_xxx",
        paymentMethod: "COD",
        couponId: "coupon_xxx",
        deliveryFee: 30
      }
  → sales service:
      a. Validates coupon (ServiceClient → gateway)
      b. Creates SalesOrder (DRAFT)
      c. Reserves stock (ServiceClient → inventory)
      d. Confirms order (CONFIRMED)
      e. Records CouponUsage
  → Response: { orderId, orderNumber: "ORD-2026-001", total: ₹342 }
  → Customer sees: "Order Confirmed! Expected delivery: Today by 6 PM"
  → FCM push: "Your order ORD-2026-001 is confirmed!"

Step 5: Order Tracking
  → Customer opens /orders/[id]
  → Sees timeline: ✅ Placed → ✅ Confirmed → 🔄 Out for Delivery → ⬜ Delivered
  → Delivery executive name and phone visible

Step 6: Delivery
  → Executive marks DELIVERED + uploads photo
  → Order status → DELIVERED
  → Customer gets FCM push: "Order delivered! How was your experience?"
  → Stock deducted in inventory
  → Invoice finalized in accounting

OUTCOME: Order placed, delivered, invoiced. Customer receives ₹38 discount via coupon.
SERVICES TOUCHED: gateway, sales, inventory, accounting, delivery, hr
```

---

### Journey 2 — Customer Returns an Item

```
ACTOR: Customer (Ravi, returning a damaged item)

Step 1: Initiate Return
  → Opens /orders/ORD-2026-001 → order is DELIVERED (3 days ago)
  → "Return Items" button visible (within 7-day window)
  → Taps "Return Items" → /orders/[id]/return
  → Selects: Bread 1 unit → Reason: "Mouldy / Damaged"
  → POST sales /api/orders/:id/returns
  → Return created: RTN-2026-001, status: PENDING

Step 2: Admin Reviews
  → Admin sees return in admin panel /orders → Returns tab
  → Views: customer photo of damaged bread, reason
  → Clicks "Approve Return"
  → PATCH sales /api/returns/:id/approve

Step 3: Stock Restored & Refund
  → Admin marks return received
  → PATCH sales /api/returns/:id/receive
  → sales service:
      a. SalesReturn → COMPLETED
      b. ServiceClient → inventory /api/stock/receive-return (stock +1 bread)
      c. ServiceClient → accounting /api/credit-notes (₹35 credit note)
      d. Credit added to customer wallet
  → Customer gets FCM push: "₹35 refunded to your wallet"

OUTCOME: Damaged item returned, stock restored, customer wallet credited.
SERVICES TOUCHED: sales, inventory, accounting, gateway
```

---

### Journey 3 — Walk-in POS Billing (Cashier)

```
ACTOR: Cashier (Priya, morning shift)

Step 1: Open Cash Shift
  → Opens POS terminal on tablet → /shift
  → Counts morning cash: ₹500 → enters opening balance
  → POST accounting /api/cash-shifts { openingBalance: 500 }
  → Shift opened: SHIFT-2026-05-29-001

Step 2: Walk-in Customer
  → Customer walks in, wants Milk, Eggs, Rice
  → Priya scans barcode on Milk packet: 8901030890230
  → GET inventory /api/products?barcode=8901030890230
  → Product appears in cart: Milk 1L ₹58
  → Scans Eggs (dozen): auto-added ₹85
  → Searches "Basmati Rice" → types in search box → selects 5kg ₹285
  → Cart total: ₹428

Step 3: Apply Discount
  → Customer shows loyalty card → Priya enters coupon code "MEMBER5"
  → Discount applied: ₹21.40 → Total: ₹406.60

Step 4: Payment
  → Customer pays by UPI → Priya selects UPI payment method
  → POST accounting /api/bills {
        shiftId, customerId, items, paymentMethod: "UPI", total: 406.60
      }
  → accounting service:
      a. Creates Bill + BillItems
      b. Calculates GST (18% on applicable items)
      c. Creates CashShiftEntry
      d. ServiceClient → inventory /api/stock/deduct (stock deducted)
  → Bill created: BILL-2026-001

Step 5: Print Receipt
  → POS renders receipt → browser print dialog → thermal printer
  → Customer leaves with receipt

Step 6: Close Shift (End of Day)
  → Priya counts cash drawer: ₹3,240
  → PATCH accounting /api/cash-shifts/:id/close { closingBalance: 3240 }
  → System calculates expected: ₹3,180 (opening ₹500 + cash sales ₹2,680)
  → Difference: ₹60 (over — flagged for review)
  → Shift report generated

OUTCOME: Walk-in customer billed, stock deducted, GST recorded, shift balanced.
SERVICES TOUCHED: accounting, inventory
```

---

### Journey 4 — Delivery Executive Fulfills Orders

```
ACTOR: Delivery Executive (Suresh, morning shift)

Step 1: Start Shift
  → Opens delivery app on phone → /
  → Toggles availability: AVAILABLE
  → PATCH hr /api/employees/:id/availability { status: AVAILABLE }

Step 2: Receive Assignment
  → New order confirmed in system → admin assigns to Suresh
  → FCM push notification: "New delivery: ORD-2026-047, 1.2km away"
  → App shows AssignmentCard with customer address + items list

Step 3: Pickup from Store
  → Suresh goes to store → collects items
  → Taps "Mark Picked Up" on /assignments/[id]
  → PATCH delivery /api/assignments/:id/status { status: PICKED_UP }
  → Customer FCM push: "Your order has been picked up!"

Step 4: Delivery
  → Suresh navigates to customer address (Google Maps link)
  → Customer receives order → Suresh taps "Mark as Delivered"
  → Camera opens → takes proof photo
  → POST delivery /api/assignments/:id/proof (image upload)
  → PATCH delivery /api/assignments/:id/status { status: DELIVERED }
  → delivery service:
      a. Assignment → DELIVERED
      b. ServiceClient → sales /api/orders/:id/ship
      c. Creates DeliveryEarningLog (₹25 commission)
      d. Updates executive availabilityStatus → AVAILABLE
  → Suresh available for next order

Step 5: View Earnings
  → End of day → opens /earnings
  → Today: 8 deliveries × ₹25 = ₹200 base + ₹50 bonus (>5 deliveries)
  → Monthly total visible

OUTCOME: 8 deliveries completed, earnings logged, all orders marked delivered.
SERVICES TOUCHED: hr, delivery, sales, inventory, accounting
```

---

### Journey 5 — Admin Views Daily Analytics

```
ACTOR: Admin / Store Owner (Mr. Kumar)

Step 1: Morning Dashboard Check
  → Opens admin panel on laptop → /dashboard
  → Sees KPI cards:
      Today's Revenue: ₹24,850
      Orders Today: 47 (38 delivered, 6 out for delivery, 3 pending)
      Low Stock Alerts: 4 products
      Active Delivery Executives: 5/7

Step 2: Low Stock Action
  → Clicks "Low Stock Alerts" card → /inventory with low-stock filter
  → Sees: Basmati Rice (3kg left, reorder: 50), Milk 1L (8 units, reorder: 30)
  → Clicks "Create PO" → /procurement/orders/new
  → Adds items to PO → sends to vendor

Step 3: Pending Order Review
  → Dashboard shows 3 pending orders (payment pending for 30+ mins)
  → Goes to /orders → filters: status=CONFIRMED, paymentStatus=PENDING
  → Calls customer on pending order → resolves manually

Step 4: End of Day Report
  → Goes to /reports/sales → selects "Today"
  → Sees: Revenue ₹24,850 | Orders 47 | Returns 2 | Net ₹24,130
  → Downloads Excel report → sends to accountant
  → Checks /reports/gst → GST collected today ₹2,235

OUTCOME: Daily operations reviewed, low stock actioned, reports generated.
SERVICES TOUCHED: inventory, sales, accounting, procurement
```

---

### Journey 6 — Admin Restocks via Procurement

```
ACTOR: Inventory Manager

Step 1: Create Purchase Order
  → /procurement/orders/new
  → Selects vendor: "Fresh Farms Pvt Ltd"
  → Adds items: Tomato 100kg ₹40/kg, Onion 50kg ₹35/kg
  → POST procurement /api/purchase-orders
  → PO created: PO-2026-012, status: DRAFT

Step 2: Approve & Send
  → PATCH status → SUBMITTED → vendor receives PO

Step 3: Goods Receipt
  → Vendor delivers 95kg Tomato (5kg short) + 50kg Onion
  → Manager marks partial receipt
  → PATCH procurement /api/purchase-orders/:id/receive {
        items: [
          { productId, quantity: 95 },  // partial
          { productId, quantity: 50 }   // full
        ]
      }
  → procurement service:
      a. PO → PARTIALLY_RECEIVED
      b. ServiceClient → inventory /api/stock/receive (stock +95kg, +50kg)
      c. ServiceClient → accounting /api/invoices (AP invoice for ₹5,550)
  → Stock updated, AP invoice created

OUTCOME: Inventory restocked, AP invoice for accounting, PO partially closed.
SERVICES TOUCHED: procurement, inventory, accounting
```

---

## 7. Use Case Coverage Matrix

### Summary Scorecard

```
TOTAL PROPOSAL FEATURES: 120

Category                          Count  %
─────────────────────────────────────────
✅ Already works (no code needed)    47  39%
⚠️  Needs new API endpoint           22  18%
🔧  Needs model extension            33  28%
🆕  Needs new service (delivery)     14  12%
❌  Needs 3rd party (Excel, FCM)      4   3%
─────────────────────────────────────────
Total needing new code              73  61%
Already covered                     47  39%
```

### By Proposal Module

| Module | Total Features | ✅ Done | ⚠️ API | 🔧 Model | 🆕 New | ❌ 3rd Party |
|---|---|---|---|---|---|---|
| 1. Dashboard & Analytics | 19 | 8 | 7 | 2 | 2 | 0 |
| 2. Order Management | 14 | 7 | 4 | 0 | 3 | 0 |
| 3. Category Management | 7 | 2 | 1 | 4 | 0 | 0 |
| 4. Product & Inventory | 17 | 10 | 0 | 7 | 0 | 0 |
| 5. Store Billing (POS) | 28 | 5 | 2 | 19 | 2 | 0 |
| 6. Promotions & Banners | 6 | 0 | 0 | 6 | 0 | 0 |
| 7. Delivery Management | 13 | 1 | 0 | 0 | 12 | 0 |
| 8. Delivery Executive | 9 | 0 | 1 | 0 | 8 | 0 |
| 9. Customer Management | 12 | 6 | 3 | 3 | 0 | 0 |
| 10. Reporting & Analytics | 14 | 1 | 9 | 0 | 0 | 4 |
| 11. Notifications | 6 | 3 | 0 | 3 | 0 | 0 |
| 12. Administration & Security | 9 | 8 | 0 | 0 | 0 | 1 |

---

## 8. Full API Reference

### Endpoints by Service — New/Extended Only

#### gateway (:3000) — 9 new endpoints
```
POST   /api/auth                     (extend: add switch-tenant)
GET    /api/banners                  NEW
POST   /api/banners                  NEW
PATCH  /api/banners/:id              NEW
POST   /api/coupons                  NEW
GET    /api/coupons                  NEW
POST   /api/coupons/validate         NEW
POST   /api/fcm-tokens               NEW
POST   /api/notifications/push       NEW
```

#### inventory (:3002) — 6 new endpoints
```
GET    /api/brands                   NEW
POST   /api/brands                   NEW
PATCH  /api/brands/:id               NEW
GET    /api/stock/alerts             NEW
GET    /api/stock/valuation          NEW
GET    /api/products?barcode=        EXTEND (add barcode filter)
```

#### sales (:3001) — 11 new endpoints
```
GET    /api/customers/:id/addresses  NEW
POST   /api/customers/:id/addresses  NEW
PATCH  /api/customers/:id/addresses/:addrId  NEW
PATCH  /api/customers/:id/block      NEW
PATCH  /api/customers/:id/unblock    NEW
GET    /api/customers/:id           (extend: add LTV, orderFrequency stats)
POST   /api/orders/bulk-status       NEW
GET    /api/orders/stats             NEW
GET    /api/orders                  (extend: add paymentMethod, phone filters)
GET    /api/reports/sales            NEW
GET    /api/reports/orders           NEW
```

#### accounting (:3003) — 14 new endpoints
```
GET    /api/cash-shifts              NEW
POST   /api/cash-shifts              NEW
GET    /api/cash-shifts/:id          NEW
PATCH  /api/cash-shifts/:id/close    NEW
GET    /api/cash-shifts/:id/report   NEW
GET    /api/bills                    NEW
POST   /api/bills                    NEW
GET    /api/bills/:id                NEW
PATCH  /api/bills/:id/cancel         NEW
POST   /api/bills/:id/returns        NEW
GET    /api/reports/sales            NEW
GET    /api/reports/gst              NEW
GET    /api/reports/cash-collection  NEW
GET    /api/reports/profit-margin    NEW
```

#### hr (:3004) — 3 new endpoints
```
PATCH  /api/employees/:id/availability  NEW
GET    /api/employees/:id/earnings      NEW
GET    /api/reports/delivery-staff      NEW
```

#### delivery (:3006) — 14 new endpoints (all new service)
```
GET    /api/zones                    NEW
POST   /api/zones                    NEW
PATCH  /api/zones/:id                NEW
POST   /api/zones/calculate-fee      NEW
GET    /api/assignments              NEW
POST   /api/assignments              NEW
GET    /api/assignments/:id          NEW
PATCH  /api/assignments/:id/status   NEW
POST   /api/assignments/:id/proof    NEW
GET    /api/assignments/:id/tracking NEW
GET    /api/executive/assignments    NEW
GET    /api/executive/earnings       NEW
GET    /api/reports/performance      NEW
GET/PUT /api/config/compensation     NEW
```

**Total new/extended API endpoints: 71**

---

## 9. Component Architecture

### Shared Component Library (@erp/ui — extensions needed)

```typescript
// Existing components (no changes)
Button, Card, Input, Badge, DataTable

// New components for grocery
ProductCard          — image, name, price, stock badge, add-to-cart
CartItem             — qty control, remove, line total
OrderStatusBadge     — colored badge per status
DeliveryTimeline     — step-by-step status tracker
BarcodeInput         — auto-focus input with scan handler
KpiCard              — metric card with trend indicator
SalesChart           — Recharts bar/line chart wrapper
AssignmentKanban     — drag-drop delivery board (admin)
BannerCarousel       — image slider for homepage
StockLevelBar        — visual stock remaining indicator
```

### State Management

```
Admin Panel    → React Query (TanStack) — server state, auto-refetch every 30s for dashboard
Customer App   → Zustand for cart (persisted to localStorage) + React Query for API
POS Terminal   → Zustand for cart (in-memory, no persistence) + React Query
Delivery App   → React Query with optimistic updates for status changes
```

### Authentication Flow (All Apps)

```typescript
// All apps follow the same pattern:

1. POST /api/auth → { accessToken (24h), refreshToken (7d) }
2. Store accessToken in memory (Zustand/context)
   Store refreshToken in httpOnly cookie
3. All API calls: Authorization: Bearer <accessToken>
4. On 401 → auto-refresh via POST /api/auth?action=refresh
5. On refresh fail → logout → redirect to /login

// Role guards on each app:
admin        → require role: ADMIN | MANAGER | ACCOUNTANT
pos          → require role: any (cashier)
delivery-app → require isDeliveryExecutive: true
customer     → any authenticated user OR guest (read-only)
```

---

## 10. Development Readiness Checklist

### Before Writing First Line of Code

- [x] Architecture documented (GROCERY-ARCHITECTURE.md)
- [x] Full design documented (this file)
- [x] All user journeys mapped
- [x] All state machines defined
- [x] All APIs inventoried (71 endpoints)
- [x] Model extensions identified (5 services)
- [ ] Prisma migrations written for model extensions
- [ ] delivery service scaffolded
- [ ] apps/admin, apps/customer, apps/pos, apps/delivery-app created in monorepo

### Sprint 1 Kickoff Tasks (Week 1)

1. Write and migrate Prisma schema extensions for: gateway, sales, accounting, inventory, hr
2. Scaffold `apps/delivery` service (copy gateway as template)
3. Scaffold 4 frontend apps in `apps/` directory
4. Register `delivery` in `@erp/config` services registry
5. Add grocery-specific types to `@erp/types` (OrderStatus, DeliveryStatus, BillStatus, etc.)

### Third-Party Integrations Required

| Integration | Purpose | Service | Package |
|---|---|---|---|
| Firebase Admin SDK | FCM push notifications | gateway | `firebase-admin` |
| Razorpay / Stripe | Online payment webhook | gateway | `razorpay` |
| exceljs | Excel report export | all services (report endpoints) | `exceljs` |
| ESC-POS | Thermal printer | apps/pos (browser) | `escpos-buffer` |
| Google Maps | Delivery address + navigation | apps/customer, apps/delivery-app | Google Maps JS SDK |

---

*Document Owner: Engineering Team*
*Status: Ready for Sprint 1*
*Next Review: After Sprint 2 (delivery service completion)*
