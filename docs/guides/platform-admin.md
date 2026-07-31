# Platform Admin

Separate SaaS operator console: **`apps/platform`** (port **3011**).

Tenant Admin remains **`apps/gateway`** (`/admin`). Do not confuse tenant `SUPER_ADMIN` with Platform Operator.

## Local URLs

| Surface | URL |
|---------|-----|
| Platform Admin | **https://HOST/platform/login** (nginx → loopback :3011 only; port not public) |
| Tenant Admin | https://HOST/admin/login?tenant={slug} (see [tenant-login.md](./tenant-login.md)) |
| Customer | customer app / portal |

API calls from the platform app rewrite `/api/platform/*` → gateway `/admin/api/platform/*` (same-origin via nginx `/api/`).

Do **not** open firewall port 3011. Platform Next binds `127.0.0.1` only (`basePath: /platform`).

## Default operator

Seed:

```bash
pnpm seed:platform
```

| Email | Password | Role |
|-------|----------|------|
| platform@erp.local | Platform@123 | PLATFORM_OWNER |

Override with `PLATFORM_OWNER_EMAIL` / `PLATFORM_OWNER_PASSWORD`.

## Capabilities

- Provision tenants (transactional: tenant + settings + admin + license + audit)
- Manage licenses / deactivate tenants
- **Process Studio** (design workflows/forms for a selected tenant) — see [process-studio.md](./process-studio.md)
- Per-tenant **TenantCapability** toggles (e.g. allow tenant Process Studio)
- Service health (registry probes — live + ready)
- Audit log list

## Smoke

```bash
pnpm smoke:platform-admin
```

## Self-serve lockdown

- `POST /api/tenants` → 403
- Auth `register` auto-tenant requires `ALLOW_SELF_SERVE_TENANT=true`

## Env

| Var | Purpose |
|-----|---------|
| `TENANT_ADMIN_PUBLIC_URL` | Base for provision `loginUrl` (default `http://localhost:3010/admin`) |
| `GATEWAY_SERVICE_URL` | Platform Next rewrite target (default `http://127.0.0.1:3010/admin`) |
| `DEPLOYMENT_ENVIRONMENT` | Shown on Services page |
| `SERVICE_VERSION` / `GIT_SHA` / `BUILD_ID` | Health version/build/commit |
