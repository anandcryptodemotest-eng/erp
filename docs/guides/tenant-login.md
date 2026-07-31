# Tenant Admin login

Tenant Admin (`apps/gateway`, basePath `/admin`) resolves organization context from the URL or an optional org field — not a hardcoded demo tenant.

## URLs

| Form | Example |
|------|---------|
| Query (canonical) | `/admin/login?tenant=acme` |
| Path alias | `/admin/t/acme/login` → redirects to query form |
| Bare login | `/admin/login` — generic branding + optional Organization field |

Provisioned tenants return `loginUrl` as `/admin/login?tenant={slug}`.

## Public resolve

`GET /api/public/tenants/{slug}` (no JWT)

Returns `{ slug, displayName, active, branding: { logo, accent, theme } }` or **404** if unknown/inactive.

## Auth decision table

`POST /api/auth` with `{ action: "login", email, password, tenantSlug? }`

| URL / body tenant | Memberships | Result |
|-------------------|-------------|--------|
| Specified + member | — | **200** for that tenant |
| Specified + not member | — | **403** (never fall back to another membership) |
| Omitted + exactly 1 | — | **200**, auto-select |
| Omitted + 2+ | — | **409** `{ code: "TENANT_PICKER", tenants: [...] }` |
| Omitted + 0 | — | **403** |

## UI states

1. **Known org** (`?tenant=` resolves) — branded header, org slug shown, Sign In enabled
2. **Unknown org** — “Organization not found”, Sign In disabled
3. **No org in URL** — “ERP Admin” + Organization field; blank org allowed (server decision table)
4. **409 picker** — list of memberships; pick one to finish login

## Later (not in this slice)

- Prefer path `/t/{slug}/login` as primary
- Subdomain host routing
