# Service Contract Catalog

Status: canonical Trustwood GA baseline.

## Transport Rules

- Browser traffic enters through Gateway or the owning same-origin BFF path. Browser code must not call service ports directly.
- Service-to-service traffic uses `ServiceClient` with `x-service-key` and propagates `x-request-id` and `x-correlation-id`.
- Tenant routes read `x-tenant-id` injected by authentication middleware. Request bodies and query strings are never authoritative for tenant identity.
- Tenant JWT requests use `Authorization: Bearer <token>`. Service calls use `x-service-key` and may carry tenant context.
- Protected service routes use `createServiceMiddleware(moduleId)`; health routes are the explicit public exception.
- Dates are ISO-8601 timestamps with an explicit offset. Money values are decimal numeric amounts in the owning service currency.

## Response Envelopes

```ts
// single resource
{ data: T }

// collection
{ data: T[], meta: { page, limit, total, pages } }

// error
{ error: string }
```

List endpoints accept bounded `page` and `limit` parameters. Mutating endpoints return `201` for creation, `200` for successful updates or idempotent replays, `400` for validation failures, `401` for missing/invalid authentication, `403` for authorization or licensing failures, `404` for missing resources, `409` for conflicts, and `500` for unhandled failures.

## Service Ownership and URLs

| Service | Local URL | Owner domains | Gateway/BFF route family |
|---|---|---|---|
| Gateway | `http://localhost:3010` | Auth, tenants, licenses, hosted capabilities (Notification, Communication) | `/admin/api/*` |
| Sales | `http://localhost:3001` | Customers, SREQ, orders, quotes, returns | `/admin/api/customers`, `/admin/api/orders`, `/admin/api/reports/sales` |
| Inventory | `http://localhost:3002` | Products, warehouses, stock, movements | `/admin/api/products`, `/admin/api/stock`, `/admin/api/reports/stock` |
| Accounting | `http://localhost:3003` | Journals, invoices, payments, notes, reconciliation | `/admin/api/invoices`, `/admin/api/reports/reconciliation` |
| HR | `http://localhost:3004` | Employees, payroll, leave | `/admin/api/employees`, `/admin/api/payroll` |
| Procurement | `http://localhost:3005` | Vendors, purchase orders, receiving | `/admin/api/vendors`, `/admin/api/purchase-orders` |
| Delivery | `http://localhost:3006` | Zones, assignments, delivery reports | `/admin/api/assignments`, `/admin/api/reports/delivery` |

Ownership SRP: [`SERVICE-SRP.md`](SERVICE-SRP.md) (ADR 0020). Notification send contract (`POST /api/notifications/send`, command `version: 1`) is [ADR 0019](../adr/0019-notification-platform-capability.md). Compatibility: `POST /api/notifications/push` (IN_APP + FCM). Delivery log: `GET /api/notifications/deliveries`, retry `POST /api/notifications/deliveries/:id/retry`. Channel policy: `GET|PUT /api/notifications/channels`. `ModuleId communication` is a nav key; chat APIs are on Gateway, not port 3008 (POS).
| Delivery | `http://localhost:3006` | Zones, assignments, delivery reports | `/admin/api/assignments`, `/admin/api/reports/delivery` |

## Critical Flow Contracts

| Flow | Source | Downstream | Required reliability behavior |
|---|---|---|---|
| Lead/order fulfillment | Sales | Inventory, Accounting, Delivery | Reserve before confirmation; release on cancellation; invoice once; delivery completion waits for Sales sync |
| Procurement receiving | Procurement | Inventory, Accounting | Stock receipt and AP posting use a request idempotency key; failed downstream work remains retryable |
| Sales return | Sales | Inventory, Accounting | Restock and credit-note completion are retry-safe and cannot duplicate effects |
| Payroll | HR | Accounting | Payroll cannot become completed when journal/payment posting fails |
| Delivery completion | Delivery | Sales | Completion is blocked until Sales synchronization succeeds |
| Reporting | Gateway | Sales, Inventory, Accounting, Delivery | Partial failures are isolated; date windows and result sizes are bounded; reports remain tenant-scoped |

## Versioning and Change Control

- Route families and response envelopes are contract surfaces. Changes require a contract test update and route-manifest validation.
- Additive response fields are preferred. Removing or renaming fields requires a versioned route or coordinated migration.
- Changes to tenant headers, auth scope, statuses, idempotency keys, or money/date conventions require an ADR and an E2E update.
