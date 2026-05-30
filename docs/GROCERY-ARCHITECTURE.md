# Simhapuri Fresh — Grocery Application Architecture
# Built on ERP Monorepo

> **Status:** Design Document v1.0 — May 2026
> **Based on:** Simhapuri Fresh Project Proposal (Arrow Coders / Prem Kumar)
> **Foundation:** Existing ERP Turborepo Monorepo (6 services, PostgreSQL, Next.js 15)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Decision — ERP as Foundation](#2-architecture-decision)
3. [Complete System Architecture](#3-complete-system-architecture)
4. [Service Responsibility Map](#4-service-responsibility-map)
5. [New Service — Delivery (:3006)](#5-new-service--delivery-3006)
6. [Model Extensions to Existing Services](#6-model-extensions-to-existing-services)
7. [New Frontend Applications](#7-new-frontend-applications)
8. [E2E Use Case Coverage Matrix](#8-e2e-use-case-coverage-matrix)
9. [Complete E2E Data Flows](#9-complete-e2e-data-flows)
10. [API Endpoints Required](#10-api-endpoints-required)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Phased Build Plan](#12-phased-build-plan)

---

## 1. Executive Summary

The Simhapuri Fresh grocery application is built **on top of the existing ERP monorepo** rather than as a standalone system. This decision means:

- **~70% of the backend is already built** — auth, inventory, orders, accounting, HR all exist.
- Only **1 new microservice** is required (`delivery`).
- **4 new frontend apps** are required (admin panel, customer app, delivery executive app, POS terminal).
- Model extensions are required in 4 existing services.
- No change to the core gateway, auth, multi-tenancy, or service-to-service communication patterns.

### What This Gives Us Over the Proposal's Approach

| Dimension | Proposal (Node/Express/MongoDB) | Our Approach (ERP Monorepo) |
|---|---|---|
| Auth & RBAC | Build from scratch | Already built — JWT, refresh, RBAC, multi-tenant |
| Inventory | Build from scratch | Already built — products, variants, stock, warehouses |
| Orders | Build from scratch | Already built — orders, returns, credit notes |
| Accounting | Build from scratch | Already built — invoices, GST, journals |
| HR / Payroll | Not in scope | Already built — use for delivery executive management |
| Procurement | Not in scope | Already built — vendor/supplier management |
| Database | MongoDB (limited ACID) | PostgreSQL (full ACID — critical for billing/stock) |
| Transactions | Limited | `prisma.$transaction` across all financial operations |
| Multi-tenancy | Not mentioned | Built-in — future multi-store = multi-tenant |

---

## 2. Architecture Decision

### Why Keep the ERP as the Foundation

1. **Financial integrity** — POS billing, GST, and invoices require ACID transactions. PostgreSQL + Prisma provides this; MongoDB does not reliably.
2. **Audit trail** — The `AuditLog` model is already in every service.
3. **Multi-store ready** — The existing multi-tenancy model maps directly to multi-store support. Each store = one tenant.
4. **Code reuse** — `@erp/auth`, `@erp/config`, `@erp/types`, `@erp/ui` are shared across all apps.
5. **Security** — The gateway's JWT + service-key pattern is already hardened and OWASP-aligned.

### What Changes vs What Stays the Same

```
UNCHANGED                          CHANGED / EXTENDED                 NEW
─────────────────────────────────  ─────────────────────────────────  ─────────────────────
gateway auth flow                  gateway: + Banner, Coupon,         delivery service :3006
service-to-service via x-svc-key     FCMToken, StoreSetting           apps/admin
JWT payload structure              sales: + CustomerAddress,          apps/customer
multi-tenancy pattern                OnlineOrder flag, DeliveryFee    apps/delivery-app
@erp/auth middleware               accounting: + Bill, CashShift,     apps/pos (optional)
@erp/config ServiceClient            BillItem, CashShiftEntry
inventory models (all)             hr: + DeliveryEarning model
procurement models (all)           @erp/types: + grocery enums
@erp/ui components (all)           @erp/config: + delivery service
```

---

## 3. Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                               │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Customer App│  │ Admin Panel │  │ Delivery App │  │   POS Terminal   │ │
│  │ apps/customer│  │ apps/admin  │  │apps/delivery │  │  apps/pos        │ │
│  │   :3008     │  │   :3007     │  │  app :3009   │  │    :3010         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼───────────┘
          │  Bearer JWT    │  Bearer JWT    │  Bearer JWT        │  Bearer JWT
          └────────────────┼────────────────┼────────────────────┘
                           ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY  :3000                                      │
│  Auth · Tenants · Licenses · Invitations · Notifications                   │
│  Banners · Coupons · FCM Push · AuditLog · RBAC · StoreSetting             │
│                                                                             │
│  Proxies all /api/proxy/<service>/* requests to downstream services        │
│  Injects: x-tenant-id · x-user-id · x-user-role into every request        │
└──────┬──────┬────────┬───────┬──────────┬──────────────┬───────────────────┘
       │      │        │       │          │              │
       ▼      ▼        ▼       ▼          ▼              ▼
┌──────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ sales    │ │ inventory │ │account  │ │  hr      │ │procure   │ │delivery  │
│  :3001   │ │  :3002    │ │  :3003  │ │  :3004   │ │  :3005   │ │  :3006   │
│          │ │           │ │         │ │          │ │          │ │  ✦ NEW   │
│Customers │ │Categories │ │POS Bills│ │Delivery  │ │Vendors   │ │Zones     │
│Addresses │ │Products   │ │Cash     │ │Executives│ │Suppliers │ │Assignment│
│Orders    │ │Variants   │ │Shifts   │ │Earnings  │ │POs       │ │Tracking  │
│Returns   │ │Stock      │ │Invoices │ │Shifts    │ │Receiving │ │Compens.  │
│Coupons   │ │Barcodes   │ │GST      │ │Reports   │ │Returns   │ │           │
│           │ │Warehouses │ │Payments │ │          │ │          │ │           │
└──────┬───┘ └─────┬─────┘ └────┬────┘ └─────┬────┘ └────┬─────┘ └────┬─────┘
       │           │            │             │           │            │
       └───────────┴────────────┴─────────────┴───────────┴────────────┘
                                PostgreSQL
                          (one database per service)
```

### Service Call Directions

```
sales        → inventory   reserve / release / deduct stock ; receive-return
sales        → accounting  create AR invoice ; create credit note
sales        → delivery    create delivery assignment after order confirmed
procurement  → inventory   receive-PO stock ; return-to-vendor stock
procurement  → accounting  create AP invoice ; create debit note
hr           → accounting  post payroll journals
delivery     → hr          lookup executive; update executive status
accounting   → inventory   deduct stock after POS bill (billing integration)
gateway      → all         proxy + header injection (x-tenant-id, x-user-id, x-user-role)
all services → gateway     JWT verified locally — no HTTP call needed
```

---

## 4. Service Responsibility Map

### 4.1 Gateway (:3000) — Extended

| Existing | New for Grocery |
|---|---|
| Auth (login, refresh, logout, password reset) | `Banner` model — homepage & promotional banners |
| Tenant management | `Coupon` model — promo codes, percentage/flat discounts |
| Module licensing | `FCMToken` model — push notification device tokens |
| User invitations | `StoreSetting` model — store-specific config (GST no., address) |
| Notifications (in-app) | FCM push dispatch via Firebase Admin SDK |
| AuditLog | Coupon validation endpoint |

### 4.2 Sales (:3001) — Extended

| Existing | New for Grocery |
|---|---|
| Customer CRUD | `CustomerAddress` model — multiple delivery addresses per customer |
| SalesOrder lifecycle | `isOnlineOrder` flag on SalesOrder |
| Quote → Order flow | `deliveryFee` field on SalesOrder |
| SalesReturn + CreditNote | `paymentMethod` field (COD / UPI / CARD / WALLET) |
| DiscountRule | `paymentStatus` field (PENDING / PAID / REFUNDED) |
| CRM (Leads, Opportunities) | Customer block/unblock (`isBlocked` flag) |

### 4.3 Inventory (:3002) — Minor Extension Only

| Existing | New for Grocery |
|---|---|
| ProductCategory (with parentId = sub-categories) ✅ | `barcode` field on Product |
| Product CRUD ✅ | `brandId` field on Product |
| ProductVariant ✅ | `Brand` model |
| WarehouseStock + VariantStock ✅ | `expiryDate` on VariantStock ✅ (already exists) |
| StockMovement ✅ | `imageUrls` field on Product (JSON array) |
| StockReservation ✅ | `weight` + `weightUnit` fields on Product |
| Reorder level alerts ✅ | `isFeatured` + `sortOrder` on ProductCategory |
| BOM ✅ | `featuredImageUrl` on ProductCategory |

### 4.4 Accounting (:3003) — Extended for POS

| Existing | New for Grocery |
|---|---|
| Invoices (AR) ✅ | `Bill` model — POS walk-in billing |
| CreditNotes ✅ | `BillItem` model — line items on a bill |
| TaxRates / GST ✅ | `CashShift` model — daily cash counter management |
| Journals ✅ | `CashShiftEntry` model — cash-in/out log |
| Payments ✅ | `BillReturn` model — POS return/refund |

### 4.5 HR (:3004) — Minor Extension

| Existing | New for Grocery |
|---|---|
| Employee CRUD ✅ | `isDeliveryExecutive` flag on Employee |
| Payroll + Payslips ✅ | `DeliveryEarning` model — per-order commission log |
| Leave management ✅ | `availabilityStatus` on Employee (AVAILABLE / BUSY / OFF_DUTY) |
| TDS slabs ✅ | — |

### 4.6 Procurement (:3005) — No Changes

Handles vendor/supplier management, purchase orders, and goods receipt. Used as-is for grocery restocking workflows.

### 4.7 Delivery (:3006) — NEW SERVICE

Owns the complete delivery operations domain. See [Section 5](#5-new-service--delivery-3006).

---

## 5. New Service — Delivery (:3006)

### Responsibility

- Delivery zone and pincode configuration
- Delivery fee calculation (distance/zone-based, free-above threshold)
- Order-to-executive assignment
- Real-time delivery status tracking
- Executive compensation configuration (fixed salary, per-order commission, bonuses)
- Delivery performance reporting

### Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

model DeliveryZone {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  pincodes     String[]
  baseFee      Float    @default(0)
  perKmFee     Float    @default(0)
  freeAbove    Float?                // free delivery if order total > this
  minOrderAmt  Float?                // minimum order for this zone
  maxDistance  Float?                // km — null = unlimited
  estimatedMin Int      @default(30) // estimated delivery minutes
  estimatedMax Int      @default(60)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  assignments DeliveryAssignment[]

  @@index([tenantId])
}

model DeliveryCompensationConfig {
  id              String   @id @default(cuid())
  tenantId        String
  fixedSalary     Float    @default(0)
  perOrderBonus   Float    @default(0)
  bonusThreshold  Int?     // deliveries/month to unlock bonus
  bonusAmount     Float?
  incentiveRules  Json?    // flexible JSON for custom incentive tiers
  effectiveFrom   DateTime @default(now())
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}

model DeliveryAssignment {
  id            String    @id @default(cuid())
  tenantId      String
  orderId       String    // ref: sales.SalesOrder.id
  executiveId   String    // ref: hr.Employee.id
  zoneId        String
  deliveryFee   Float     @default(0)
  status        String    @default("ASSIGNED")
  // ASSIGNED | PICKED_UP | OUT_FOR_DELIVERY | DELIVERED | FAILED | CANCELLED
  assignedAt    DateTime  @default(now())
  pickedUpAt    DateTime?
  deliveredAt   DateTime?
  failedAt      DateTime?
  failureReason String?
  customerNote  String?
  proofImageUrl String?   // delivery photo proof
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  zone     DeliveryZone      @relation(fields: [zoneId], references: [id])
  tracking DeliveryTracking[]
  earnings DeliveryEarningLog[]

  @@index([tenantId])
  @@index([orderId])
  @@index([executiveId])
}

model DeliveryTracking {
  id           String   @id @default(cuid())
  tenantId     String
  assignmentId String
  status       String
  latitude     Float?
  longitude    Float?
  notes        String?
  recordedAt   DateTime @default(now())

  assignment DeliveryAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([tenantId, assignmentId])
}

model DeliveryEarningLog {
  id           String   @id @default(cuid())
  tenantId     String
  executiveId  String   // ref: hr.Employee.id
  assignmentId String
  orderId      String
  baseEarning  Float
  bonus        Float    @default(0)
  total        Float
  period       String   // "2026-05" — for monthly rollup
  createdAt    DateTime @default(now())

  assignment DeliveryAssignment @relation(fields: [assignmentId], references: [id])

  @@index([tenantId])
  @@index([executiveId, period])
}

model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  userId     String
  action     String
  resource   String
  resourceId String
  oldValues  Json?
  newValues  Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([resource, resourceId])
}
```

---

## 6. Model Extensions to Existing Services

### 6.1 Gateway — Add to schema.prisma

```prisma
model Banner {
  id          String    @id @default(cuid())
  tenantId    String
  title       String
  imageUrl    String
  linkUrl     String?
  type        String    @default("HOME")  // HOME | PROMOTIONAL | CATEGORY | PRODUCT
  position    Int       @default(0)
  isActive    Boolean   @default(true)
  startsAt    DateTime?
  endsAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
}

model Coupon {
  id              String    @id @default(cuid())
  tenantId        String
  code            String
  description     String?
  type            String    // PERCENTAGE | FLAT_AMOUNT | FREE_DELIVERY
  value           Float
  minOrderAmount  Float?
  maxDiscount     Float?    // cap for percentage coupons
  usageLimit      Int?      // total uses allowed
  usageCount      Int       @default(0)
  perUserLimit    Int       @default(1)
  isActive        Boolean   @default(true)
  startsAt        DateTime?
  endsAt          DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  usages CouponUsage[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

model CouponUsage {
  id        String   @id @default(cuid())
  couponId  String
  tenantId  String
  userId    String
  orderId   String
  discount  Float
  usedAt    DateTime @default(now())

  coupon Coupon @relation(fields: [couponId], references: [id])

  @@index([tenantId, userId])
}

model FCMToken {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  token     String
  platform  String   // ANDROID | IOS | WEB
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, token])
  @@index([tenantId, userId])
}
```

### 6.2 Sales — Add to schema.prisma

```prisma
model CustomerAddress {
  id         String  @id @default(cuid())
  tenantId   String
  customerId String
  label      String  @default("Home")  // Home | Work | Other
  line1      String
  line2      String?
  city       String
  state      String?
  pincode    String
  isDefault  Boolean @default(false)
  isActive   Boolean @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([tenantId, customerId])
}
```

Add to `SalesOrder` model:
```prisma
  // Online order fields
  isOnlineOrder     Boolean @default(false)
  deliveryAddressId String?               // ref: CustomerAddress.id
  deliveryFee       Float   @default(0)
  paymentMethod     String  @default("COD") // COD | UPI | CARD | WALLET | SPLIT
  paymentStatus     String  @default("PENDING") // PENDING | PAID | REFUNDED | PARTIAL
  couponId          String?
  couponDiscount    Float   @default(0)
```

Add to `Customer` model:
```prisma
  isBlocked     Boolean  @default(false)
  blockedReason String?
  blockedAt     DateTime?
  wallet        Float    @default(0)  // wallet balance
```

### 6.3 Accounting — Add to schema.prisma

```prisma
model CashShift {
  id              String    @id @default(cuid())
  tenantId        String
  cashierId       String    // ref: gateway User.id
  openingBalance  Float
  closingBalance  Float?
  expectedBalance Float?    // calculated from bills
  difference      Float?    // closingBalance - expectedBalance
  status          String    @default("OPEN")  // OPEN | CLOSED
  openedAt        DateTime  @default(now())
  closedAt        DateTime?
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  bills   Bill[]
  entries CashShiftEntry[]

  @@index([tenantId])
  @@index([cashierId])
}

model CashShiftEntry {
  id        String   @id @default(cuid())
  tenantId  String
  shiftId   String
  type      String   // CASH_IN | CASH_OUT | BILL_PAYMENT | REFUND
  amount    Float
  reference String?
  notes     String?
  createdAt DateTime @default(now())

  shift CashShift @relation(fields: [shiftId], references: [id])

  @@index([tenantId, shiftId])
}

model Bill {
  id              String    @id @default(cuid())
  tenantId        String
  billNumber      String
  shiftId         String?
  customerId      String?   // null = guest billing
  customerName    String?   // for guest
  customerPhone   String?   // for guest
  subtotal        Float
  discountTotal   Float     @default(0)
  taxAmount       Float     @default(0)
  taxRate         Float     @default(0)
  total           Float
  paymentMethod   String    @default("CASH")  // CASH | UPI | CARD | WALLET | SPLIT
  paymentStatus   String    @default("PAID")  // PAID | HELD | CANCELLED | REFUNDED
  status          String    @default("COMPLETED") // COMPLETED | HELD | CANCELLED
  notes           String?
  billedBy        String    // userId
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  shift   CashShift? @relation(fields: [shiftId], references: [id])
  items   BillItem[]
  returns BillReturn[]

  @@unique([tenantId, billNumber])
  @@index([tenantId])
}

model BillItem {
  id          String  @id @default(cuid())
  billId      String
  productId   String
  variantId   String?
  productName String
  sku         String?
  barcode     String?
  quantity    Float
  unitPrice   Float
  discount    Float   @default(0)
  taxAmount   Float   @default(0)
  total       Float

  bill Bill @relation(fields: [billId], references: [id], onDelete: Cascade)
}

model BillReturn {
  id         String   @id @default(cuid())
  tenantId   String
  billId     String
  reason     String?
  totalRefund Float
  refundMethod String @default("CASH")  // CASH | UPI | WALLET
  processedBy String
  createdAt  DateTime @default(now())

  bill  Bill            @relation(fields: [billId], references: [id])
  items BillReturnItem[]

  @@index([tenantId])
}

model BillReturnItem {
  id          String @id @default(cuid())
  returnId    String
  productId   String
  variantId   String?
  productName String
  quantity    Float
  unitPrice   Float
  refundAmount Float

  billReturn BillReturn @relation(fields: [returnId], references: [id], onDelete: Cascade)
}
```

### 6.4 HR — Add to schema.prisma

```prisma
// Add to Employee model:
  isDeliveryExecutive  Boolean  @default(false)
  availabilityStatus   String   @default("AVAILABLE") // AVAILABLE | BUSY | OFF_DUTY
  currentOrderId       String?  // ref: sales.SalesOrder.id
  vehicleType          String?  // BIKE | SCOOTER | VAN
  vehicleNumber        String?
```

### 6.5 Inventory — Minor field additions

```prisma
// Add to Product model:
  barcode     String?
  brandId     String?
  imageUrls   Json?       // String[] of image URLs
  weight      Float?
  weightUnit  String?     // g | kg | ml | L
  isFeatured  Boolean @default(false)

// Add to ProductCategory model:
  isFeatured      Boolean @default(false)
  sortOrder       Int     @default(0)
  bannerImageUrl  String?
  iconUrl         String?

// New model:
model Brand {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  logoUrl   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

---

## 7. New Frontend Applications

### 7.1 apps/admin (:3007) — Admin Panel

Next.js 15 + Tailwind + shadcn/ui. Calls all backend services via the gateway proxy.

```
apps/admin/src/app/
  dashboard/              ← KPIs, analytics, operational monitoring
  orders/                 ← order list, detail, status management, assignment
  products/               ← product CRUD, images, variants
  categories/             ← category tree, banners, sorting
  inventory/              ← stock levels, adjustments, low stock alerts
  billing/                ← POS interface, cash shift, bill history
  delivery/
    zones/                ← zone config, pincodes, fee rules
    assignments/          ← live assignment board
    executives/           ← executive management + earnings
  customers/              ← customer list, profile, block/unblock
  promotions/
    banners/              ← homepage & promotional banners
    coupons/              ← coupon management
  reports/
    sales/                ← daily/weekly/monthly/yearly/custom
    orders/               ← order summary, payment, cancel, return
    inventory/            ← stock, low-stock, valuation
    delivery/             ← executive performance, earnings
  notifications/          ← send push, view logs
  settings/
    store/                ← store details, GST number
    users/                ← RBAC, user management
    delivery-config/      ← compensation settings
```

### 7.2 apps/customer (:3008) — Customer App

Next.js (PWA) or React Native Web. Public-facing storefront.

```
apps/customer/src/app/
  /                       ← homepage, featured banners, categories
  /categories/[id]        ← category product listing
  /products/[id]          ← product detail, variants, add to cart
  /search                 ← product search, filters
  /cart                   ← cart review, coupon apply
  /checkout               ← address selection, payment method, place order
  /orders                 ← order history
  /orders/[id]            ← order detail + live tracking
  /profile                ← customer profile, addresses
  /returns/[orderId]      ← initiate return
```

### 7.3 apps/delivery-app (:3009) — Delivery Executive PWA

```
apps/delivery-app/src/app/
  /                       ← assigned orders queue
  /assignments/[id]       ← order detail + status update buttons
  /history                ← completed deliveries
  /earnings               ← daily/weekly/monthly earnings
  /profile                ← profile, availability toggle
```

### 7.4 apps/pos (:3010) — POS Terminal (Optional)

Optimized for touchscreen / tablet. Calls `accounting` service directly.

```
apps/pos/src/app/
  /                       ← product search, barcode scan, cart
  /shift                  ← open/close cash shift
  /bills                  ← bill history, reprint
  /returns                ← initiate bill return
```

---

## 8. E2E Use Case Coverage Matrix

### Legend
- ✅ **Covered** — fully supported by existing ERP models and APIs
- ⚠️ **Partial** — model exists but needs extension or new API endpoints
- 🔧 **Needs Build** — model extension required (no new service needed)
- 🆕 **New** — requires new service or major new models
- ❌ **Not Covered** — not in current codebase at all

---

### Module 1 — Admin Dashboard & Business Analytics

| Feature | Status | Service | Notes |
|---|---|---|---|
| Daily / Weekly / Monthly / Yearly Sales Reports | ⚠️ Partial | sales | Query endpoint needed on `/api/reports/sales` |
| Custom Date Range Analytics | ⚠️ Partial | sales | Filter params needed |
| Revenue by Payment Method | 🔧 Needs Build | sales | `paymentMethod` field to be added to SalesOrder |
| Revenue by Category | ⚠️ Partial | inventory + sales | Join via productId → categoryId |
| Revenue by Product | ⚠️ Partial | sales | Aggregation on SalesOrderItem |
| Revenue Trend Analysis | ⚠️ Partial | sales | Time-series group-by query |
| Total / Active Customers | ✅ Covered | sales | COUNT on Customer |
| New Registrations | ✅ Covered | sales | Filter by createdAt |
| Total Products / Categories / Brands | ⚠️ Partial | inventory | Brand model to be added |
| Delivery Personnel Count | ✅ Covered | hr | COUNT employees with `isDeliveryExecutive=true` |
| Total / Pending / Processing / Completed / Cancelled / Returned Orders | ✅ Covered | sales | SalesOrder status filter |
| COD vs Online Payment Orders | 🔧 Needs Build | sales | `paymentMethod` field needed |
| Latest Orders | ✅ Covered | sales | ORDER BY createdAt DESC |
| Top Selling Products / Categories | ⚠️ Partial | sales + inventory | Aggregation on SalesOrderItem |
| Recent Customers | ✅ Covered | sales | ORDER BY createdAt DESC |
| Low Stock Alerts | ✅ Covered | inventory | `quantity <= reorderLevel` |
| Inventory Valuation | ✅ Covered | inventory | SUM(quantity * costPrice) |
| Delivery Status Overview | 🆕 New | delivery | DeliveryAssignment status counts |
| Delivery Performance Metrics | 🆕 New | delivery | Avg delivery time, on-time rate |

---

### Module 2 — Order Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| View All Orders | ✅ Covered | sales | GET /api/orders with pagination |
| Order Search & Filtering (ID, customer, mobile, payment, status, date) | ⚠️ Partial | sales | Mobile / paymentMethod filters to add |
| Order Details Management | ✅ Covered | sales | GET /api/orders/:id |
| Order Status Updates | ✅ Covered | sales | PATCH /api/orders/:id/status |
| Order Timeline Tracking | 🆕 New | delivery | DeliveryTracking logs |
| Delivery Assignment | 🆕 New | delivery | POST /api/assignments |
| Invoice Generation | ✅ Covered | accounting | POST /api/invoices |
| Bulk Order Processing | ⚠️ Partial | sales | Bulk status update endpoint needed |
| Order Cancellation Management | ✅ Covered | sales | PATCH status → CANCELLED |
| Return Management | ✅ Covered | sales | SalesReturn model + endpoints |
| Delivery Delay Notifications | 🆕 New | delivery + gateway | SSE / FCM when ETA exceeded |
| Bulk Status Updates | ⚠️ Partial | sales | Batch endpoint needed |
| Order Tracking Logs | 🆕 New | delivery | DeliveryTracking table |
| Activity History | ✅ Covered | sales (AuditLog) | AuditLog per order |

---

### Module 3 — Category Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Main Category Management | ✅ Covered | inventory | ProductCategory CRUD |
| Sub-Category Management | ✅ Covered | inventory | parentId self-relation |
| Category Sorting | 🔧 Needs Build | inventory | `sortOrder` field to add |
| Category Visibility Controls | ✅ Covered | inventory | `isActive` field |
| Category Banner Management | 🔧 Needs Build | inventory | `bannerImageUrl` field to add |
| Featured Categories | 🔧 Needs Build | inventory | `isFeatured` field to add |
| Category Performance Reports | ⚠️ Partial | sales + inventory | Aggregation via productId |

---

### Module 4 — Product & Inventory Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Product Creation & Editing | ✅ Covered | inventory | Full CRUD exists |
| Product Variants Management | ✅ Covered | inventory | ProductVariant model |
| Product Images Management | 🔧 Needs Build | inventory | `imageUrls` JSON field to add |
| Product Availability Controls | ✅ Covered | inventory | `isActive` flag |
| Product Visibility Controls | ✅ Covered | inventory | `isActive` flag |
| Product Status Management | ✅ Covered | inventory | `isActive` flag |
| Inventory Tracking | ✅ Covered | inventory | WarehouseStock + StockMovement |
| Stock Updates / Adjustments | ✅ Covered | inventory | POST /api/stock/adjustment |
| Low Stock Alerts | ✅ Covered | inventory | `reorderLevel` field |
| Inventory Valuation | ✅ Covered | inventory | SUM(qty × costPrice) |
| Product Search & Filters | ✅ Covered | inventory | Query params on GET /api/products |
| Product Expiry Management | ✅ Covered | inventory | `expiryDate` on VariantStock |
| Brand Management | 🔧 Needs Build | inventory | `Brand` model to add |
| Manual Order Creation | ✅ Covered | sales | POST /api/orders (admin initiated) |
| Manual Sales Entry | ✅ Covered | accounting | Bill model (POS) |
| Stock Adjustment Management | ✅ Covered | inventory | StockMovement ADJUSTMENT type |
| Product Sorting & Prioritization | 🔧 Needs Build | inventory | `sortOrder` field on Product |
| Barcode Integration | 🔧 Needs Build | inventory | `barcode` field on Product |

---

### Module 5 — Store Billing Management (POS)

| Feature | Status | Service | Notes |
|---|---|---|---|
| Fast POS Billing Interface | 🆕 New | apps/pos (frontend) | New frontend app |
| Barcode Scanner Integration | 🔧 Needs Build | inventory | `barcode` field; lookup API |
| Product Search by Name/SKU/Barcode | ⚠️ Partial | inventory | Add barcode param to search |
| Quick Add to Cart | 🆕 New | apps/pos (frontend) | Client-side cart |
| Multiple Product Variants Support | ✅ Covered | inventory | ProductVariant exists |
| Quantity & Weight-Based Billing | 🔧 Needs Build | inventory | `weight`/`weightUnit` fields |
| Tax Calculation (GST) | ✅ Covered | accounting | TaxRate model exists |
| Split Payment Support | 🔧 Needs Build | accounting | `paymentMethod: SPLIT` + BillItem payments |
| Cash / UPI / Card / Wallet Payments | 🔧 Needs Build | accounting | `Bill.paymentMethod` enum |
| Invoice Generation & Printing | ✅ Covered | accounting | Invoice model |
| Thermal Printer Support | 🆕 New | apps/pos | Browser print API / ESC-POS |
| Reprint Previous Bills | 🔧 Needs Build | accounting | `Bill` model query + print |
| Guest Billing | 🔧 Needs Build | accounting | `customerName`/`customerPhone` on Bill |
| Customer Selection During Billing | ✅ Covered | accounting (Bill.customerId) | Link to existing Customer |
| Customer Purchase History | ✅ Covered | sales + accounting | Orders + Bills by customerId |
| Hold Bill / Resume Bill | 🔧 Needs Build | accounting | `Bill.status = HELD` |
| Bill Cancellation | 🔧 Needs Build | accounting | `Bill.status = CANCELLED` |
| Return & Refund Processing | 🔧 Needs Build | accounting | `BillReturn` model |
| Partial Return Handling | 🔧 Needs Build | accounting | `BillReturnItem` per line |
| Manual Billing Entries | ✅ Covered | accounting | Bill CRUD |
| Daily Cash Opening Balance | 🔧 Needs Build | accounting | `CashShift.openingBalance` |
| Cash Closing Reports | 🔧 Needs Build | accounting | CashShift close flow |
| Shift-wise Billing Reports | 🔧 Needs Build | accounting | Bills grouped by shiftId |
| Cash Collection Tracking | 🔧 Needs Build | accounting | CashShiftEntry model |
| Cash Difference Reports | 🔧 Needs Build | accounting | `CashShift.difference` |
| Automatic Stock Deduction After Billing | 🔧 Needs Build | accounting → inventory | `ServiceClient` call post-bill |
| Real-Time Inventory Updates | ✅ Covered | inventory | Stock deduct on each bill |
| Low Stock Notifications | ✅ Covered | inventory + gateway | Notification trigger on reorder |
| Product Availability Validation | ✅ Covered | inventory | Stock check before bill |
| Daily Billing Reports | 🔧 Needs Build | accounting | Bills by date |
| GST Reports | ✅ Covered | accounting | TaxRate × BillItem |
| Profit & Margin Reports | ⚠️ Partial | accounting + inventory | Revenue − costPrice × qty |
| Multi-Store Support | ✅ Covered | gateway | Multi-tenancy = multi-store |

---

### Module 6 — Promotions & Banner Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Homepage Banner Management | 🔧 Needs Build | gateway | `Banner` model to add |
| Promotional Banner Management | 🔧 Needs Build | gateway | `Banner.type = PROMOTIONAL` |
| Offer Campaign Management | 🔧 Needs Build | gateway | `Coupon` model + Campaign |
| Seasonal Campaigns | 🔧 Needs Build | gateway | `Coupon.startsAt / endsAt` |
| Featured Product Promotions | 🔧 Needs Build | inventory | `Product.isFeatured` flag |
| Category Promotions | 🔧 Needs Build | inventory | `ProductCategory.isFeatured` |

---

### Module 7 — Delivery Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Delivery Personnel Management | ✅ Covered | hr | Employee + `isDeliveryExecutive` |
| Order Assignment | 🆕 New | delivery | DeliveryAssignment model |
| Delivery Status Tracking | 🆕 New | delivery | DeliveryTracking table |
| Delivery Monitoring Dashboard | 🆕 New | delivery + apps/admin | Live assignment board |
| Delivery Performance Reports | 🆕 New | delivery | Aggregations on assignments |
| Distance-Based Delivery Charges | 🆕 New | delivery | `DeliveryZone.perKmFee` |
| Zone-Based Delivery Settings | 🆕 New | delivery | `DeliveryZone` model |
| Delivery Time Configuration | 🆕 New | delivery | `estimatedMin/Max` on Zone |
| Dynamic Delivery Fee Management | 🆕 New | delivery | Zone fee rules |
| Fixed Salary Configuration | 🆕 New | delivery | `DeliveryCompensationConfig` |
| Per Order Commission Settings | 🆕 New | delivery | `perOrderBonus` field |
| Bonus Management | 🆕 New | delivery | `bonusThreshold/Amount` |
| Incentive Management | 🆕 New | delivery | `incentiveRules` JSON field |

---

### Module 8 — Delivery Executive Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Assigned Orders | 🆕 New | delivery | Assignments by executiveId |
| Completed Deliveries | 🆕 New | delivery | Status = DELIVERED filter |
| Earnings Tracking | 🆕 New | delivery + hr | `DeliveryEarningLog` model |
| Daily / Weekly / Monthly Reports | 🆕 New | delivery | Grouped by date/period |
| Performance Monitoring | 🆕 New | delivery | On-time rate, avg time metrics |
| Cash Collection Reports | ⚠️ Partial | delivery + accounting | COD amount collected per executive |
| Online Payment Reports | 🆕 New | delivery | Online orders per executive |
| Delivery Completion Reports | 🆕 New | delivery | Completion rate |
| Executive Performance Reports | 🆕 New | delivery | Full performance dashboard |

---

### Module 9 — Customer Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Customer Listing | ✅ Covered | sales | GET /api/customers |
| Customer Profile Management | ✅ Covered | sales | CRUD on Customer |
| Customer Search | ✅ Covered | sales | Query param filtering |
| Customer Activity Monitoring | ✅ Covered | sales (AuditLog) | Activity via orders/returns |
| Address Management | 🔧 Needs Build | sales | `CustomerAddress` model |
| Customer Order History | ✅ Covered | sales | Orders filtered by customerId |
| Account Status Management | ✅ Covered | sales | `isActive` flag |
| Block / Unblock Customers | 🔧 Needs Build | sales | `isBlocked` + `blockedReason` |
| Purchase History | ✅ Covered | sales | SalesOrder history |
| Order Frequency | ⚠️ Partial | sales | COUNT query by customerId |
| Customer Lifetime Value | ⚠️ Partial | sales | SUM(order.total) by customerId |
| Recent Activity Tracking | ✅ Covered | sales | AuditLog + recent orders |

---

### Module 10 — Reporting & Analytics

| Feature | Status | Service | Notes |
|---|---|---|---|
| Daily/Weekly/Monthly/Yearly Sales Reports | ⚠️ Partial | sales | Report endpoints to add |
| Custom Date Range Reports | ⚠️ Partial | sales | Filter params needed |
| Order Summary / Payment / Cancellation / Return Reports | ⚠️ Partial | sales | Aggregation endpoints |
| Delivery Performance / Executive / Earnings Reports | 🆕 New | delivery | New service |
| Product Sales / Category Sales Reports | ⚠️ Partial | sales + inventory | Cross-service aggregation |
| Inventory / Low Stock Reports | ✅ Covered | inventory | Exists |
| Excel Export | ❌ Not Covered | all | `xlsx` or `exceljs` package needed |
| Date-Based / Filter-Based Exports | ❌ Not Covered | all | Export endpoint per service |

---

### Module 11 — Notification Management

| Feature | Status | Service | Notes |
|---|---|---|---|
| Order Notifications | ✅ Covered | gateway | Notification model exists |
| Inventory Alerts | ✅ Covered | gateway | LOW_STOCK notification type |
| Promotional Notifications | 🔧 Needs Build | gateway | Push via FCMToken |
| Offer Notifications | 🔧 Needs Build | gateway | FCM broadcast |
| System Notifications | ✅ Covered | gateway | Notification model |
| Customer Communication Logs | ✅ Covered | gateway | Notification records |
| FCM Push Notifications | 🔧 Needs Build | gateway | `FCMToken` model + Firebase Admin SDK |

---

### Module 12 — Administration & Security

| Feature | Status | Service | Notes |
|---|---|---|---|
| Admin / Contributor Roles | ✅ Covered | gateway | ADMIN / USER roles exist; MANAGER also |
| Secure Authentication (JWT) | ✅ Covered | gateway | Full JWT + refresh flow |
| Role-Based Access Control | ✅ Covered | gateway | `x-user-role` header checks |
| Password Encryption (bcrypt) | ✅ Covered | gateway | bcryptjs(10) |
| Audit Logs | ✅ Covered | all services | AuditLog model in every service |
| Activity Tracking | ✅ Covered | gateway | AuditLog |
| API Security | ✅ Covered | gateway + @erp/auth | Service key + JWT |
| Scalable Architecture | ✅ Covered | monorepo | Independent services |
| Multi-tenant / Multi-store | ✅ Covered | gateway | Full multi-tenancy |

---

## 9. Complete E2E Data Flows

### Flow A — Customer Places Online Order

```
1. Browse
   Customer App ──GET──▶ inventory /api/products?categoryId=&page=&limit=
                ◀── { data: Product[], meta: { page, limit, total, pages } }

2. View Product
   Customer App ──GET──▶ inventory /api/products/:id
                ◀── { data: Product + variants + stock }

3. Apply Coupon
   Customer App ──POST──▶ gateway /api/coupons/validate { code, orderTotal }
                 ◀── { data: { discount, type, couponId } }

4. Place Order
   Customer App ──POST──▶ sales /api/orders
                          { items, addressId, paymentMethod, couponId }
                 sales:
                   a. Validate coupon (ServiceClient → gateway)
                   b. Check customer credit limit / isBlocked
                   c. CREATE SalesOrder (DRAFT)
                   d. CREATE SalesOrderItems
                   e. POST inventory /api/stock/reserve
                   f. Update SalesOrder → CONFIRMED
                   g. Record CouponUsage (ServiceClient → gateway)
                 ◀── { data: { orderId, orderNumber, total } }

5. Payment (COD — confirm immediately; Online — webhook confirms)
   Payment Gateway Webhook ──POST──▶ sales /api/orders/:id/pay
   sales:
     a. Update paymentStatus = PAID
     b. POST delivery /api/assignments { orderId, zoneId }
     c. POST accounting /api/invoices (AR invoice)
   ◀── 200

6. Delivery Assignment
   delivery:
     a. Find AVAILABLE executive in zone
     b. CREATE DeliveryAssignment (ASSIGNED)
     c. PATCH hr /api/employees/:id { availabilityStatus: BUSY }
     d. POST gateway /api/notifications/push { executiveId, message }

7. Executive Picks Up
   Delivery App ──PATCH──▶ delivery /api/assignments/:id/status { status: PICKED_UP }
   delivery:
     a. UPDATE DeliveryAssignment
     b. CREATE DeliveryTracking record
     c. POST gateway /api/notifications/push { customerId, "Order picked up" }

8. Delivered
   Delivery App ──PATCH──▶ delivery /api/assignments/:id/status { status: DELIVERED }
   delivery:
     a. UPDATE DeliveryAssignment (DELIVERED, deliveredAt)
     b. ServiceClient → sales /api/orders/:id/ship
   sales:
     a. UPDATE SalesOrder → SHIPPED
     b. ServiceClient → inventory /api/stock/deduct
     c. ServiceClient → accounting /api/invoices/:id/finalize
     d. POST gateway /api/notifications { customerId, "Order delivered" }
   delivery:
     c. CREATE DeliveryEarningLog for executive
     d. PATCH hr /api/employees/:id { availabilityStatus: AVAILABLE }
```

### Flow B — Walk-in POS Billing

```
1. Open Cash Shift
   POS ──POST──▶ accounting /api/cash-shifts { openingBalance: 500 }
        ◀── { data: { shiftId } }

2. Scan Product
   POS ──GET──▶ inventory /api/products?barcode=8901234567890
        ◀── { data: { productId, name, price, stock } }

3. Complete Bill
   POS ──POST──▶ accounting /api/bills
                 { shiftId, items, paymentMethod: "CASH", customerId? }
   accounting:
     a. CREATE Bill
     b. CREATE BillItems
     c. Calculate GST
     d. CREATE CashShiftEntry (BILL_PAYMENT)
     e. ServiceClient → inventory /api/stock/deduct (bill reference)
   ◀── { data: { billId, billNumber, total } }

4. Print
   POS renders receipt → Browser Print API / ESC-POS to thermal printer

5. Close Shift
   POS ──PATCH──▶ accounting /api/cash-shifts/:id/close { closingBalance: 2400 }
   accounting:
     a. Calculate expectedBalance = openingBalance + SUM(cash bills) - SUM(refunds)
     b. difference = closingBalance - expectedBalance
     c. UPDATE CashShift (CLOSED)
   ◀── { data: { difference, shiftSummary } }
```

### Flow C — Customer Returns Online Order

```
1. Initiate Return
   Customer App ──POST──▶ sales /api/orders/:orderId/returns
                          { items: [{ productId, quantity, reason }] }
                 sales:
                   a. Validate quantities ≤ shippedQty
                   b. CREATE SalesReturn (PENDING)
                 ◀── { data: { returnId } }

2. Admin Approves
   Admin Panel ──PATCH──▶ sales /api/returns/:id/approve
   sales:
     a. UPDATE SalesReturn → APPROVED
     b. POST gateway /api/notifications { customerId, "Return approved" }

3. Stock Received Back
   Admin Panel ──PATCH──▶ sales /api/returns/:id/receive
   sales:
     a. UPDATE SalesReturn → COMPLETED
     b. ServiceClient → inventory /api/stock/receive-return
     c. ServiceClient → accounting /api/credit-notes (issue credit note)
     d. Trigger refund to customer wallet or payment gateway
```

---

## 10. API Endpoints Required

### New Endpoints (delivery service)

| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/zones | List delivery zones |
| POST | /api/zones | Create zone |
| PATCH | /api/zones/:id | Update zone |
| DELETE | /api/zones/:id | Deactivate zone |
| GET | /api/assignments | List assignments (filterable) |
| POST | /api/assignments | Create assignment |
| PATCH | /api/assignments/:id/status | Update assignment status |
| GET | /api/assignments/:id/tracking | Get tracking history |
| GET | /api/executives/:id/assignments | Executive's assigned orders |
| GET | /api/executives/:id/earnings | Earnings by period |
| GET | /api/reports/performance | Delivery performance report |
| GET | /api/config/compensation | Get compensation config |
| PUT | /api/config/compensation | Update compensation config |

### New Endpoints (gateway)

| Method | Path | Description |
|---|---|---|
| GET | /api/banners | List active banners |
| POST | /api/banners | Create banner |
| PATCH | /api/banners/:id | Update banner |
| DELETE | /api/banners/:id | Deactivate banner |
| GET | /api/coupons | List coupons |
| POST | /api/coupons | Create coupon |
| POST | /api/coupons/validate | Validate coupon for order |
| POST | /api/notifications/push | Send FCM push notification |
| POST | /api/fcm-tokens | Register device token |

### New Endpoints (accounting)

| Method | Path | Description |
|---|---|---|
| GET | /api/cash-shifts | List shifts |
| POST | /api/cash-shifts | Open shift |
| PATCH | /api/cash-shifts/:id/close | Close shift |
| GET | /api/bills | List POS bills |
| POST | /api/bills | Create bill |
| GET | /api/bills/:id | Get bill detail |
| PATCH | /api/bills/:id/cancel | Cancel bill |
| POST | /api/bills/:id/returns | Process return |
| GET | /api/reports/gst | GST report |
| GET | /api/reports/sales | Sales summary |

### New Endpoints (sales)

| Method | Path | Description |
|---|---|---|
| GET | /api/customers/:id/addresses | Customer addresses |
| POST | /api/customers/:id/addresses | Add address |
| PATCH | /api/customers/:id/block | Block customer |
| PATCH | /api/customers/:id/unblock | Unblock customer |
| GET | /api/reports/sales | Sales by date range |
| GET | /api/reports/orders | Order analytics |

---

## 11. Infrastructure & Deployment

```yaml
# docker-compose additions
services:
  delivery:
    build: ./apps/delivery
    ports: ["3006:3000"]
    environment:
      DATABASE_URL: postgresql://...
      SERVICE_SECRET: ${SERVICE_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      FIREBASE_SERVICE_ACCOUNT: ${FIREBASE_SERVICE_ACCOUNT}

  admin:
    build: ./apps/admin
    ports: ["3007:3000"]

  customer:
    build: ./apps/customer
    ports: ["3008:3000"]

  delivery-app:
    build: ./apps/delivery-app
    ports: ["3009:3000"]

  pos:
    build: ./apps/pos
    ports: ["3010:3000"]
```

### New Environment Variables

| Variable | Service | Required | Description |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | gateway, delivery | Yes (push) | Firebase Admin SDK JSON |
| `RAZORPAY_KEY_ID` | gateway / customer | Yes (payments) | Payment gateway |
| `RAZORPAY_KEY_SECRET` | gateway / customer | Yes | Payment gateway secret |
| `DELIVERY_SERVICE_URL` | sales, hr | No | Override delivery service URL |

---

## 12. Phased Build Plan

| Phase | Duration | Deliverables |
|---|---|---|
| **Phase 1** — Model Extensions | Week 1 | Add Banner, Coupon, FCMToken to gateway schema; CustomerAddress, isBlocked to sales; Bill, CashShift to accounting; Brand, barcode to inventory; DeliveryExecutive fields to hr |
| **Phase 2** — Delivery Service | Week 2 | Scaffold delivery service; DeliveryZone, DeliveryAssignment, DeliveryTracking, DeliveryEarningLog; all 14 delivery API endpoints |
| **Phase 3** — Core APIs | Week 3–4 | New gateway endpoints (banners, coupons, FCM); New accounting endpoints (bills, shifts); New sales endpoints (addresses, block, reports) |
| **Phase 4** — Customer App | Week 5–6 | apps/customer: browse, cart, checkout, order tracking, returns |
| **Phase 5** — POS Terminal | Week 6–7 | apps/pos: barcode scan, billing, shift management, print |
| **Phase 6** — Delivery App | Week 7–8 | apps/delivery-app: assignment queue, status updates, earnings |
| **Phase 7** — Admin Panel | Week 8–11 | apps/admin: all 12 module UIs, reports, analytics dashboards |
| **Phase 8** — Hardening | Week 11–12 | Excel exports, FCM push, performance tuning, real-time tracking |

**Total estimated duration: 12 weeks** (vs proposal's 30–40 days which is unrealistic for this scope)

---

*Document maintained by: Engineering Team*
*Next review: After Phase 2 completion*
