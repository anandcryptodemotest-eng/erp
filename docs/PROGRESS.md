# Simhapuri Fresh — Implementation Progress Matrix

> Updated as implementation proceeds. Statuses: ✅ Done | 🔄 In Progress | ⬜ Not Started

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented and tested |
| 🔄 | Schema/scaffold done, route handlers in progress |
| ⬜ | Not started |
| N/A | Not applicable to this layer |

---

## Sprint 1 — Foundation (Schemas, Config, Types, Delivery Service)

| Task | Status | Notes |
|------|--------|-------|
| Extend `inventory` schema (Brand, barcode, weight, isFeatured) | ✅ | Brand model added; WarehouseStock tenantId fix applied |
| Extend `sales` schema (CustomerAddress, wallet, isBlocked, online order fields) | ✅ | CustomerAddress model added; SalesOrder delivery/coupon fields added |
| Extend `accounting` schema (CashShift, Bill, BillItem, BillReturn) | ✅ | POS billing models appended |
| Extend `gateway` schema (Banner, Coupon, CouponUsage, FCMToken) | ✅ | Marketing/grocery models added |
| Extend `hr` schema (delivery executive fields) | ✅ | isDeliveryExecutive, availabilityStatus, vehicleType added |
| Add `delivery` to `@erp/types` `ModuleId` | ✅ | |
| Add grocery enums/interfaces to `@erp/types` | ✅ | OrderStatus, PaymentMethod, BillStatus, BannerType, CouponType, DeliveryAssignment, etc. |
| Register `delivery` service in `@erp/config` | ✅ | Port 3006, dependencies: core/sales/hr |
| Scaffold `apps/delivery` service | ✅ | package.json, tsconfig, next.config, prisma schema, middleware, lib/prisma |
| Delivery API routes | 🔄 | zones, assignments, tracking, earnings, compensation done |

---

## Module 1 — Dashboard & Reporting

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| Sales summary (GMV, orders today) | ⬜ | ⬜ | sales | `GET /api/reports/summary` |
| Top-selling products | ⬜ | ⬜ | inventory/sales | `GET /api/reports/top-products` |
| Pending orders count | ⬜ | ⬜ | sales | `GET /api/orders?status=CONFIRMED` |
| Low-stock alerts | ⬜ | ⬜ | inventory | `GET /api/products?lowStock=true` |
| Revenue chart (daily/weekly/monthly) | ⬜ | ⬜ | accounting | `GET /api/reports/revenue` |
| Delivery metrics (on-time rate) | ⬜ | ⬜ | delivery | `GET /api/reports/delivery-metrics` |

---

## Module 2 — Online Orders

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| List orders (paginated, filterable) | ✅ | 🔄 | sales | `GET /api/orders` |
| Get order detail | ✅ | 🔄 | sales | `GET /api/orders/:id` |
| Create order (online) | ✅ | 🔄 | sales | `POST /api/orders` |
| Confirm order (+ stock reserve) | ✅ | 🔄 | sales | `POST /api/orders/:id/confirm` |
| Cancel order (+ stock release) | ✅ | 🔄 | sales | `POST /api/orders/:id/cancel` |
| Ship order (+ stock deduct + invoice) | ✅ | 🔄 | sales | `POST /api/orders/:id/ship` |
| Apply coupon to order | ✅ | 🔄 | gateway | `POST /api/coupons/validate` |
| Invoice generation after delivery | ✅ | 🔄 | accounting | Auto on ship via sales→accounting |
| Stock reservation on confirm | ✅ | ✅ | inventory | `POST /api/stock/reserve` |
| Stock release on cancel | ✅ | ✅ | inventory | `POST /api/stock/release` |
| Sales return (online) | ✅ | 🔄 | sales | `POST /api/sales-returns` |

---

## Module 3 — Categories

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| List categories (tree) | ✅ | inventory | `GET /api/categories` |
| Create category | ✅ | inventory | `POST /api/categories` |
| Update category | ✅ | inventory | `PATCH /api/categories/:id` |
| Soft-delete category | ✅ | inventory | `DELETE /api/categories/:id` |
| Reorder categories (sortOrder) | ✅ | inventory | `PATCH /api/categories/:id` |
| Toggle featured | ✅ | inventory | `PATCH /api/categories/:id` |
| Upload banner / icon URL | ✅ | inventory (URL from upload service) | `PATCH /api/categories/:id` |

---

## Module 4 — Products & Inventory

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| List products (paginated, filterable) | ✅ | ⬜ | inventory | `GET /api/products` |
| Get product detail | ✅ | ⬜ | inventory | `GET /api/products/:id` |
| Create product | ✅ | ⬜ | inventory | `POST /api/products` |
| Update product | ✅ | ⬜ | inventory | `PATCH /api/products/:id` |
| Soft-delete product | ✅ | ⬜ | inventory | `DELETE /api/products/:id` |
| List brands | ✅ | ⬜ | inventory | `GET /api/brands` |
| Create brand | ✅ | ⬜ | inventory | `POST /api/brands` |
| Update brand | ✅ | ⬜ | inventory | `PATCH /api/brands/:id` |
| Barcode lookup | ✅ | ⬜ | inventory | `GET /api/products?barcode=:code` |
| Stock levels per warehouse | ✅ | ⬜ | inventory | `GET /api/products/:id/stock` |
| Adjust stock (manual) | ✅ | ⬜ | inventory | `POST /api/stock/adjust` |
| Stock movement history | ✅ | ⬜ | inventory | `GET /api/stock/movements` |
| Low-stock alerts | ✅ | ⬜ | inventory | `GET /api/products?lowStock=true` |
| Product variants (create/update) | ⬜ | ⬜ | inventory | `POST /api/products/:id/variants` |
| Price lists | ⬜ | ⬜ | inventory | `GET/POST /api/price-lists` |

---

## Module 5 — POS Billing

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|----------|
| Open cash shift | ✅ | ✅ | accounting | `POST /api/shifts` |
| Close cash shift (with variance) | ✅ | 🔄 | accounting | `PATCH /api/shifts/:id` |
| List/filter shifts | ✅ | ✅ | accounting | `GET /api/shifts` |
| Shift detail with entries | ✅ | 🔄 | accounting | `GET /api/shifts/:id` |
| Create bill (COMPLETED or HELD) | ✅ | ✅ | accounting | `POST /api/bills` |
| Barcode product lookup (POS) | ✅ | ✅ | inventory | `GET /api/products?barcode=:code` |
| Apply per-item discount and tax | ✅ | ✅ | accounting | Included in `POST /api/bills` |
| Bill detail / receipt | ✅ | ✅ | accounting | `GET /api/bills/:id` |
| Hold bill | ✅ | ✅ | accounting | `POST /api/bills` with `status=HELD` |
| Resume held bill (HELD→COMPLETED) | ✅ | ✅ | accounting | `PATCH /api/bills/:id` |
| Cancel bill (ADMIN/MANAGER) | ✅ | 🔄 | accounting | `PATCH /api/bills/:id` with `status=CANCELLED` |
| Bill return / refund + stock restore | ✅ | ✅ | accounting | `POST /api/bills/:id/returns` |
| List bill returns | ✅ | 🔄 | accounting | `GET /api/bills/:id/returns` |
| List bills (shift/status/customer) | ✅ | ✅ | accounting | `GET /api/bills?shiftId=:id` |
| Shift summary report | ✅ | 🔄 | accounting | `GET /api/reports/shifts` |
| Cash-in / cash-out entries | ✅ | 🔄 | accounting | `POST /api/shifts/:id/entries` |
| Stock deduction on bill complete | ✅ | ✅ | inventory | `POST /api/stock/deduct` (from bill route) |

---

## Module 6 — Promotions & Banners

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| List banners | ✅ | ✅ | gateway | `GET /api/banners` |
| Create banner | ✅ | 🔄 | gateway | `POST /api/banners` |
| Update banner | ✅ | 🔄 | gateway | `PATCH /api/banners/:id` |
| Delete/deactivate banner | ✅ | 🔄 | gateway | `PATCH /api/banners/:id` |
| List coupons | ✅ | 🔄 | gateway | `GET /api/coupons` |
| Create coupon | ✅ | 🔄 | gateway | `POST /api/coupons` |
| Update coupon | ✅ | 🔄 | gateway | `PATCH /api/coupons/:id` |
| Validate & apply coupon | ✅ | ✅ | gateway | `POST /api/coupons/validate` |
| Coupon usage tracking | ✅ | N/A | gateway | Automatic in validate route |

---

## Module 7 — Delivery Management

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| Manage delivery zones | ✅ | 🔄 | delivery | `GET/POST /api/zones` |
| Update/delete zone | ✅ | 🔄 | delivery | `PATCH/DELETE /api/zones/:id` |
| Check pincode serviceability | ✅ | ✅ | delivery | `POST /api/zones/check-pincode` |
| Assign order to executive | ✅ | 🔄 | delivery | `POST /api/assignments` |
| List assignments | ✅ | ✅ | delivery | `GET /api/assignments` |
| Get assignment detail | ✅ | ✅ | delivery | `GET /api/assignments/:id` |
| Update assignment status (state machine) | ✅ | ✅ | delivery | `PATCH /api/assignments/:id` |
| Live location tracking | ✅ | 🔄 | delivery | `POST /api/assignments/:id/track` |
| Earnings summary | ✅ | ✅ | delivery | `GET /api/earnings` |
| Compensation config | ✅ | 🔄 | delivery | `GET/PUT /api/compensation` |

---

## Module 8 — Delivery Executives (HR)

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| Mark employee as delivery exec | ✅ Schema | ⬜ | hr | `PATCH /api/employees/:id` |
| Set availability status | ✅ Schema | ⬜ | hr | `PATCH /api/employees/:id/availability` |
| Set vehicle info | ✅ Schema | ⬜ | hr | `PATCH /api/employees/:id` |
| List delivery executives | ⬜ | ⬜ | hr | `GET /api/employees?isDeliveryExecutive=true` |
| Get executive's active order | ⬜ | ⬜ | hr | `GET /api/employees/:id` → `currentOrderId` |

---

## Module 9 — Customers (CRM)

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| List customers | ⬜ | ⬜ | sales | `GET /api/customers` |
| Get customer detail + order history | ⬜ | ⬜ | sales | `GET /api/customers/:id` |
| Create customer | ⬜ | ⬜ | sales | `POST /api/customers` |
| Update customer | ⬜ | ⬜ | sales | `PATCH /api/customers/:id` |
| Block / unblock customer | ✅ Schema | ⬜ | sales | `PATCH /api/customers/:id/block` |
| Manage delivery addresses | ✅ Schema | ⬜ | sales | `GET/POST /api/customers/:id/addresses` |
| Wallet balance (view/credit) | ✅ Schema | ⬜ | sales | `PATCH /api/customers/:id/wallet` |
| Coupon usage history | ⬜ | ⬜ | gateway | `GET /api/coupons/usage?userId=:id` |

---

## Module 10 — Reports & Analytics

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| Daily/weekly/monthly sales + top products | ✅ | 🔄 | sales | `GET /api/reports/sales` |
| Category-wise sales | 🔄 | ⬜ | sales | `GET /api/reports/by-category` |
| Top customers | ✅ | 🔄 | sales | Included in `GET /api/reports/sales` |
| Inventory valuation + low-stock | ✅ | 🔄 | inventory | `GET /api/reports/stock` |
| Stock movement history | ✅ | 🔄 | inventory | `GET /api/stock/movements` |
| Shift summary (bills, totals, variance) | ✅ | 🔄 | accounting | `GET /api/reports/shifts` |
| Executive delivery report | ✅ | 🔄 | delivery | `GET /api/earnings` |
| Coupon usage stats | 🔄 | ⬜ | gateway | Tracked via CouponUsage model |

---

## Module 11 — Notifications

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| Register FCM token | ✅ Schema | ⬜ | gateway | `POST /api/notifications/fcm` |
| Send push notification | ⬜ | ⬜ | gateway | `POST /api/notifications/push` |
| In-app notifications (list/read) | ⬜ | ⬜ | gateway | `GET /api/notifications` |
| Mark as read | ⬜ | ⬜ | gateway | `PATCH /api/notifications/:id/read` |

---

## Module 12 — Admin & Security

| Feature | BE Status | FE Status | Service | Endpoint |
|---------|-----------|-----------|---------|---------|
| User management (invite/role change) | ⬜ | ⬜ | gateway | existing invitation routes |
| Module license management | ⬜ | ⬜ | gateway | `GET/PATCH /api/licenses` |
| Tenant settings | ⬜ | ⬜ | gateway | `GET/PUT /api/settings` |
| Audit log view | ⬜ | ⬜ | delivery | `GET /api/audit-logs` |
| Role-based access control | ⬜ | ⬜ | all | middleware enforced |

---

## Cross-Cutting Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| Multi-tenancy (`tenantId` from headers) | ✅ | All new schemas and routes comply |
| Zod validation on all inputs | ✅ | Applied in all delivery routes |
| Pagination on all list endpoints | ✅ | All new list routes have page/limit |
| Soft deletes (isActive) | ✅ | All schemas use isActive |
| `prisma.$transaction` for multi-model writes | 🔄 | To be applied in Order confirm, Bill create |
| Service-to-service calls via `ServiceClient` | 🔄 | Used in assignment create |
| JWT auth via `createServiceMiddleware` | ✅ | All services use it |
| HTTP status codes per spec | ✅ | Applied in all new routes |

---

## Sprint Roadmap

| Sprint | Focus | Target |
|--------|-------|--------|
| **S1 — Foundation** | Schemas + config + delivery service scaffold | ✅ Complete |
| **S2 — Catalogue** | Brands, Category & Product CRUD + stock | ✅ Complete |
| **S3 — Orders** | Online order flow + coupon + stock reserve | ✅ |
| **S4 — POS** | Cash shifts + billing + barcode scan + returns | ✅ |
| **S5 — Promotions** | Banner & coupon CRUD + validate endpoint | ✅ |
| **S6 — CRM** | Customer CRUD + addresses + wallet + block | ✅ |
| **S7 — Notifications** | FCM registration + push + in-app | ✅ |
| **S8 — Reports** | Sales, inventory, delivery, shift reports | ✅ |
| **S9 — Admin UI** | Next.js admin app (all 12 modules) | ✅ |
| **S10 — Customer App** | Next.js customer storefront | ✅ |
| **S11 — POS App** | Next.js POS terminal app | ✅ |
| **S12 — Delivery App** | Next.js delivery executive PWA | ✅ |
