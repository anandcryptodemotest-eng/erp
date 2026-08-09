# ERP — Requirements & Dependencies

> **Living document.** Update this file whenever a new host tool, runtime, service dependency, or npm package becomes required for local or production use.
> **Last updated:** 2026-08-09 (invoice PDF volume `erp-files` + `FILE_STORE_ROOT`; Fast2SMS client unchanged)

---

## 1. Database decision (source of truth)

### Chosen database: **PostgreSQL 16**

| Question | Answer |
|----------|--------|
| Are we planning to use PostgreSQL? | **Yes — already decided and wired in the codebase.** |
| Is it the right database for this ERP? | **Yes.** Relational, ACID transactions, strong fit for orders/invoices/inventory/payroll, first-class Prisma support. |
| Alternatives considered | MySQL/MariaDB (possible with Prisma, but not used), MongoDB (wrong fit for highly relational ERP ledgers), SQLite (fine for toys, not multi-service ERP). |

**Evidence in repo:**

- Every service Prisma schema: `provider = "postgresql"`
- `docker-compose.yml` runs `postgres:16-alpine`
- `.env.example` uses `postgresql://…` URLs
- Architecture docs: one PostgreSQL database **per microservice** (shared Postgres server in dev)

### Database layout (dev)

| Database | Owner service | Typical data |
|----------|---------------|--------------|
| `erp_gateway` | gateway | Users, tenants, auth, notifications, **communication**, **assets** |
| `erp_sales` | sales | Customers, orders, OMS workflow |
| `erp_inventory` | inventory | Products, stock, categories |
| `erp_accounting` | accounting | Journals, AR/AP invoices |
| `erp_hr` | hr | Employees, payroll |
| `erp_procurement` | procurement | Vendors, purchase orders |
| `erp_delivery` | delivery | Deliveries / dispatch |

**Dev defaults** (from `.env.example` / compose):

- Host: `localhost:5432`
- User: `erp`
- Password: `erp_dev_password`
- Docker volume: `pgdata`

**Optional local helper:** `tools/local-pg` (embedded Postgres) for machines without Docker Postgres.

**Trading document flow:** Customer checkout creates a **Sales Request (SREQ)**; sales converts it to a **Sales Order (SO)**. Parallel prep tasks drive fulfillment — not a long sequential SO status ladder. See `docs/TRADING-JOURNEY.md`.

**Document files (invoice PDFs):** not in Postgres. Accounting writes PDFs under `FILE_STORE_ROOT` (Compose: `/var/lib/erp-files` on named volume `erp-files`). Local `next dev` defaults to `/tmp/erp-files`. GET `/api/invoices/:id/pdf` re-renders if the DB row exists but the file is missing.

**Not used for primary ERP data:** Redis, MongoDB, Kafka, MinIO. Cart state in the customer UI is browser `localStorage` until checkout writes a **sales request** to Postgres via the API.

---

## 2. Host prerequisites (must install on the server)

| Requirement | Version / notes | This server (2026-07-28) |
|-------------|-----------------|--------------------------|
| OS | Linux (or macOS/Windows with Docker) | Linux ✓ |
| Node.js | **≥ 20** (repo `engines`) | v22.19.0 ✓ |
| **pnpm** | **9.15.0** (`packageManager` field) | 9.15.0 ✓ |
| Git | any recent | ✓ |
| Docker | Engine + Compose v2+ | 29.1.5 / Compose v5 ✓ |
| PostgreSQL | **16** via Docker (preferred) or local | `erp-postgres-1` healthy ✓ |
| Invoice file store | Compose volume `erp-files` → `/var/lib/erp-files` (`FILE_STORE_ROOT`) | accounting ✓ |
| Workspace deps | `pnpm install` | Installed ✓ |
| App `.env` files | Per-service `DATABASE_URL` | Created ✓ |
| Firewall | **TCP 80 + 443 only** (no app ports) | 80/443 ✓ |
| Nginx edge gateway | TLS terminate + reverse proxy | `/etc/nginx/conf.d/erp-gateway.conf` ✓ |
| `erp` CLI | `/usr/local/bin/erp` → `scripts/erp` | up/down/restart/status/logs/doctor/heal |
| `erp-watchdog.timer` | systemd, every 2 min → `erp heal` | Compose crash + unhealthy recovery |
| Corepack (optional) | Enable to pin pnpm via `packageManager` | MISSING (optional) |
| `psql` client | Optional; useful for debugging | MISSING (optional) |
| Outbound HTTPS | `www.fast2sms.com` | Required for WhatsApp OTP (Fast2SMS) |

### Install pnpm (required before anything else)

```bash
npm install -g pnpm@9.15.0
# or, if corepack is available:
corepack enable && corepack prepare pnpm@9.15.0 --activate
```

### Bootstrap checklist

1. Install pnpm (above)
2. `cp .env.example .env` and set `JWT_SECRET` / `SERVICE_SECRET` / `INTEGRATION_ENCRYPTION_KEY` (`openssl rand -hex 32`)
3. `cp apps/customer/.env.example apps/customer/.env` (customer UI)
4. `pnpm install` at repo root
5. `erp up` (or `pnpm docker:up`) — Compose core only; host customer/platform/nginx stay on systemd
6. `pnpm db:generate` && `pnpm db:push` (or project migrate scripts)
7. _(Seed scripts removed — create catalog via Admin UI)_
8. Bind apps to **127.0.0.1** only; expose via nginx on **443** (see §2.1)

### 2.1 Public exposure & security (required for shared servers)

| Rule | Detail |
|------|--------|
| Public ports | **80 → HTTPS redirect**, **443 only**. Never open 3001–3010 or 5432 on the firewall. |
| App bind | Next apps: `--hostname 127.0.0.1`. Postgres compose: `127.0.0.1:5432:5432`. |
| Edge proxy | Nginx `/` → customer `:3007`; `/admin` → gateway (`basePath: /admin`); `/api/` → gateway `/admin/api/`. |
| Browser APIs | Same-origin `/api/*` only — never call microservice ports from the client. |
| TLS | Terminate at nginx (replace self-signed cert for production). |
| Rate limit | Nginx `limit_req` on `/api/`. |

**URLs (this server):**

- Customer: `https://<host>/`
- Admin: `https://<host>/admin`
- API: `https://<host>/api/...`

---

## 3. Application stack (locked choices)

| Layer | Technology | Notes |
|-------|------------|--------|
| Monorepo | Turborepo + pnpm workspaces | Root `package.json` |
| Framework | Next.js 15 (App Router) | All apps |
| Language | TypeScript | Strict |
| UI | React 19 + Tailwind CSS 4 | Shared `@erp/ui` |
| ORM | Prisma 6 | Per-service schema |
| Validation | Zod | Shared patterns |
| Auth | JWT (jose) + Argon2id + OAuth2 (Google ID token) + WhatsApp OTP (Fast2SMS) | Gateway owns users; AuthCredential model (`PASSWORD` / `GOOGLE` / `PHONE`) |
| Containers | Docker Compose | Dev/prod-like |

### Apps & default ports

| App | Package | Port | Has own Postgres? |
|-----|---------|------|-------------------|
| Gateway / admin API | `@erp/gateway` | 3000 / 3010* | Yes (`erp_gateway`) |
| Sales | `@erp/sales` | 3001 | Yes |
| Inventory | `@erp/inventory` | 3002 | Yes |
| Accounting | `@erp/accounting` | 3003 | Yes |
| HR | `@erp/hr` | 3004 | Yes |
| Procurement | `@erp/procurement` | 3005 | Yes |
| Delivery | `@erp/delivery` | (compose) | Yes |
| **Customer UI** | `@erp/customer` | **3007** | **No** (API only) |
| POS | `@erp/pos` | — | No (API only) |
| Delivery app | `@erp/delivery-app` | — | No (API only) |

\*Confirm exact admin port in running env / gateway scripts; customer proxies `/api/*` to `GATEWAY_SERVICE_URL` (default `http://localhost:3010`).

---

## 4. npm / workspace dependencies (track extras here)

> When you add a **new** package to any `package.json`, add a row below with date, why, and which app/package.

### Core (already in repo)

| Package | Used by | Purpose |
|---------|---------|---------|
| `next`, `react`, `react-dom` | all apps | UI + API routes |
| `@prisma/client`, `prisma` | gateway, sales, inventory, accounting, hr, procurement, delivery | DB access |
| `zod` | apps | Validation |
| `bcryptjs` | gateway (+`@erp/auth` for legacy-verify) | Legacy bcrypt verification during Argon2id migration |
| `@node-rs/argon2` (via `@erp/auth`) | auth package | Argon2id password hashing |
| `google-auth-library` (via `@erp/auth`) | auth package | Google Identity Services ID-token verification |
| `jose` (via `@erp/auth`) | auth package | JWT |
| `lucide-react` | gateway | Icons |
| `recharts` (via `@erp/ui`) | ui package | Dashboard charts (admin + customer) |
| `@zxing/browser`, `@zxing/library` | gateway | Barcode / QR |
| `turbo` | root | Monorepo tasks |
| `tailwindcss` | apps | Styling |
| `typescript` | all | Types |
| `embedded-postgres` | `tools/local-pg` only | Optional local PG without Docker |

### Extra dependencies log

| Date | Package / change | Version | Added to | Why |
|------|------------------|---------|----------|-----|
| 2026-07-28 | Removed `scripts/seed.ts`, `scripts/reset-and-seed-oms.ts` | — | scripts | Admin will create products manually; cleared inventory seed data |
| 2026-07-28 | Auto SKU `CAT-BRAND-####` via `/api/products/suggest-sku` | — | inventory + admin UI | SKU from category + brand codes; manual override allowed |
| 2026-07-28 | Local product image upload `/api/uploads/product-image` | — | gateway + nginx `/uploads/` | JPG/PNG/WebP ≤2MB; store under `/home/erp/data/uploads` |
| 2026-07-28 | Auto-create Main Warehouse on stock receive | — | admin products | Fixes stock/receive 500 after catalog wipe |
| 2026-03-08 | `@erp/asset` (workspace package) | 1.0.0 | `packages/asset` | First-class platform Asset capability — AssetRef types, MIME→AssetType mapping, shared by Communication, Documents, Products |
| 2026-03-08 | `@erp/communication` (workspace package) | 1.0.0 | `packages/communication` | Communication platform capability — types, constants, namespaced events, SSE client, message utilities |
| 2026-03-08 | `@erp/asset` + `@erp/communication` deps | workspace:* | `apps/gateway` | Gateway hosts Communication + Asset APIs and Prisma models |
| 2026-03-08 | Gateway Prisma: Asset, Conversation, Message, MessageAttachment, MessageReaction, MessageReadReceipt, ConversationParticipant, Presence, ConversationSummary | — | `apps/gateway/prisma/schema.prisma` | Communication + Asset platform data models (see ADR 0017) |
| 2026-03-08 | Gateway auth refactor: `AuthCredential` model + `CredentialType` enum (PASSWORD/GOOGLE/PASSKEY); User drops `password`/`role`; RefreshToken gains `revokedAt`/`lastUsedAt`/`device`/`ip`/`userAgent` | — | `apps/gateway/prisma/schema.prisma` | Provider-agnostic identity (Google now; MS/Apple/Passkey later) with account linking + Argon2id |
| 2026-03-08 | `@node-rs/argon2`, `google-auth-library`, `bcryptjs` | ^2.0.2 / ^11.0.0 / ^3.0.3 | `packages/auth` | Argon2id hashing + Google Identity Services ID-token verification; `bcryptjs` retained for one-time legacy migration |
| 2026-03-08 | `google-auth-library`, `@node-rs/argon2` | ^11 / ^2 | `apps/gateway` | IdentityService + Google provider used by `/api/auth?action=google` |
| 2026-03-08 | Configurable dashboard engine: `@erp/ui/dashboard` (widget registry, role defaults, renderer, editor) + `DashboardPreference` Prisma model + `recharts` | ^3 | `packages/ui`, `apps/gateway`, `apps/customer` | Permission-aware dashboards (module + capability gates; role = default config only). Admin `/dashboard` + customer `/dashboard`. |
| 2026-08-08 | Gateway Prisma: `TenantIntegration`, `TenantIntegrationSecret`, `OtpChallenge`, `CredentialType.PHONE`, `User.phoneNormalized` / `phoneVerifiedAt` | — | `apps/gateway/prisma/schema.prisma` | Per-tenant Fast2SMS WhatsApp OTP (encrypted API key + AUTHENTICATION templates). No new npm package (Node `crypto` + fetch). |
| 2026-08-08 | Fast2SMS client surface + Integrations UI (Copy Code create, simple/session send, SMS otp_id fallback, DLR, logs, DLT catalog, webhooks) | — | `apps/gateway` | Utilise Fast2SMS WhatsApp + SMS OTP APIs; Meta Graph create/list may return “Invalid request” on some WABAs — UI still lets you create Copy Code and fall back to simple/SMS. |

### Host / system extras log

| Date | Tool | Why |
|------|------|-----|
| 2026-07-28 | pnpm@9.15.0 | Required package manager — installed globally |
| 2026-07-28 | Docker Postgres 16 | Primary data store — loopback bind only |
| 2026-07-28 | nginx `erp-gateway.conf` | Public TLS gateway; app ports not exposed |
| 2026-07-28 | firewalld 80/443 only | Closed 3007/3010 after gateway cutover |
| 2026-08-08 | Outbound HTTPS to `www.fast2sms.com` | Per-tenant WhatsApp OTP (no host daemon) |
| 2026-08-08 | `erp` CLI (`scripts/erp`) + `/usr/local/bin/erp` | Host ops: up/down/status/logs/doctor/heal. No new npm package. |
| 2026-08-08 | systemd `erp-watchdog.timer` (2 min) | Periodic `erp heal`; does not replace Compose. |
| 2026-08-08 | Compose `restart: unless-stopped` | Container crash recovery for postgres + APIs + obs profile |

---

## 5. Environment variables (required)

Copy from `.env.example`. Critical keys:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Auth tokens (must change in production) |
| `SERVICE_SECRET` | Inter-service auth |
| `INTEGRATION_ENCRYPTION_KEY` | 32-byte hex AES-256-GCM key for per-tenant Fast2SMS API keys (`openssl rand -hex 32`) |
| `OTP_PEPPER` | Optional OTP hash pepper; defaults to `INTEGRATION_ENCRYPTION_KEY` |
| `GOOGLE_CLIENT_ID` | Google Identity Services client id (server-side ID-token verify) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same value exposed to the customer portal browser for the sign-in button |
| `TAX_RATE` | Order tax fraction (e.g. `0.10`) |
| `OTEL_SDK_DISABLED` | Default **true** in Compose. Set `false` only with `docker compose --profile obs up -d` |
| `FILE_STORE_ROOT` | Accounting invoice PDF directory (Compose: `/var/lib/erp-files`) |
| `*_DATABASE_URL` | Per-service Postgres URLs |
| `GATEWAY_SERVICE_URL` | Customer UI → gateway (see `apps/customer/.env.example`) |
| `NEXT_PUBLIC_TENANT_SLUG` / `NEXT_PUBLIC_TENANT_NAME` | Customer portal tenant branding |

---

## 6. How to keep this document updated

**Rule for humans and agents:**

1. Adding an npm dependency → append a row in **§4 Extra dependencies log** and note the app.
2. Adding a new host tool (Redis, MinIO, etc.) → update **§2** and **§1** if storage changes.
3. Changing database engine or version → update **§1** first; do not diverge from Prisma `provider`.
4. Bumping Node / pnpm / Postgres major → update version tables and “Last updated”.
5. Prefer documenting **why**, not only the package name.

Cursor rule: `.cursor/rules/requirements-doc.mdc` reminds the agent to update this file.

---

## 7. Out of scope for v1 (do not treat as required)

- MongoDB / Redis / Kafka as primary ERP stores
- Separate production DB server per microservice (recommended later; shared PG is OK for dev)
- Native `psql` on the host (optional)
