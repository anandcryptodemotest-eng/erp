# Customer Portal BFF (Gateway)

Gateway hosts a **Customer BFF** under `/api/portal/*` so the portal can browse anonymously without a JWT, while authenticated Sales/Inventory routes remain available for checkout and account.

## Public / anonymous (service-key upstream)

| Route | Upstream |
|-------|----------|
| `GET /api/portal/home` | Banners + inventory featured/categories |
| `GET /api/portal/search?q=` | Catalog groups + products suggestions |
| `GET /api/portal/catalog/groups` | Inventory catalog groups |
| `GET /api/portal/catalog/groups/:code` | Group detail |
| `POST /api/portal/catalog/resolve` | Resolve configuration |
| `POST /api/portal/pricing/quote` | Pricing quote |
| `GET /api/portal/products` | Product list |
| `GET /api/portal/products/:id` | Product detail |
| `GET /api/portal/categories` | Categories |

Tenant resolution: `x-tenant-id` (authenticated) or `x-tenant-slug` / `?tenant=` (public).

## Authenticated (JWT via rewrite)

Checkout, sales-requests, customers/me, notifications, workflow-forms continue through existing Gateway rewrites. Gateway middleware injects `x-user-id` from Bearer JWT for Gateway-native APIs (notifications).

## Customer Portal vs Gateway (separation)

Treat the **Customer Portal** and **Gateway admin** as separate products that share backend services, not a shared UI shell.

| | Customer Portal (`apps/customer`) | Gateway (`apps/gateway`) |
|--|----------------------------------|--------------------------|
| Audience | Buyers / end customers | Staff / operators |
| Job | Browse, configure, cart → **Sales Request**; track fulfillment | ERP modules, Sales Desk, SO, inventory authoring |
| Profile | Customer-centric hub at `/profile` | Admin profile / RBAC |
| Auth token | `customer_token` (+ tenant id) in portal storage | `admin_token` / `erp_token` in Gateway storage — separate login |
| Navigation | Shop · Cart · Orders · Profile | Module rails (OMS, products, etc.) |

**Do not** share navigation, layouts, login pages, or terminology between the two. Staff must not use Gateway credentials on the customer portal (and vice versa).

### GST on portal orders

Pricing quotes are **ex-tax**. On SREQ create, Sales applies inventory `taxRate` only when it is explicitly set on the product; otherwise **0%**. Bill Summary always shows a Tax / GST line (₹0 when unset).
