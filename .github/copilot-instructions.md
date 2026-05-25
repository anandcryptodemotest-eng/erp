# GitHub Copilot Instructions — ERP Microservices

This file is read by GitHub Copilot in every session. Follow all rules below when generating, editing, or reviewing code in this repository.

---

## 1. Project Overview

This is a **multi-tenant SaaS ERP** built as a **Turborepo monorepo** with independent Next.js microservices. Each service owns its domain data and runs on its own port. All client traffic enters via the API Gateway.

| Service       | Port | Domain                                                          |
|---------------|------|-----------------------------------------------------------------|
| gateway       | 3000 | Auth, Tenants, Licensing, Notifications, Invitations            |
| sales         | 3001 | Leads, Opportunities, Quotes, Orders, SalesReturns, Customers   |
| inventory     | 3002 | Products, Variants, PriceLists, Warehouses, Stock, BOM          |
| accounting    | 3003 | CoA, Journals, Invoices, CreditNotes, DebitNotes, Tax, Assets   |
| hr            | 3004 | Employees, TaxSlabs, Payroll, Payslips, Leave                   |
| procurement   | 3005 | Vendors, PurchaseOrders, PurchaseReturns                        |

Shared packages live under `packages/`: `@erp/auth`, `@erp/config`, `@erp/types`, `@erp/ui`.

---

## 2. Architecture Rules

### Services
- Each service is **independently deployable** — no direct DB cross-references between services.
- A service may call another via `ServiceClient` from `@erp/config` (HTTP with `x-service-key`).
- Never import Prisma clients or models from another service.
- Never add cross-service foreign keys in Prisma schemas.
- Store only IDs that reference data from other services (e.g. `customerId` in accounting is a string, not a relation).

### Multi-tenancy
- Every table that holds business data **must** have a `tenantId: String` field and a `@@index([tenantId])`.
- Every route handler **must** read `tenantId` from `request.headers.get("x-tenant-id")` — never from the request body or query params.
- Filter all DB queries by `tenantId` as the first `where` condition.

### Authentication & Middleware
- All service middlewares **must** use `createServiceMiddleware(moduleId)` from `@erp/auth` — never copy-paste middleware logic.
- The service key check is fail-closed: `SERVICE_SECRET` env var **must** be set; requests with an unset secret are rejected.
- Headers injected by middleware (`x-user-id`, `x-tenant-id`, `x-user-role`) are the single source of truth inside route handlers.

---

## 3. API Design Rules

### Response Shape
All API responses **must** use this shape — no exceptions:
```ts
// Success list
{ data: T[], meta: { page: number, limit: number, total: number, pages: number } }

// Success single
{ data: T }

// Error
{ error: string }
```

### Pagination
Every `GET` list endpoint **must** support `?page=&limit=` query params:
```ts
const url = new URL(request.url);
const page  = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1"));
const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
const skip  = (page - 1) * limit;
```
Never use a hardcoded `take:` limit like `take: 50`.

### Input Validation
- Use `zod` for all request body validation. Return `{ error: errors[0].message }` on ZodError.
- Never trust data from request bodies for `tenantId`, `userId`, or `role` — always read from middleware-injected headers.

### HTTP Status Codes
- `200` — successful GET
- `201` — successful POST (resource created)
- `400` — validation error / bad input
- `401` — missing or invalid token
- `403` — valid token but insufficient permission / no module license
- `404` — resource not found
- `409` — conflict (duplicate unique key)
- `500` — unhandled server error

---

## 4. Database Rules

### Prisma
- All schemas use `provider = "postgresql"` — never sqlite.
- All `@id` fields use `@default(cuid())`.
- All tables include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` (except join/movement tables where only `createdAt` is needed).
- Use `isActive Boolean @default(true)` + soft deletes — never `DELETE` business records.
- Transactional mutations that touch multiple models **must** use `prisma.$transaction([...])`.
- Always add `@@index([tenantId])` on every multi-tenant table.

---

## 5. Shared Packages

### `@erp/types`
- All shared TypeScript interfaces and enums live here.
- Add new shared types here; never inline them in a service.

### `@erp/auth`
- `createToken` / `verifyToken` — JWT creation and verification.
- `createServiceMiddleware(moduleId)` — Next.js middleware factory for services.
- `verifyServiceCall(key)` — validate inbound service-to-service calls.

### `@erp/config`
- `ServiceClient` — HTTP client for inter-service calls. Use `serviceClient.call(targetService, path, options)`.
- `services` registry — source of truth for port numbers and dependencies.

### `@erp/ui`
- Shared React components (Button, Card, Input, Badge, DataTable).
- Do not add business logic here — UI primitives only.

---

## 6. Environment Variables

| Variable             | Required | Description                                    |
|----------------------|----------|------------------------------------------------|
| `DATABASE_URL`       | Yes      | PostgreSQL connection string for this service  |
| `JWT_SECRET`         | Yes      | HS256 signing secret — never use default in prod |
| `SERVICE_SECRET`     | Yes      | Shared secret for inter-service auth           |
| `TAX_RATE`           | No       | Decimal tax rate, default `0.10`               |
| `*_SERVICE_URL`      | No       | Override service base URLs (defaults to localhost:PORT) |

Always read optional env vars with a safe fallback: `process.env.TAX_RATE ?? "0.10"`.

---

## 7. Use Case Flows (Implementation Status)

Track which flows are implemented vs pending. Update this section as each UC is completed.

| UC   | Name                          | Services Involved                     | Status      |
|------|-------------------------------|---------------------------------------|-------------|
| UC1  | Tenant Onboarding             | gateway                               | Partial     |
| UC2  | Lead-to-Cash                  | sales → inventory → accounting        | Pending     |
| UC3  | Procure-to-Pay                | procurement → inventory → accounting  | Pending     |
| UC4  | Hire-to-Payroll               | hr → accounting                       | Pending     |
| UC5  | Inventory Management          | inventory                             | Partial     |
| UC6  | Financial Reporting           | accounting                            | Pending     |
| UC7  | Product Catalogue & Pricing   | inventory                             | Pending     |
| UC8  | Tax Management                | accounting                            | Pending     |
| UC9  | Fixed Assets & Multi-FX       | accounting                            | Pending     |
| UC10 | Sales Return & Credit Note    | sales → inventory → accounting        | Pending     |
| UC11 | Purchase Return & Debit Note  | procurement → inventory → accounting  | Pending     |

### UC2 — Lead-to-Cash State Machine
```
Lead → Opportunity → Quote (DRAFT→SENT→ACCEPTED)
  └──▶ SalesOrder DRAFT → CONFIRMED (credit limit checked, stock reserved)
                        → PARTIALLY_SHIPPED (some items shipped, partial invoice)
                        → SHIPPED (all shipped, full AR invoice) → INVOICED
                        ↘ CANCELLED (reservation released)
```

### UC3 — Procure-to-Pay State Machine
```
DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED (partial stock + partial AP invoice)
                              → RECEIVED (full stock + AP invoice)
      ↘ CANCELLED
```

### UC4 — Payroll State Machine
```
DRAFT → PROCESSED (journal entry posted) → PAID (bank entry posted)
```

### UC10 — Sales Return State Machine
```
SalesReturn: PENDING → APPROVED → COMPLETED (stock restored, CreditNote issued)
                     ↘ REJECTED
CreditNote:  ISSUED → APPLIED (offset against invoice) | REFUNDED (cash back)
```

### UC11 — Purchase Return State Machine
```
PurchaseReturn: PENDING → APPROVED → DISPATCHED (stock deducted, DebitNote issued)
                        ↘ REJECTED
DebitNote:      ISSUED → APPLIED (offset against AP) | REFUNDED
```

---

## 8. Security Checklist

Before marking any route as complete, verify:
- [ ] `tenantId` is read from headers, not body
- [ ] All DB queries are scoped by `tenantId`
- [ ] Input validated with zod
- [ ] Prisma unique constraint errors caught (code `P2002`) and returned as `409`
- [ ] No secrets or tokens logged
- [ ] Pagination applied on list endpoints
- [ ] Role check applied where write operations require ADMIN or MANAGER
- [ ] Credit limit checked before `SalesOrder` confirm
- [ ] Return quantity validated against `shippedQty` (SR) or `receivedQty` (PR)
- [ ] Try-compensate applied on all multi-service mutations (ship, receive-return, dispatch-return)

---

## 9. Coding Conventions

- TypeScript strict mode — no `any` unless unavoidable (add a comment explaining why).
- Use `const` over `let`; avoid `var`.
- Async/await — no raw `.then()` chains in route handlers.
- Error handling: catch `ZodError` and `Prisma` errors explicitly; re-throw unexpected errors after logging.
- File naming: `route.ts` for API routes, `[id]/route.ts` for resource-by-id routes.
- Do not add comments to code unless the logic is genuinely non-obvious.
- Do not create helper abstractions for one-time operations.
