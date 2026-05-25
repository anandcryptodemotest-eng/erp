# ERP System — Full Architecture & Design Document

> **Status:** Living document. Update UC implementation status as each use case is completed.
> **Last updated:** May 2026 — v2 adds Sales Return / Credit Note, Purchase Return / Debit Note, partial shipment, partial PO receipt, TDS slabs, credit limit enforcement, payment terms, AuditLog, Notification, BankAccount, Activity, JWT refresh, password reset, multi-tenant switching.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Service Map](#3-service-map)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Cross-Service Communication](#5-cross-service-communication)
6. [Complete Data Models](#6-complete-data-models)
7. [Use Case Designs](#7-use-case-designs)
8. [API Reference](#8-api-reference)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Security Model](#10-security-model)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. System Overview

A **multi-tenant SaaS ERP** built as a Turborepo monorepo of independent Next.js App Router services. Each service owns its own PostgreSQL database and business domain. A single API Gateway authenticates users and proxies all requests to downstream services.

```
                         +------------------------------------------+
  Browser / API Client ->  Gateway  :3000                           |
                         |  Auth . Tenants . Licensing              |
                         |  Notifications . Audit Trail             |
                         +--------------------+---------------------+
                                              |  JWT  +  x-service-key
             +--------------------------------+----------------------------+
             v                               v                            v
       Sales :3001                  Inventory :3002            Accounting :3003
       Leads . Opportunities        Products . Catalogue       Chart of Accounts
       Quotes . Orders              Variants . Price Lists     Journals . Invoices
       Sales Returns                Warehouses . Stock         Credit/Debit Notes
       Customers . Discounts        BOM . Serial/Batch         Payments . Tax
       CRM Activities               Reorder Alerts             Fixed Assets . FX
                                                               Bank Accounts

             v                                                           v
         HR :3004                                        Procurement :3005
         Employees . Pay Grades                          Vendors . POs
         Payroll + TDS Slabs                             Approval Workflows
         Leave Management                                Goods Receipt
         Payslips                                        Purchase Returns
```

### Service Dependencies (call direction)

```
sales        -> inventory   reserve / release / deduct stock ; receive-return
sales        -> accounting  create AR invoice ; create credit note
procurement  -> inventory   receive-po stock ; return-to-vendor stock
procurement  -> accounting  create AP invoice ; create debit note
hr           -> accounting  post payroll journals
all services -> gateway     JWT verified locally (no HTTP call)
```

---

## 2. Technology Stack

| Layer            | Technology                                        |
|------------------|---------------------------------------------------|
| Framework        | Next.js 15 (App Router, Route Handlers)           |
| Language         | TypeScript (strict mode)                          |
| Database         | PostgreSQL 16 (one DB per service)                |
| ORM              | Prisma 6                                          |
| Auth             | JWT / HS256 via jose + bcryptjs passwords         |
| Validation       | Zod                                               |
| Monorepo         | Turborepo + pnpm workspaces                       |
| Containerization | Docker + Docker Compose                           |
| Styling          | Tailwind CSS                                      |
| Shared packages  | @erp/auth  @erp/config  @erp/types  @erp/ui       |

---

## 3. Service Map

| Service     | Port | Owns                                                                              | Calls                       |
|-------------|------|-----------------------------------------------------------------------------------|-----------------------------|
| gateway     | 3000 | Users, Tenants, Licenses, Settings, Invitations, Notifications, AuditLog         | --                          |
| sales       | 3001 | Leads, Opportunities, Activities, Quotes, Orders, SalesReturns, Customers        | inventory, accounting       |
| inventory   | 3002 | Categories, Products, Variants, PriceLists, Warehouses, Stock, BOM               | --                          |
| accounting  | 3003 | CoA, Journals, Invoices, CreditNotes, DebitNotes, Payments, Tax, Assets, FX      | --                          |
| hr          | 3004 | Employees, PayGrades, TaxSlabs, Payroll, Payslips, Leave                         | accounting                  |
| procurement | 3005 | Vendors, PurchaseOrders, PurchaseReturns                                          | inventory, accounting       |

---

## 4. Authentication & Authorization

### 4.1 JWT Token Payload

```ts
{
  userId:   string;    // user DB id
  tenantId: string;    // active tenant
  role:     UserRole;  // see below
  modules:  string[];  // licensed modules for this tenant
  exp:      number;    // Unix timestamp (24h)
}
```

### 4.2 Roles and Permissions

| Role                 | Allowed Actions                                                |
|----------------------|----------------------------------------------------------------|
| ADMIN                | Everything — user management, module purchasing, all writes    |
| MANAGER              | Approve POs, approve leave, approve large discounts, approve returns |
| SALES_REP            | Leads, Opportunities, Quotes, Orders, Customers, Activities    |
| PROCUREMENT_OFFICER  | Vendors, POs (create/submit), Goods Receipt                    |
| HR_MANAGER           | Employees, Payroll, Leave approval                             |
| ACCOUNTANT           | Journals, Invoices, Payments, Tax, Reports                     |
| USER                 | Read-only on all resources within licensed modules             |

### 4.3 Authentication Flow

```
1. Client sends credentials to POST /api/auth
2. Gateway validates, returns { accessToken (24h), refreshToken (7d) }
3. Client attaches JWT as  Authorization: Bearer <token>
4. Service middleware verifies JWT via @erp/auth
5. Middleware injects x-user-id, x-tenant-id, x-user-role into request headers
6. Route handler reads those headers -- never from body
```

### 4.4 Service-to-Service Auth

```
ServiceClient adds:  x-service-key: <SERVICE_SECRET>
Middleware checks:   if SERVICE_SECRET env is set AND header matches -> skip JWT
Fail-closed:         if SERVICE_SECRET env is NOT set -> reject all service calls
```

### 4.5 JWT Refresh Token Flow

```
Gateway stores:  RefreshToken { id, userId, token (hashed), expiresAt (7d), isRevoked }

POST /api/auth?action=refresh
  Body: { refreshToken }
  1. Hash incoming token, find RefreshToken record
  2. Check !isRevoked && expiresAt > now
  3. Rotate: revoke old token, issue new accessToken + refreshToken
  4. Return { accessToken, refreshToken }

POST /api/auth?action=logout
  Body: { refreshToken }
  1. Hash token, set RefreshToken.isRevoked = true
```

### 4.6 Password Reset Flow

```
POST /api/auth?action=forgot-password
  Body: { email }
  1. Find user by email (do NOT reveal if email exists -- always return 200)
  2. Create PasswordResetToken { token (random 32-byte hex), expiresAt (1h) }
  3. Send email with link: https://app.example.com/reset-password?token=<token>

POST /api/auth?action=reset-password
  Body: { token, newPassword }
  1. Find valid (not expired, not used) PasswordResetToken
  2. Hash new password with bcrypt(10)
  3. Update user.password, mark token as used
  4. Revoke all active refresh tokens for this user (security)
  5. Return 200
```

### 4.7 Multi-Tenant Switching

```
A user can belong to multiple tenants. When switching:

GET /api/tenants/me
  -> Returns all TenantUser records for this user (tenantId, tenantName, role)

POST /api/auth?action=switch-tenant
  Body: { tenantId }
  1. Verify user is active member of target tenant
  2. Issue new JWT with new tenantId + role from that tenant
  3. Return { accessToken, refreshToken }
```

---

## 5. Cross-Service Communication

### 5.1 ServiceClient Usage

```ts
import { serviceClient } from "@erp/config";

const result = await serviceClient.call("inventory", "/api/stock/reserve", {
  method: "POST",
  body: { orderId, items },
  tenantId,
  userId,
});

if (result.error) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

### 5.2 Error Handling Contract

- If downstream service is unavailable -> return `503` upstream
- If downstream returns `400/409` -> propagate same code to client
- Never leave the order in a partial state -- use compensation (cancel reservation on failure)

### 5.3 Eventual Consistency (Try-Compensate)

```
Confirm Order:
  Step 1: Reserve stock       -> success
  Step 2: (no other step)     -> done

Ship Order:
  Step 1: Deduct stock        -> success
  Step 2: Create AR invoice   -> FAIL
  Compensate: Reverse stock deduction (POST /stock/adjustment +qty)
  Return 500 to client

Receive Sales Return:
  Step 1: Receive-return stock -> success
  Step 2: Create credit note   -> FAIL
  Compensate: Reverse stock receipt (POST /stock/adjustment -qty)
  Return 500 to client
```

---

## 6. Complete Data Models

### 6.1 Gateway

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // bcrypt hash
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenants       TenantUser[]
  refreshTokens RefreshToken[]
  resetTokens   PasswordResetToken[]
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  domain    String?  @unique
  plan      String   @default("starter")
  currency  String   @default("USD")   // base currency
  timezone  String   @default("UTC")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users    TenantUser[]
  licenses ModuleLicense[]
  settings TenantSetting[]
}

model TenantUser {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  role      String   @default("USER")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([tenantId])
}

model ModuleLicense {
  id        String    @id @default(cuid())
  tenantId  String
  moduleId  String
  plan      String    @default("basic")
  maxUsers  Int       @default(5)
  isActive  Boolean   @default(true)
  expiresAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([tenantId, moduleId])
  @@index([tenantId])
}

model TenantSetting {
  id       String @id @default(cuid())
  tenantId String
  key      String  // "tax_rate" | "invoice_prefix" | "fiscal_year_start" | "po_approval_threshold"
  value    String

  @@unique([tenantId, key])
  @@index([tenantId])
}

model Invitation {
  id        String   @id @default(cuid())
  tenantId  String
  email     String
  role      String
  token     String   @unique
  expiresAt DateTime
  status    String   @default("PENDING")   // PENDING | ACCEPTED | EXPIRED
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([token])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique  // store SHA-256 hash, never plaintext
  expiresAt DateTime
  isRevoked Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Notification {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String   // recipient
  type         String   // LOW_STOCK | OVERDUE_INVOICE | PO_APPROVAL | LEAVE_APPROVAL | RETURN_APPROVAL
  title        String
  message      String
  resourceType String?  // "SalesOrder" | "PurchaseOrder" | "Invoice" | etc.
  resourceId   String?
  isRead       Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([tenantId, userId])
}

// AuditLog pattern -- add this model to EVERY service schema
model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  userId     String
  action     String   // CREATE | UPDATE | DELETE | STATUS_CHANGE | APPROVE | REJECT
  resource   String   // "SalesOrder" | "Invoice" | "Employee" | etc.
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

### 6.2 Sales Service

```prisma
// ---- CRM Pipeline -----------------------------------------------------------

model Lead {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  email       String?
  phone       String?
  company     String?
  source      String?   // WEB | REFERRAL | COLD_CALL | EVENT | OTHER
  status      String    @default("NEW")
  // NEW | CONTACTED | QUALIFIED | DISQUALIFIED
  notes       String?
  assignedTo  String?   // userId
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  opportunities Opportunity[]
  activities    Activity[]

  @@index([tenantId])
}

model Opportunity {
  id                String    @id @default(cuid())
  tenantId          String
  leadId            String?
  customerId        String?
  name              String
  value             Float     @default(0)
  probability       Int       @default(50)   // 0-100 %
  expectedCloseDate DateTime?
  stage             String    @default("PROSPECTING")
  // PROSPECTING | QUALIFICATION | PROPOSAL | NEGOTIATION | WON | LOST
  lostReason        String?
  assignedTo        String?
  createdBy         String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  lead       Lead?      @relation(fields: [leadId], references: [id])
  quotes     Quote[]
  activities Activity[]

  @@index([tenantId])
}

model Activity {
  id            String   @id @default(cuid())
  tenantId      String
  type          String   // CALL | EMAIL | MEETING | NOTE | DEMO | FOLLOW_UP
  subject       String
  description   String?
  outcome       String?
  dueDate       DateTime?
  completedAt   DateTime?
  status        String   @default("PLANNED")   // PLANNED | DONE | CANCELLED
  leadId        String?
  opportunityId String?
  customerId    String?
  assignedTo    String
  createdBy     String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  lead        Lead?        @relation(fields: [leadId], references: [id])
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([tenantId])
}

// ---- Quotes -----------------------------------------------------------------

model Quote {
  id            String   @id @default(cuid())
  tenantId      String
  quoteNumber   String
  opportunityId String?
  customerId    String
  userId        String
  validUntil    DateTime
  status        String   @default("DRAFT")
  // DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED
  subtotal      Float
  discountTotal Float    @default(0)
  tax           Float    @default(0)
  total         Float
  notes         String?
  terms         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
  customer    Customer     @relation(fields: [customerId], references: [id])
  items       QuoteItem[]
  order       SalesOrder?

  @@unique([tenantId, quoteNumber])
  @@index([tenantId])
}

model QuoteItem {
  id          String  @id @default(cuid())
  quoteId     String
  productId   String
  variantId   String?
  productName String
  quantity    Float
  unitPrice   Float
  discount    Float   @default(0)   // percentage
  taxCodeId   String?              // accounting tax code id (external ref)
  taxAmount   Float   @default(0)
  total       Float

  quote Quote @relation(fields: [quoteId], references: [id], onDelete: Cascade)
}

// ---- Discount Rules ---------------------------------------------------------

model DiscountRule {
  id               String    @id @default(cuid())
  tenantId         String
  name             String
  type             String    // PERCENTAGE | FLAT_AMOUNT
  trigger          String    // CUSTOMER_GROUP | VOLUME | PROMO_CODE | MANUAL
  value            Float
  minQuantity      Float?
  minOrderValue    Float?
  customerGroup    String?
  promoCode        String?
  productId        String?
  categoryId       String?
  requiresApproval Boolean   @default(false)
  approvalThreshold Float?   // discount % above which approval is required
  validFrom        DateTime?
  validTo          DateTime?
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId])
}

// ---- Customers & Orders -----------------------------------------------------

model Customer {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  email         String?
  phone         String?
  address       String?
  city          String?
  country       String?
  taxId         String?
  customerGroup String?
  creditLimit   Float    @default(0)   // 0 = no limit
  paymentTerms  Int      @default(30)  // days net -- used to calc invoice.dueDate
  priceListId   String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  quotes  Quote[]
  orders  SalesOrder[]

  @@index([tenantId])
}

model SalesOrder {
  id            String   @id @default(cuid())
  tenantId      String
  orderNumber   String
  quoteId       String?  @unique
  customerId    String
  userId        String
  date          DateTime
  status        String   @default("DRAFT")
  // DRAFT | CONFIRMED | PARTIALLY_SHIPPED | SHIPPED | INVOICED | CANCELLED
  subtotal      Float
  discountTotal Float    @default(0)
  tax           Float    @default(0)
  total         Float
  notes         String?
  invoiceId     String?  // accounting AR invoice id (external ref)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  quote    Quote?           @relation(fields: [quoteId], references: [id])
  customer Customer         @relation(fields: [customerId], references: [id])
  items    SalesOrderItem[]
  returns  SalesReturn[]

  @@unique([tenantId, orderNumber])
  @@index([tenantId])
  @@index([customerId])
}

model SalesOrderItem {
  id           String  @id @default(cuid())
  salesOrderId String
  productId    String
  variantId    String?
  productName  String
  quantity     Float
  shippedQty   Float   @default(0)  // tracks partial shipments
  unitPrice    Float
  discount     Float   @default(0)
  taxCodeId    String?
  taxAmount    Float   @default(0)
  total        Float

  order SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
}

// ---- Sales Returns ----------------------------------------------------------

model SalesReturn {
  id           String   @id @default(cuid())
  tenantId     String
  returnNumber String
  orderId      String
  customerId   String
  reason       String?
  notes        String?
  status       String   @default("PENDING")
  // PENDING | APPROVED | REJECTED | RECEIVED | COMPLETED
  creditNoteId String?  // accounting credit note id (external ref)
  approvedBy   String?
  approvedAt   DateTime?
  receivedAt   DateTime?
  createdBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  order   SalesOrder        @relation(fields: [orderId], references: [id])
  items   SalesReturnItem[]

  @@unique([tenantId, returnNumber])
  @@index([tenantId])
  @@index([orderId])
}

model SalesReturnItem {
  id          String  @id @default(cuid())
  returnId    String
  productId   String
  variantId   String?
  productName String
  quantity    Float
  unitPrice   Float   // original sale price
  total       Float
  reason      String? // DAMAGED | WRONG_ITEM | NOT_NEEDED | DEFECTIVE | OTHER

  return SalesReturn @relation(fields: [returnId], references: [id], onDelete: Cascade)
}
```

---

### 6.3 Inventory Service

```prisma
// ---- Product Catalogue ------------------------------------------------------

model ProductCategory {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  parentId  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent   ProductCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
  children ProductCategory[] @relation("CategoryTree")
  products Product[]

  @@index([tenantId])
}

model Product {
  id           String   @id @default(cuid())
  tenantId     String
  categoryId   String?
  sku          String
  name         String
  description  String?
  unit         String   @default("pcs")
  costPrice    Float
  reorderLevel Int      @default(10)
  hasVariants  Boolean  @default(false)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  category  ProductCategory? @relation(fields: [categoryId], references: [id])
  variants  ProductVariant[]
  stocks    WarehouseStock[]
  movements StockMovement[]
  bomLines  BOMLine[]

  @@unique([tenantId, sku])
  @@index([tenantId])
}

model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  sku        String
  attributes Json     // { "color": "red", "size": "L" }
  costPrice  Float
  sellPrice  Float
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  product        Product         @relation(fields: [productId], references: [id])
  stocks         VariantStock[]
  priceListItems PriceListItem[]

  @@unique([productId, sku])
}

// ---- Price Lists ------------------------------------------------------------

model PriceList {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  currency  String    @default("USD")
  isDefault Boolean   @default(false)
  validFrom DateTime?
  validTo   DateTime?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  items PriceListItem[]

  @@index([tenantId])
}

model PriceListItem {
  id          String  @id @default(cuid())
  priceListId String
  productId   String?
  variantId   String?
  minQuantity Float   @default(1)
  price       Float

  priceList PriceList       @relation(fields: [priceListId], references: [id], onDelete: Cascade)
  variant   ProductVariant? @relation(fields: [variantId], references: [id])

  @@index([priceListId])
}

// ---- Warehouses & Stock -----------------------------------------------------

model Warehouse {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  location  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  stocks        WarehouseStock[]
  variantStocks VariantStock[]
  movements     StockMovement[]

  @@index([tenantId])
}

model WarehouseStock {
  id          String   @id @default(cuid())
  tenantId    String
  productId   String
  warehouseId String
  quantity    Int      @default(0)
  reservedQty Int      @default(0)
  updatedAt   DateTime @updatedAt

  product   Product   @relation(fields: [productId], references: [id])
  warehouse Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([productId, warehouseId])
  @@index([tenantId])
}

model VariantStock {
  id          String    @id @default(cuid())
  tenantId    String
  variantId   String
  warehouseId String
  quantity    Int       @default(0)
  reservedQty Int       @default(0)
  batchNumber String?
  expiryDate  DateTime?
  updatedAt   DateTime  @updatedAt

  variant   ProductVariant @relation(fields: [variantId], references: [id])
  warehouse Warehouse      @relation(fields: [warehouseId], references: [id])

  @@unique([variantId, warehouseId])
  @@index([tenantId])
}

model StockMovement {
  id          String   @id @default(cuid())
  tenantId    String
  productId   String
  variantId   String?
  warehouseId String
  type        String
  // IN | OUT | TRANSFER | ADJUSTMENT | RESERVE | RELEASE | FULFIL | RECEIPT | RETURN_IN | RETURN_OUT
  quantity    Int
  reference   String?
  sourceRef   String?
  notes       String?
  createdBy   String?
  createdAt   DateTime @default(now())

  product   Product   @relation(fields: [productId], references: [id])
  warehouse Warehouse @relation(fields: [warehouseId], references: [id])

  @@index([tenantId])
  @@index([productId])
}

model StockReservation {
  id          String   @id @default(cuid())
  tenantId    String
  orderId     String
  productId   String
  variantId   String?
  warehouseId String
  quantity    Int
  status      String   @default("RESERVED")   // RESERVED | RELEASED | FULFILLED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([orderId])
}

// ---- Bill of Materials ------------------------------------------------------

model BOM {
  id        String   @id @default(cuid())
  tenantId  String
  productId String
  name      String
  version   String   @default("1.0")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lines BOMLine[]

  @@index([tenantId])
}

model BOMLine {
  id          String @id @default(cuid())
  bomId       String
  componentId String
  quantity    Float
  unit        String @default("pcs")

  bom       BOM     @relation(fields: [bomId], references: [id], onDelete: Cascade)
  component Product @relation(fields: [componentId], references: [id])
}
```

---

### 6.4 Accounting Service

```prisma
// ---- Chart of Accounts ------------------------------------------------------

model ChartOfAccount {
  id        String   @id @default(cuid())
  tenantId  String
  code      String
  name      String
  type      String   // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
  subtype   String?  // BANK | RECEIVABLE | PAYABLE | INVENTORY | COGS | etc.
  parentId  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent   ChartOfAccount?   @relation("Hierarchy", fields: [parentId], references: [id])
  children ChartOfAccount[]  @relation("Hierarchy")
  lines    JournalEntryLine[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

// ---- Journals ---------------------------------------------------------------

model JournalEntry {
  id          String   @id @default(cuid())
  tenantId    String
  date        DateTime
  reference   String?
  description String?
  sourceType  String?  // SALES_ORDER | PURCHASE_ORDER | PAYROLL | SALES_RETURN | PURCHASE_RETURN | MANUAL
  sourceId    String?
  isPosted    Boolean  @default(false)
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  lines JournalEntryLine[]

  @@index([tenantId])
}

model JournalEntryLine {
  id             String  @id @default(cuid())
  journalEntryId String
  accountId      String
  debit          Float   @default(0)
  credit         Float   @default(0)
  description    String?
  currency       String  @default("USD")
  exchangeRate   Float   @default(1)

  entry   JournalEntry   @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account ChartOfAccount @relation(fields: [accountId], references: [id])
}

// ---- Invoices & Payments ----------------------------------------------------

model Invoice {
  id            String   @id @default(cuid())
  tenantId      String
  number        String
  type          String   // RECEIVABLE | PAYABLE
  entityId      String?  // customerId or vendorId
  entityName    String?
  date          DateTime
  dueDate       DateTime // = date + customer.paymentTerms days
  currency      String   @default("USD")
  exchangeRate  Float    @default(1)
  subtotal      Float
  discountTotal Float    @default(0)
  tax           Float    @default(0)
  total         Float
  totalBase     Float    // total in base currency
  status        String   @default("DRAFT")
  // DRAFT | SENT | PARTIAL | PAID | OVERDUE | VOID
  sourceType    String?
  sourceId      String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  lines       InvoiceLine[]
  payments    Payment[]
  taxLines    TaxLine[]
  creditNotes CreditNote[]
  debitNotes  DebitNote[]

  @@unique([tenantId, number])
  @@index([tenantId])
  @@index([type, status])
}

model InvoiceLine {
  id          String  @id @default(cuid())
  invoiceId   String
  description String
  quantity    Float
  unitPrice   Float
  discount    Float   @default(0)
  taxCodeId   String?
  taxAmount   Float   @default(0)
  total       Float
  accountId   String? // CoA account for journal (e.g. Revenue, COGS, Expense)

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
}

model Payment {
  id             String   @id @default(cuid())
  tenantId       String
  invoiceId      String
  amount         Float
  currency       String   @default("USD")
  exchangeRate   Float    @default(1)
  amountBase     Float    // in base currency
  method         String   // CASH | BANK_TRANSFER | CHEQUE | CARD
  bankAccountId  String?  // from BankAccount model
  reference      String?
  date           DateTime
  journalEntryId String?
  createdAt      DateTime @default(now())

  invoice Invoice @relation(fields: [invoiceId], references: [id])

  @@index([tenantId])
}

// ---- Credit Notes (Sales Returns / Price Adjustments) -----------------------

model CreditNote {
  id             String   @id @default(cuid())
  tenantId       String
  number         String
  type           String   @default("SALES_RETURN")   // SALES_RETURN | PRICE_ADJUSTMENT | GOODWILL
  invoiceId      String?  // original invoice this credits
  entityId       String?  // customerId
  entityName     String?
  date           DateTime
  currency       String   @default("USD")
  exchangeRate   Float    @default(1)
  subtotal       Float
  tax            Float    @default(0)
  total          Float
  totalBase      Float
  status         String   @default("DRAFT")
  // DRAFT | ISSUED | APPLIED | REFUNDED | VOID
  sourceType     String?  // "SALES_RETURN"
  sourceId       String?  // salesReturnId
  notes          String?
  journalEntryId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  lines   CreditNoteLine[]
  invoice Invoice?         @relation(fields: [invoiceId], references: [id])

  @@unique([tenantId, number])
  @@index([tenantId])
}

model CreditNoteLine {
  id           String  @id @default(cuid())
  creditNoteId String
  description  String
  quantity     Float
  unitPrice    Float
  total        Float
  accountId    String? // CoA account (e.g. Sales Returns & Allowances)

  creditNote CreditNote @relation(fields: [creditNoteId], references: [id], onDelete: Cascade)
}

// ---- Debit Notes (Purchase Returns) -----------------------------------------

model DebitNote {
  id             String   @id @default(cuid())
  tenantId       String
  number         String
  invoiceId      String?  // original AP invoice
  entityId       String?  // vendorId
  entityName     String?
  date           DateTime
  currency       String   @default("USD")
  exchangeRate   Float    @default(1)
  subtotal       Float
  tax            Float    @default(0)
  total          Float
  totalBase      Float
  status         String   @default("DRAFT")
  // DRAFT | ISSUED | APPLIED | REFUNDED | VOID
  sourceType     String?  // "PURCHASE_RETURN"
  sourceId       String?  // purchaseReturnId
  notes          String?
  journalEntryId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  lines   DebitNoteLine[]
  invoice Invoice?        @relation(fields: [invoiceId], references: [id])

  @@unique([tenantId, number])
  @@index([tenantId])
}

model DebitNoteLine {
  id          String  @id @default(cuid())
  debitNoteId String
  description String
  quantity    Float
  unitPrice   Float
  total       Float
  accountId   String?

  debitNote DebitNote @relation(fields: [debitNoteId], references: [id], onDelete: Cascade)
}

// ---- Tax --------------------------------------------------------------------

model TaxCode {
  id        String   @id @default(cuid())
  tenantId  String
  name      String   // "GST 18%", "VAT 20%", "Zero-rated"
  code      String
  rate      Float    // e.g. 0.18 for 18%
  type      String   // INCLUSIVE | EXCLUSIVE
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  taxLines TaxLine[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

model TaxLine {
  id            String @id @default(cuid())
  invoiceId     String
  taxCodeId     String
  taxableAmount Float
  taxAmount     Float

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  taxCode TaxCode @relation(fields: [taxCodeId], references: [id])
}

// ---- Multi-Currency ---------------------------------------------------------

model Currency {
  id        String   @id @default(cuid())
  tenantId  String
  code      String   // "USD", "EUR", "INR"
  name      String
  symbol    String
  isBase    Boolean  @default(false)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([tenantId, code])
  @@index([tenantId])
}

model ExchangeRate {
  id           String   @id @default(cuid())
  tenantId     String
  fromCurrency String
  toCurrency   String
  rate         Float
  date         DateTime @default(now())
  createdAt    DateTime @default(now())

  @@index([tenantId])
  @@index([date])
}

// ---- Bank Accounts ----------------------------------------------------------

model BankAccount {
  id             String   @id @default(cuid())
  tenantId       String
  name           String   // "HDFC Current A/C", "Petty Cash"
  type           String   // BANK | CASH | CREDIT_CARD
  accountNumber  String?
  bankName       String?
  currency       String   @default("USD")
  openingBalance Float    @default(0)
  isActive       Boolean  @default(true)
  accountId      String?  // linked ChartOfAccount id
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId])
}

// ---- Fixed Assets -----------------------------------------------------------

model FixedAsset {
  id                    String   @id @default(cuid())
  tenantId              String
  name                  String
  category              String   // LAND | BUILDING | MACHINERY | VEHICLE | COMPUTER | FURNITURE
  purchaseDate          DateTime
  cost                  Float
  salvageValue          Float    @default(0)
  usefulLifeMonths      Int
  depreciationMethod    String   @default("STRAIGHT_LINE")   // STRAIGHT_LINE | DECLINING_BALANCE
  accountId             String?
  depreciationAccountId String?
  status                String   @default("ACTIVE")   // ACTIVE | DISPOSED | SOLD
  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  depreciations AssetDepreciation[]

  @@index([tenantId])
}

model AssetDepreciation {
  id             String   @id @default(cuid())
  tenantId       String
  assetId        String
  period         String   // "2026-05"
  amount         Float
  bookValue      Float
  journalEntryId String?
  createdAt      DateTime @default(now())

  asset FixedAsset @relation(fields: [assetId], references: [id])

  @@unique([assetId, period])
  @@index([tenantId])
}
```

---

### 6.5 HR Service

```prisma
// ---- Pay Structure ----------------------------------------------------------

model PayGrade {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  minSalary Float
  maxSalary Float
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employees Employee[]

  @@index([tenantId])
}

model SalaryComponent {
  id                String   @id @default(cuid())
  tenantId          String
  name              String   // "Basic", "HRA", "Transport", "PF", "TDS"
  type              String   // EARNING | DEDUCTION
  calculationMethod String   // FIXED | PERCENTAGE_OF_BASIC | PERCENTAGE_OF_GROSS
  value             Float
  isStatutory       Boolean  @default(false)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId])
}

// ---- Tax Slabs (for payroll TDS calculation) ---------------------------------

model TaxSlab {
  id         String   @id @default(cuid())
  tenantId   String
  name       String   // "FY 2026-27 India"
  country    String   @default("IN")
  fiscalYear String   // "2026-27"
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  bands TaxSlabBand[]

  @@index([tenantId])
}

model TaxSlabBand {
  id         String  @id @default(cuid())
  taxSlabId  String
  fromAmount Float
  toAmount   Float?  // null = top band (unlimited)
  rate       Float   // e.g. 0.10 for 10%

  taxSlab TaxSlab @relation(fields: [taxSlabId], references: [id], onDelete: Cascade)
}

// ---- Employees --------------------------------------------------------------

model Employee {
  id                String    @id @default(cuid())
  tenantId          String
  employeeId        String
  firstName         String
  lastName          String
  email             String
  phone             String?
  department        String
  position          String
  payGradeId        String?
  hireDate          DateTime
  salary            Float
  isActive          Boolean   @default(true)
  terminatedAt      DateTime?
  terminationReason String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  payGrade        PayGrade?        @relation(fields: [payGradeId], references: [id])
  salaryRevisions SalaryRevision[]
  payrollRecords  PayrollRecord[]
  leaveRequests   LeaveRequest[]
  leaveBalances   LeaveBalance[]

  @@unique([tenantId, employeeId])
  @@unique([tenantId, email])
  @@index([tenantId])
}

model SalaryRevision {
  id            String   @id @default(cuid())
  tenantId      String
  employeeId    String
  effectiveDate DateTime
  oldSalary     Float
  newSalary     Float
  reason        String?
  approvedBy    String?
  createdAt     DateTime @default(now())

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([tenantId])
}

// ---- Payroll ----------------------------------------------------------------

model PayrollRun {
  id             String    @id @default(cuid())
  tenantId       String
  period         String    // "2026-05"
  status         String    @default("DRAFT")   // DRAFT | PROCESSED | PAID
  totalGross     Float     @default(0)
  totalTax       Float     @default(0)
  totalNet       Float     @default(0)
  journalEntryId String?
  processedAt    DateTime?
  paidAt         DateTime?
  createdBy      String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  records PayrollRecord[]

  @@unique([tenantId, period])
  @@index([tenantId])
}

model PayrollRecord {
  id              String   @id @default(cuid())
  tenantId        String
  payrollRunId    String
  employeeId      String
  basicSalary     Float
  grossSalary     Float
  totalEarnings   Float
  totalDeductions Float
  taxAmount       Float    @default(0)
  netPay          Float
  status          String   @default("DRAFT")
  createdAt       DateTime @default(now())

  payrollRun PayrollRun    @relation(fields: [payrollRunId], references: [id])
  employee   Employee      @relation(fields: [employeeId], references: [id])
  lines      PayslipLine[]

  @@unique([payrollRunId, employeeId])
  @@index([tenantId])
}

model PayslipLine {
  id              String @id @default(cuid())
  payrollRecordId String
  componentName   String
  type            String  // EARNING | DEDUCTION
  amount          Float

  record PayrollRecord @relation(fields: [payrollRecordId], references: [id], onDelete: Cascade)
}

// ---- Leave ------------------------------------------------------------------

model LeavePolicy {
  id           String   @id @default(cuid())
  tenantId     String
  leaveType    String   // ANNUAL | SICK | PERSONAL | MATERNITY | PATERNITY | UNPAID
  daysAllowed  Int
  carryForward Int      @default(0)
  encashable   Boolean  @default(false)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([tenantId, leaveType])
  @@index([tenantId])
}

model LeaveBalance {
  id         String @id @default(cuid())
  tenantId   String
  employeeId String
  year       Int
  leaveType  String
  allocated  Float
  used       Float  @default(0)
  balance    Float

  employee Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, year, leaveType])
  @@index([tenantId])
}

model LeaveRequest {
  id         String   @id @default(cuid())
  tenantId   String
  employeeId String
  type       String
  startDate  DateTime
  endDate    DateTime
  days       Float
  reason     String?
  status     String   @default("PENDING")   // PENDING | APPROVED | REJECTED
  approvedBy String?
  approvedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([tenantId])
}
```

---

### 6.6 Procurement Service

```prisma
model Vendor {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  email        String?
  phone        String?
  address      String?
  city         String?
  country      String?
  taxId        String?
  paymentTerms Int      @default(30)
  currency     String   @default("USD")
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  orders  PurchaseOrder[]
  returns PurchaseReturn[]

  @@index([tenantId])
}

model PurchaseOrder {
  id            String   @id @default(cuid())
  tenantId      String
  orderNumber   String
  vendorId      String
  userId        String
  date          DateTime
  expectedDate  DateTime?
  status        String   @default("DRAFT")
  // DRAFT | SUBMITTED | APPROVED | PARTIALLY_RECEIVED | RECEIVED | CANCELLED
  subtotal      Float
  discountTotal Float    @default(0)
  tax           Float    @default(0)
  total         Float
  notes         String?
  approvedBy    String?
  approvedAt    DateTime?
  invoiceId     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  vendor  Vendor              @relation(fields: [vendorId], references: [id])
  items   PurchaseOrderItem[]
  returns PurchaseReturn[]

  @@unique([tenantId, orderNumber])
  @@index([tenantId])
}

model PurchaseOrderItem {
  id              String @id @default(cuid())
  purchaseOrderId String
  productId       String
  variantId       String?
  productName     String
  quantity        Float
  receivedQty     Float  @default(0)
  unitPrice       Float
  total           Float

  order PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
}

// ---- Purchase Returns -------------------------------------------------------

model PurchaseReturn {
  id              String   @id @default(cuid())
  tenantId        String
  returnNumber    String
  purchaseOrderId String
  vendorId        String
  reason          String?
  notes           String?
  status          String   @default("PENDING")
  // PENDING | APPROVED | REJECTED | DISPATCHED | COMPLETED
  debitNoteId     String?  // accounting debit note id (external ref)
  approvedBy      String?
  approvedAt      DateTime?
  dispatchedAt    DateTime?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  purchaseOrder PurchaseOrder       @relation(fields: [purchaseOrderId], references: [id])
  vendor        Vendor              @relation(fields: [vendorId], references: [id])
  items         PurchaseReturnItem[]

  @@unique([tenantId, returnNumber])
  @@index([tenantId])
  @@index([purchaseOrderId])
}

model PurchaseReturnItem {
  id          String  @id @default(cuid())
  returnId    String
  productId   String
  variantId   String?
  productName String
  quantity    Float
  unitPrice   Float
  total       Float
  reason      String? // DAMAGED | WRONG_ITEM | OVER_SUPPLY | DEFECTIVE | OTHER

  return PurchaseReturn @relation(fields: [returnId], references: [id], onDelete: Cascade)
}
```

---

## 7. Use Case Designs

### UC1 — Tenant Onboarding & Setup

**Status:** Partial | **Service:** gateway

**Full Flow:**
```
1.  POST /api/auth?action=register         Create user account
2.  POST /api/auth                         Login -> { accessToken, refreshToken }
3.  POST /api/tenants                      Create tenant -> creator = ADMIN
4.  POST /api/tenants/:id/settings         Set currency, timezone, fiscal year start
5.  POST /api/modules { moduleId:"sales" } Purchase Sales license
6.  POST /api/modules { moduleId:"inventory" }
7.  POST /api/tenants/:id/invite           Invite teammate (email + role)
8.  GET  /api/invitations/:token/accept    Invited user clicks link -> joins tenant
9.  PUT  /api/tenants/:id/users/:uid/role  Change user role
10. DELETE /api/tenants/:id/users/:uid     Remove user

Auth maintenance:
11. POST /api/auth?action=refresh          Rotate access + refresh tokens
12. POST /api/auth?action=forgot-password  Send reset email
13. POST /api/auth?action=reset-password   Apply new password
14. POST /api/auth?action=switch-tenant    Switch active tenant -> new JWT
15. POST /api/auth?action=logout           Revoke refresh token
```

---

### UC2 — Lead to Cash (Full CRM + Fulfillment)

**Status:** Pending | **Services:** sales -> inventory -> accounting

#### Phase A — CRM Pipeline

```
1. POST /api/leads                         Log a new lead (SALES_REP)
2. PUT  /api/leads/:id                     Update status: NEW -> CONTACTED -> QUALIFIED
3. POST /api/activities                    Log a call/meeting against the lead
4. POST /api/opportunities                 Convert lead to opportunity
5. PUT  /api/opportunities/:id             Update stage, value, probability
6. POST /api/quotes                        Create quote from opportunity
   +-- Items pulled from Product Catalogue (inventory)
   +-- Prices from Price List (customer-specific or default)
   +-- Discounts applied from DiscountRules
7. POST /api/quotes/:id/send               status -> SENT
8. POST /api/quotes/:id/accept             status -> ACCEPTED
   +-- Auto-creates SalesOrder (status: DRAFT)
9. POST /api/quotes/:id/reject             status -> REJECTED
```

#### Phase B — Order Fulfillment State Machine

```
DRAFT --confirm--> CONFIRMED --ship--> PARTIALLY_SHIPPED --ship(remaining)--> SHIPPED
                                                                                   |
   \--cancel--> CANCELLED        \--cancel--> CANCELLED (release reservation)     +--> INVOICED
```

**Credit Limit Check (on confirm):**
```
POST /api/orders/:id/confirm
1. Fetch customer.creditLimit and customer.paymentTerms
2. If creditLimit > 0:
   openAR = SUM of unpaid/partial RECEIVABLE invoices for this customerId
   if openAR + order.total > creditLimit:
     return 409 { error: "Credit limit exceeded" }
3. Reserve stock (calls inventory)
4. order.status = CONFIRMED
```

**Confirm Order Sequence:**
```
Client             Sales                         Inventory
  |-POST /orders/:id/confirm->|
  |                            |-credit limit check (internal DB query)
  |                            |-POST /stock/reserve->|
  |                            |  { orderId, items }  |
  |                            |<-{ ok } / { error }--|
  |                            |  if error -> return 409
  |                            |-UPDATE order.status = CONFIRMED
  |<-{ data: order }----------|
```

**Partial Ship Sequence:**
```
POST /api/orders/:id/ship
Body: { items: [{ orderItemId, quantity, warehouseId }] }

For each item in body:
  1. Calls inventory POST /stock/deduct { productId, qty, warehouseId, orderId }
  2. UPDATE SalesOrderItem.shippedQty += quantity

After all items:
  allShipped = every item where shippedQty >= quantity
  anyShipped = some item where shippedQty > 0

  if allShipped:
    order.status = SHIPPED
    -> Calls accounting POST /invoices for full remaining balance
       invoice.dueDate = today + customer.paymentTerms
    order.status = INVOICED (after invoice created)
  elif anyShipped:
    order.status = PARTIALLY_SHIPPED
    -> Calls accounting POST /invoices for shipped items only (partial invoice)
```

**Ship Order Sequence:**
```
Client      Sales                       Inventory         Accounting
  |-POST /orders/:id/ship->|
  |                         |-POST /stock/deduct->|
  |                         |  { items }          |
  |                         |<-{ ok }-------------|
  |                         |-POST /invoices--------------------->|
  |                         |  { type:RECEIVABLE, lines,        |
  |                         |    dueDate, taxCodeIds }          |
  |                         |<-{ data: invoice }----------------|
  |                         |-UPDATE order.status
  |<-{ data: order }--------|
```

**Cancel Order (with compensation):**
```
POST /api/orders/:id/cancel
  if order.status == CONFIRMED or PARTIALLY_SHIPPED:
    -> Calls inventory POST /stock/release { orderId } (releases all reservations)
  order.status = CANCELLED
```

#### Phase C — AR Collection & Partial Payment

```
10. GET  /api/invoices?type=RECEIVABLE     View open AR invoices
11. POST /api/invoices/:id/payments        Record customer payment
    Body: { amount, method, bankAccountId, reference, date }
    
    Logic:
    const totalPaid = SUM of existing payments for invoiceId
    const newTotal = totalPaid + payment.amount
    
    if newTotal >= invoice.total:
      invoice.status = "PAID"
    else:
      invoice.status = "PARTIAL"
    
    -> Auto-posts journal:
       DR  Bank Account (bankAccountId)
       CR  Accounts Receivable
```

**Overdue Invoice Automation (background job):**
```
Daily job: SELECT invoices WHERE status IN ('SENT','PARTIAL') AND dueDate < NOW()
  -> UPDATE invoice.status = 'OVERDUE'
  -> POST notification to ACCOUNTANT users
```

#### Phase D — Discount Application Logic

```
1. Find all active DiscountRules for this tenant where:
   - trigger=CUSTOMER_GROUP and customer.customerGroup matches rule.customerGroup
   - trigger=VOLUME and item.quantity >= rule.minQuantity
   - trigger=PROMO_CODE and input promoCode matches rule.promoCode
   - trigger=MANUAL (user applies manually)
   - product/category filters match
2. Apply best applicable discount per line
3. If rule.requiresApproval AND discount.value > rule.approvalThreshold:
   -> Quote/Order requires MANAGER approval before sending
```

---

### UC3 — Procure to Pay

**Status:** Pending | **Services:** procurement -> inventory -> accounting

**State Machine:**
```
DRAFT --submit-> SUBMITTED --approve-> APPROVED --receive(partial)--> PARTIALLY_RECEIVED
      \                     \                    --receive(full)----> RECEIVED
       --cancel-> CANCELLED  --cancel-> CANCELLED
```

**Full Flow:**
```
1. POST /api/vendors
2. POST /api/purchase-orders
3. POST /api/purchase-orders/:id/submit    status -> SUBMITTED
4. POST /api/purchase-orders/:id/approve   MANAGER+ -> status APPROVED
5. POST /api/purchase-orders/:id/receive   Body: { items: [{ poItemId, qty, warehouseId }] }
   +-- For each item: poItem.receivedQty += qty
   +-- if all items fully received: po.status = RECEIVED
   +-- else: po.status = PARTIALLY_RECEIVED
   +-- Calls inventory POST /stock/receive-po { poId, items }
   +-- Calls accounting POST /invoices { type: PAYABLE, ... for received items only }
       invoice.dueDate = today + vendor.paymentTerms
6. POST /api/invoices/:id/payments         Pay vendor AP invoice
   +-- Same partial payment logic as AR
   +-- Auto-posts journal:
       DR  Accounts Payable
       CR  Bank Account
```

**Receive PO Sequence:**
```
Client     Procurement            Inventory           Accounting
  |-POST /po/:id/receive->|
  |                        |-POST /stock/receive-po->|
  |                        |  { poId, items }        |
  |                        |<-{ ok }-----------------|
  |                        |-POST /invoices----------------------->|
  |                        |  { type: PAYABLE, received items }  |
  |                        |<-{ data: invoice }------------------|
  |                        |-UPDATE po.status (PARTIALLY_RECEIVED or RECEIVED)
  |<-{ data: po }---------|
```

---

### UC4 — Hire to Payroll

**Status:** Pending | **Services:** hr -> accounting

**Full Flow:**
```
1.  POST /api/tax-slabs + POST /api/tax-slabs/:id/bands  Define TDS tax slab bands
2.  POST /api/pay-grades                    Define pay grades
3.  POST /api/salary-components             Define earnings/deductions
4.  POST /api/employees                     Onboard employee
5.  POST /api/leave-policies
6.  POST /api/leave                         Employee requests leave
7.  PUT  /api/leave/:id/approve             Manager approves/rejects
8.  POST /api/payroll/runs                  Create payroll run (status: DRAFT)
    +-- Auto-generates PayrollRecord per active employee
9.  GET  /api/payroll/runs/:id/preview      Preview payslips
10. POST /api/payroll/runs/:id/process      Lock + post journal:
    |   DR  Salary Expense (gross total)
    |   CR  Salaries Payable (net total)
    |   CR  PF Payable
    |   CR  TDS Payable
    +-- status -> PROCESSED
11. POST /api/payroll/runs/:id/pay          Mark paid:
    |   DR  Salaries Payable
    |   CR  Bank Account
    +-- status -> PAID
12. GET /api/payroll/runs/:id/payslips/:employeeId
```

**TDS Calculation Algorithm:**
```
function calculateTDS(annualGross: number, bands: TaxSlabBand[]): number {
  let tax = 0;
  const sorted = bands.sort((a, b) => a.fromAmount - b.fromAmount);
  for (const band of sorted) {
    if (annualGross <= band.fromAmount) break;
    const upper = band.toAmount ?? Infinity;
    const taxableInBand = Math.min(annualGross, upper) - band.fromAmount;
    tax += taxableInBand * band.rate;
  }
  return tax;
}

// Monthly TDS withheld:
const monthlyTDS = calculateTDS(employee.salary * 12, activeSlab.bands) / 12;
```

**Payroll Calculation Logic:**
```
For each active Employee:
  basic        = employee.salary * (BASIC component %)
  hra          = basic * (HRA component %)
  transport    = TRANSPORT component (fixed)
  grossSalary  = basic + hra + transport + other earnings

  pf           = basic * 0.12  (statutory, configurable via SalaryComponent)
  tds          = calculateTDS(grossSalary * 12, tenantActiveSlab.bands) / 12
  netPay       = grossSalary - pf - tds - other deductions
```

**Leave Year-End Carry-Forward (background job):**
```
On Jan 1 (or fiscal year start):
  For each employee, for each leaveType:
    carryOver = MIN(balance, policy.carryForward)
    new LeaveBalance { year: newYear, allocated: policy.daysAllowed + carryOver, used: 0 }
```

---

### UC5 — Inventory Management

**Status:** Partial | **Service:** inventory

**Full Flow:**
```
Setup:
1.  POST /api/categories
2.  POST /api/warehouses
3.  POST /api/price-lists
4.  POST /api/products
5.  POST /api/products/:id/variants
6.  POST /api/price-lists/:id/items    (set volume tiers)

Operations:
7.  POST /api/stock/receive            Opening stock / manual receipt
8.  POST /api/stock/adjustment         Physical count correction
9.  POST /api/stock/transfer           Between warehouses
10. GET  /api/stock/low                Products below reorderLevel
    +-- Reorder automation (background job): auto-create DRAFT PO in procurement
11. GET  /api/stock/movements          Full audit trail

Internal (service-to-service):
12. POST /api/stock/reserve            Sales: order confirmed
13. POST /api/stock/release            Sales: order cancelled
14. POST /api/stock/deduct             Sales: items shipped
15. POST /api/stock/receive-po         Procurement: goods received
16. POST /api/stock/receive-return     Sales: returned goods received
17. POST /api/stock/return-to-vendor   Procurement: goods sent back
```

**Stock Integrity Rules:**
```
Available = WarehouseStock.quantity - WarehouseStock.reservedQty
Reject if available < requested quantity (reserve or deduct)
On reserve:         reservedQty += qty
On release:         reservedQty -= qty
On deduct:          quantity -= qty, reservedQty -= qty
On receive:         quantity += qty
On receive-return:  quantity += qty  (RETURN_IN movement)
On return-to-vendor:quantity -= qty  (RETURN_OUT movement)
Quantity MUST NEVER go below 0
```

**Price Resolution Logic:**
```
1. If customer.priceListId -> use that price list
2. Else -> find tenant default price list (PriceList.isDefault = true)
3. Find PriceListItem where productId/variantId matches AND minQuantity <= orderedQty
   -> Pick item with highest qualifying minQuantity (volume tier)
4. Apply DiscountRule on top
Final = priceListPrice * (1 - discountPercent)
```

---

### UC6 — Financial Reporting

**Status:** Pending | **Service:** accounting

**Endpoints:**
```
GET /api/reports/trial-balance?from=&to=
GET /api/reports/pl?from=&to=
GET /api/reports/balance-sheet?asOf=
GET /api/reports/general-ledger?accountId=&from=&to=
GET /api/reports/ar-aging
GET /api/reports/ap-aging
GET /api/reports/tax-summary?from=&to=
GET /api/reports/cash-flow?from=&to=
```

**P&L:**
```
Revenue      = SUM(credit - debit) WHERE account.type = REVENUE
COGS         = SUM(debit - credit) WHERE account.subtype = COGS
Gross Profit = Revenue - COGS
Expenses     = SUM(debit - credit) WHERE account.type = EXPENSE (excl. COGS)
Net Income   = Gross Profit - Expenses
```

**Balance Sheet:**
```
Assets      = SUM(debit - credit) WHERE account.type = ASSET
Liabilities = SUM(credit - debit) WHERE account.type = LIABILITY
Equity      = SUM(credit - debit) WHERE account.type = EQUITY
Check: Assets == Liabilities + Equity
```

**AR Aging:**
```
For RECEIVABLE invoices where status in (SENT, PARTIAL, OVERDUE):
  daysOverdue = TODAY - dueDate
  Current (0) | 1-30 | 31-60 | 61-90 | 90+
```

**Partial Payment on AR/AP:**
```
When POST /api/invoices/:id/payments:
  totalPaid = SUM(payments.amount WHERE invoiceId)
  newTotal  = totalPaid + body.amount
  invoice.status = newTotal >= invoice.total ? "PAID" : "PARTIAL"
```

---

### UC7 — Product Catalogue & Pricing

**Status:** Pending | **Service:** inventory

(Flow detailed in UC5 setup steps above. Key design points:)

- Categories are hierarchical (parentId self-join)
- Products can have variants (color/size) or be sold as-is
- Each PriceList has items per product/variant with volume tiers (minQuantity)
- Default price list is used when no customer-specific list is assigned
- Price resolution: customer list -> default list -> variant.sellPrice fallback

---

### UC8 — Tax Management

**Status:** Pending | **Service:** accounting

```
1. POST /api/tax-codes          Create per-jurisdiction codes
   { name: "GST 18%", code: "GST18", rate: 0.18, type: "EXCLUSIVE" }
2. Tax code linked on QuoteItem / SalesOrderItem / InvoiceLine
3. When invoice created:
   -> TaxLine records inserted per taxCode used
   -> invoice.tax = SUM(taxLine.taxAmount)
4. GET /api/reports/tax-summary?from=&to=
   -> Group TaxLines by taxCode
   -> Total taxable + tax collected (RECEIVABLE) and tax paid (PAYABLE)
   -> Input for GST/VAT filing
```

---

### UC9 — Fixed Assets Management

**Status:** Pending | **Service:** accounting

```
1. POST /api/assets                        Register asset
   -> DR Asset Account  CR Bank/AP
2. POST /api/assets/depreciate?period=     Monthly depreciation run
   -> DR Depreciation Expense  CR Accumulated Depreciation
3. POST /api/assets/:id/dispose
   -> DR Accumulated Depreciation  DR/CR Gain/Loss  CR Asset Account
```

**Straight-Line:**
```
monthly = (cost - salvageValue) / usefulLifeMonths
bookValue = cost - (monthly * periodsElapsed)
```

---

### UC10 — Sales Return & Credit Note

**Status:** Pending | **Services:** sales -> inventory -> accounting

#### State Machine

```
SalesReturn:
  PENDING --approve--> APPROVED --receive--> COMPLETED
          --reject---> REJECTED

CreditNote:
  DRAFT --issue--> ISSUED --apply--> APPLIED
                         --refund--> REFUNDED
                  --void--> VOID
```

#### Full Flow

```
1. POST /api/orders/:id/returns
   Body: { items: [{ orderItemId, quantity, reason }], reason, notes }
   Validations:
   - order must be in SHIPPED | INVOICED | PARTIALLY_SHIPPED
   - returnQty <= (item.shippedQty - already returned qty)
   -> Creates SalesReturn (status: PENDING)
   -> Creates SalesReturnItem per line
   -> Sends notification to MANAGER for approval

2. POST /api/returns/:id/approve     MANAGER only
   -> SalesReturn.status = APPROVED
   -> Notifies SALES_REP

   POST /api/returns/:id/reject      MANAGER only
   Body: { reason }
   -> SalesReturn.status = REJECTED

3. POST /api/returns/:id/receive     SALES_REP or MANAGER
   Validations:
   - return.status must be APPROVED
   Body: { warehouseId }
   
   Step 1: Call inventory POST /stock/receive-return
     Body: { returnId, warehouseId, items: [{ productId, variantId, quantity }] }
     -> StockMovement type=RETURN_IN per item
     -> WarehouseStock.quantity += returnedQty
   
   Step 2 (if step 1 ok): Call accounting POST /credit-notes
     Body: {
       invoiceId: order.invoiceId,
       entityId: order.customerId,
       entityName: customer.name,
       sourceType: "SALES_RETURN",
       sourceId: return.id,
       lines: returnItems.map(i => ({ description, quantity, unitPrice, accountId: revenueAccountId }))
     }
     -> CreditNote created (status: ISSUED)
     -> Auto-posts journal:
        DR  Sales Returns & Allowances (contra-revenue)
        CR  Accounts Receivable
        AND separately:
        DR  Inventory (restore cost)
        CR  Cost of Goods Sold
   
   If step 2 fails: compensate by reversing stock (POST /stock/adjustment -qty)
   
   -> SalesReturn.creditNoteId = creditNote.id
   -> SalesReturn.status = COMPLETED
   -> SalesReturn.receivedAt = now

4a. POST /api/credit-notes/:id/apply
    Body: { invoiceId }  (apply to a different or same open invoice)
    Validations:
    - creditNote.status must be ISSUED
    - target invoice must be RECEIVABLE and status != PAID | VOID
    
    applyAmount = MIN(creditNote.total, invoice.outstanding)
    -> Update invoice balance / status
    -> Post journal:
       DR  Accounts Receivable (credit note)
       CR  Accounts Receivable (target invoice)
    -> CreditNote.status = APPLIED (or PARTIAL if not fully used)

4b. POST /api/credit-notes/:id/refund
    Body: { bankAccountId, method }
    Validations:
    - creditNote.status must be ISSUED
    -> Post journal:
       DR  Accounts Receivable
       CR  Bank Account
    -> CreditNote.status = REFUNDED
```

#### Receive Return Sequence

```
Client    Sales                   Inventory                    Accounting
  |-POST /returns/:id/receive->|
  |                             |-POST /stock/receive-return->|
  |                             |  { returnId, items }        |
  |                             |<-{ ok }---------------------|
  |                             |-POST /credit-notes---------------------------->|
  |                             |  { invoiceId, entityId, lines, sourceId }    |
  |                             |<-{ data: creditNote }------------------------|
  |                             |-UPDATE return.status = COMPLETED
  |<-{ data: return }-----------|
  
  If credit-note call fails:
  |                             |-POST /stock/adjustment (compensate -qty)---->|
  |                             |<-{ ok }-------------------------------------- |
  |<-{ error: 500 }-------------|
```

---

### UC11 — Purchase Return & Debit Note

**Status:** Pending | **Services:** procurement -> inventory -> accounting

#### State Machine

```
PurchaseReturn:
  PENDING --approve--> APPROVED --dispatch--> DISPATCHED --complete--> COMPLETED
          --reject---> REJECTED

DebitNote:
  DRAFT --issue--> ISSUED --apply--> APPLIED
                          --refund--> REFUNDED
```

#### Full Flow

```
1. POST /api/purchase-orders/:id/returns
   Body: { items: [{ poItemId, quantity, reason }], reason, notes }
   Validations:
   - PO must be PARTIALLY_RECEIVED or RECEIVED
   - returnQty <= item.receivedQty
   -> Creates PurchaseReturn (status: PENDING)
   -> Sends notification to MANAGER

2. POST /api/purchase-returns/:id/approve   MANAGER only
   -> PurchaseReturn.status = APPROVED

   POST /api/purchase-returns/:id/reject
   -> PurchaseReturn.status = REJECTED

3. POST /api/purchase-returns/:id/dispatch
   Validations: status must be APPROVED
   Body: { warehouseId, dispatchRef }
   
   Step 1: Call inventory POST /stock/return-to-vendor
     Body: { returnId, warehouseId, items: [{ productId, variantId, quantity }] }
     -> StockMovement type=RETURN_OUT per item
     -> WarehouseStock.quantity -= qty
   
   Step 2: Call accounting POST /debit-notes
     Body: {
       invoiceId: po.invoiceId,  // original AP invoice
       entityId: po.vendorId,
       entityName: vendor.name,
       sourceType: "PURCHASE_RETURN",
       sourceId: return.id,
       lines: returnItems.map(i => ({ description, quantity, unitPrice }))
     }
     -> DebitNote created (status: ISSUED)
     -> Auto-posts journal:
        DR  Accounts Payable
        CR  Purchase Returns & Allowances
        AND:
        DR  Cost of Goods Sold (reverse inventory restore)
        CR  Inventory
   
   -> PurchaseReturn.debitNoteId = debitNote.id
   -> PurchaseReturn.status = DISPATCHED

4a. POST /api/debit-notes/:id/apply
    Body: { invoiceId }  (apply against open AP invoice)
    -> Reduces AP balance

4b. POST /api/debit-notes/:id/refund
    Body: { bankAccountId }
    -> DR Bank Account  CR Accounts Payable
    -> DebitNote.status = REFUNDED
```

---

## 8. API Reference

### Standard Headers

| Header          | Direction          | Description                         |
|-----------------|--------------------|-------------------------------------|
| `Authorization` | Client -> Service  | `Bearer <accessToken>`              |
| `x-tenant-id`   | Middleware injects | Active tenant (never from body)     |
| `x-user-id`     | Middleware injects | Authenticated user                  |
| `x-user-role`   | Middleware injects | Role within tenant                  |
| `x-service-key` | Service -> Service | Shared `SERVICE_SECRET`             |

### Response Envelopes

```ts
{ data: T[], meta: { page: number, limit: number, total: number, pages: number } }
{ data: T }
{ error: string }
```

### Gateway (3000)

```
POST   /api/auth?action=register
POST   /api/auth                              login
POST   /api/auth?action=refresh
POST   /api/auth?action=logout
POST   /api/auth?action=forgot-password
POST   /api/auth?action=reset-password
POST   /api/auth?action=switch-tenant
GET    /api/tenants/me                        current user's tenant list
GET    /api/tenants
POST   /api/tenants
POST   /api/tenants/:id/settings
POST   /api/tenants/:id/invite
GET    /api/invitations/:token/accept
PUT    /api/tenants/:id/users/:uid/role
DELETE /api/tenants/:id/users/:uid
GET    /api/modules
POST   /api/modules
GET    /api/notifications
PUT    /api/notifications/:id/read
GET    /api/health
```

### Sales (3001)

```
GET/POST          /api/leads
GET/PUT           /api/leads/:id
GET/POST          /api/activities
GET/PUT           /api/activities/:id
GET/POST          /api/opportunities
GET/PUT           /api/opportunities/:id
GET/POST          /api/quotes
GET/PUT           /api/quotes/:id
POST              /api/quotes/:id/send
POST              /api/quotes/:id/accept
POST              /api/quotes/:id/reject
GET/POST          /api/customers
GET/PUT/DELETE    /api/customers/:id
GET/POST          /api/orders
GET               /api/orders/:id
POST              /api/orders/:id/confirm
POST              /api/orders/:id/ship
POST              /api/orders/:id/cancel
POST              /api/orders/:id/returns
GET               /api/returns
GET               /api/returns/:id
POST              /api/returns/:id/approve
POST              /api/returns/:id/reject
POST              /api/returns/:id/receive
GET/POST          /api/discount-rules
GET/PUT/DELETE    /api/discount-rules/:id
```

### Inventory (3002)

```
GET/POST          /api/categories
GET/PUT/DELETE    /api/categories/:id
GET/POST          /api/products
GET/PUT/DELETE    /api/products/:id
GET/POST          /api/products/:id/variants
GET/PUT           /api/products/:id/variants/:vid
GET/POST          /api/price-lists
GET/PUT           /api/price-lists/:id
POST              /api/price-lists/:id/items
PUT/DELETE        /api/price-lists/:id/items/:itemId
GET/POST          /api/warehouses
GET/PUT           /api/warehouses/:id
GET               /api/stock
POST              /api/stock/receive
POST              /api/stock/adjustment
POST              /api/stock/transfer
GET               /api/stock/movements
GET               /api/stock/low
POST              /api/stock/reserve              internal
POST              /api/stock/release              internal
POST              /api/stock/deduct               internal
POST              /api/stock/receive-po           internal
POST              /api/stock/receive-return       internal
POST              /api/stock/return-to-vendor     internal
GET/POST          /api/bom
GET/PUT           /api/bom/:id
```

### Accounting (3003)

```
GET/POST          /api/accounts
GET/PUT           /api/accounts/:id
GET/POST          /api/journals
GET               /api/journals/:id
POST              /api/journals/:id/post
GET/POST          /api/invoices
GET/PUT           /api/invoices/:id
POST              /api/invoices/:id/payments
GET/POST          /api/credit-notes
GET               /api/credit-notes/:id
POST              /api/credit-notes/:id/apply
POST              /api/credit-notes/:id/refund
GET/POST          /api/debit-notes
GET               /api/debit-notes/:id
POST              /api/debit-notes/:id/apply
POST              /api/debit-notes/:id/refund
GET/POST          /api/tax-codes
GET/POST          /api/currencies
POST              /api/exchange-rates
GET/POST          /api/bank-accounts
GET/PUT           /api/bank-accounts/:id
GET/POST          /api/assets
GET               /api/assets/:id
POST              /api/assets/depreciate
POST              /api/assets/:id/dispose
GET               /api/reports/trial-balance
GET               /api/reports/pl
GET               /api/reports/balance-sheet
GET               /api/reports/general-ledger
GET               /api/reports/ar-aging
GET               /api/reports/ap-aging
GET               /api/reports/tax-summary
GET               /api/reports/cash-flow
```

### HR (3004)

```
GET/POST          /api/tax-slabs
GET               /api/tax-slabs/:id
POST              /api/tax-slabs/:id/bands
GET/POST          /api/pay-grades
GET/POST          /api/salary-components
GET/POST          /api/employees
GET/PUT/DELETE    /api/employees/:id
GET               /api/employees/:id/salary-history
GET               /api/employees/:id/leave-balance
POST              /api/employees/:id/terminate
GET/POST          /api/leave-policies
GET/POST          /api/leave
GET/PUT           /api/leave/:id
PUT               /api/leave/:id/approve
GET/POST          /api/payroll/runs
GET               /api/payroll/runs/:id
GET               /api/payroll/runs/:id/preview
POST              /api/payroll/runs/:id/process
POST              /api/payroll/runs/:id/pay
GET               /api/payroll/runs/:id/payslips/:employeeId
```

### Procurement (3005)

```
GET/POST          /api/vendors
GET/PUT/DELETE    /api/vendors/:id
GET/POST          /api/purchase-orders
GET               /api/purchase-orders/:id
POST              /api/purchase-orders/:id/submit
POST              /api/purchase-orders/:id/approve
POST              /api/purchase-orders/:id/receive
POST              /api/purchase-orders/:id/cancel
POST              /api/purchase-orders/:id/returns
GET               /api/purchase-returns
GET               /api/purchase-returns/:id
POST              /api/purchase-returns/:id/approve
POST              /api/purchase-returns/:id/reject
POST              /api/purchase-returns/:id/dispatch
```

---

## 9. Infrastructure & Deployment

### 9.1 Docker Compose (development)

```
postgres      :5432   Shared PG instance (separate DBs per service)
gateway       :3000
sales         :3001
inventory     :3002
accounting    :3003
hr            :3004
procurement   :3005
```

### 9.2 Database per Service

| Service     | Database        |
|-------------|-----------------|
| gateway     | erp_gateway     |
| sales       | erp_sales       |
| inventory   | erp_inventory   |
| accounting  | erp_accounting  |
| hr          | erp_hr          |
| procurement | erp_procurement |

### 9.3 Environment Variables

| Variable             | Required | Description                              |
|----------------------|----------|------------------------------------------|
| `DATABASE_URL`       | Yes      | PostgreSQL connection string             |
| `JWT_SECRET`         | Yes      | HS256 signing secret (min 32 bytes)      |
| `SERVICE_SECRET`     | Yes      | Inter-service shared secret              |
| `TAX_RATE`           | No       | Default tax rate fallback (0.10)         |
| `*_SERVICE_URL`      | No       | Override service base URLs               |

### 9.4 Production Notes

- Separate PostgreSQL instances per service
- Reverse proxy (nginx / Caddy) routing by subdomain
- Healthcheck at `/api/health` for load balancer
- All secrets from environment -- never in code

### 9.5 Background Jobs

The following scheduled jobs are required. Use a lightweight Node.js cron library (e.g., `node-cron`) or a dedicated job runner per service:

| Job                          | Service     | Schedule       | Action                                                   |
|------------------------------|-------------|----------------|----------------------------------------------------------|
| Overdue invoice detection    | accounting  | Daily 00:00    | Set OVERDUE on past-due invoices; send notification      |
| Quote expiry                 | sales       | Daily 00:00    | Set EXPIRED on quotes past validUntil                    |
| Low stock alert              | inventory   | Every 6h       | Notify MANAGER on products below reorderLevel            |
| Reorder auto-draft           | inventory   | Every 6h       | Create DRAFT PO in procurement for low-stock products    |
| Leave year-end carry-forward | hr          | Jan 1 / FY end | Reset LeaveBalance; carry forward per policy             |
| Payroll reminder             | hr          | Monthly -3 days| Notify HR_MANAGER payroll run not yet created            |
| Refresh token cleanup        | gateway     | Daily 02:00    | Delete expired/revoked RefreshToken records              |

### 9.6 Caching Strategy

Hot-read data that benefits from caching (Redis or in-memory LRU, 5-minute TTL):

- `PriceList` + `PriceListItem` -- read on every quote line
- `ExchangeRate` (latest per currency pair) -- read on every foreign invoice
- `TaxCode` list -- read on every invoice line
- `TaxSlab` + `TaxSlabBand` -- read on every payroll run
- `ModuleLicense` per tenant -- read on every request by middleware

Cache invalidation: clear on any write to these tables.

### 9.7 File Storage

PDF generation (invoices, payslips, POs) requires a file store:

- **Development:** local `/tmp` directory
- **Production:** S3-compatible blob storage (AWS S3 / Cloudflare R2 / MinIO)
- File naming: `{tenantId}/{resource}/{resourceId}/{type}.pdf`
- Signed URLs for temporary access (expiry: 15 min)
- Store file URL on the source record (e.g., `Invoice.pdfUrl`, `PayrollRecord.pdfUrl`)

---

## 10. Security Model

### 10.1 Per-Route Security Checklist

- [ ] `tenantId` read from `x-tenant-id` header only
- [ ] All DB queries `WHERE tenantId = ?` as first condition
- [ ] Zod validation on all request bodies
- [ ] `P2002` (unique constraint) returned as `409`
- [ ] Role checked for MANAGER/ADMIN-only operations
- [ ] No secrets or tokens logged
- [ ] Pagination applied on all list endpoints
- [ ] Credit limit checked before order confirmation

### 10.2 OWASP Top 10 Controls

| Risk                         | Control                                                      |
|------------------------------|--------------------------------------------------------------|
| A01 Broken Access Control    | tenantId from header; role checks on mutations; returns MANAGER+ |
| A02 Cryptographic Failures   | JWT HS256 + bcrypt(10); refresh tokens stored as SHA-256 hash |
| A03 Injection                | Prisma ORM -- all queries parameterized                      |
| A04 Insecure Design          | Service-to-service fail-closed; try-compensate pattern       |
| A05 Misconfiguration         | SERVICE_SECRET unset = all service calls rejected            |
| A07 Identification Failures  | No default credential fallback; password reset token 1h TTL  |
| A09 Logging Failures         | Never log JWT, SERVICE_SECRET, passwords, refresh tokens     |

### 10.3 Rate Limiting

Apply at the Gateway (Next.js middleware) using an in-memory sliding window:

| Endpoint group         | Limit           |
|------------------------|-----------------|
| `POST /api/auth`       | 10 req / min    |
| `POST /api/auth?action=forgot-password` | 3 req / 15 min per IP |
| All other API routes   | 200 req / min per tenant |

### 10.4 CORS Configuration

```ts
// next.config.ts
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",");
// Set Access-Control-Allow-Origin to exact match only -- no wildcards in production
```

---

## 11. Implementation Roadmap

### Phase 1 -- Foundation (done)
- All 6 service scaffolds + health checks
- Shared packages + JWT auth + createServiceMiddleware
- PostgreSQL schemas + pagination on all list endpoints
- Docker Compose + .env.example

### Phase 2 -- UC1: Tenant Onboarding
- [ ] RefreshToken + PasswordResetToken models in gateway
- [ ] Auth: refresh, logout, forgot-password, reset-password, switch-tenant
- [ ] Invitation model + POST /invite + GET /accept
- [ ] Role update + user removal
- [ ] Tenant settings endpoint

### Phase 3 -- UC7: Product Catalogue & Pricing
- [ ] ProductCategory + Product + ProductVariant CRUD
- [ ] PriceList + PriceListItem CRUD (with volume tiers)
- [ ] Price resolution logic
- [ ] BOM CRUD

### Phase 4 -- UC5: Inventory Operations
- [ ] Warehouse CRUD
- [ ] StockReservation model
- [ ] Internal endpoints: reserve / release / deduct / receive-po / receive-return / return-to-vendor
- [ ] Public endpoints: low / movements / transfer / adjustment

### Phase 5 -- UC2: Lead to Cash
- [ ] Lead + Opportunity + Activity CRUD
- [ ] Quote + QuoteItem CRUD (with taxCodeId on items)
- [ ] DiscountRule CRUD + application logic
- [ ] SalesOrder confirm (credit limit check + reserve)
- [ ] SalesOrder partial ship (shippedQty tracking)
- [ ] AR invoice with dueDate from paymentTerms
- [ ] Partial payment detection (PARTIAL / PAID status)
- [ ] Invoice overdue background job

### Phase 6 -- UC10: Sales Return & Credit Note
- [ ] SalesReturn + SalesReturnItem CRUD
- [ ] approve / reject / receive flow
- [ ] inventory receive-return internal endpoint
- [ ] CreditNote + CreditNoteLine in accounting
- [ ] credit-note apply + refund endpoints
- [ ] Try-compensate on receive failure

### Phase 7 -- UC3: Procure to Pay
- [ ] PO submit / approve / cancel
- [ ] Partial PO receive (PARTIALLY_RECEIVED status)
- [ ] AP invoice with dueDate from vendor.paymentTerms
- [ ] AP payment partial logic

### Phase 8 -- UC11: Purchase Return & Debit Note
- [ ] PurchaseReturn + PurchaseReturnItem CRUD
- [ ] approve / reject / dispatch flow
- [ ] inventory return-to-vendor internal endpoint
- [ ] DebitNote + DebitNoteLine in accounting
- [ ] debit-note apply + refund endpoints

### Phase 9 -- UC8: Tax Management
- [ ] TaxCode CRUD
- [ ] TaxLine on invoices + credit/debit notes
- [ ] GET /reports/tax-summary

### Phase 10 -- UC4: Hire to Payroll
- [ ] TaxSlab + TaxSlabBand CRUD
- [ ] PayGrade + SalaryComponent CRUD
- [ ] Employee onboard / terminate
- [ ] LeavePolicy + LeaveBalance + LeaveRequest flow
- [ ] PayrollRun + PayrollRecord + PayslipLine
- [ ] TDS calculation engine
- [ ] Process + Pay flow with accounting journals
- [ ] Leave year-end carry-forward job

### Phase 11 -- UC6: Financial Reporting
- [ ] Trial Balance
- [ ] P&L
- [ ] Balance Sheet
- [ ] General Ledger
- [ ] AR / AP Aging
- [ ] Cash Flow
- [ ] Tax Summary

### Phase 12 -- UC9: Fixed Assets + Multi-currency
- [ ] FixedAsset CRUD + acquisition journal
- [ ] Monthly depreciation run + journal
- [ ] Asset disposal journal
- [ ] Currency + ExchangeRate CRUD
- [ ] FX gain/loss on payments

### Phase 13 -- Cross-cutting Enhancements
- [ ] AuditLog (add to every service schema + middleware hook)
- [ ] Notification service (gateway) + in-app + email
- [ ] PDF generation (invoices, payslips, POs) + S3 storage
- [ ] Rate limiting in gateway middleware
- [ ] Background job runner (cron per service)
- [ ] Reorder automation (low stock -> draft PO)
- [ ] Configurable approval workflows
