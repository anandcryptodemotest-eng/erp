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

WhatsApp OTP (Fast2SMS, per tenant):

| Action | Body |
|--------|------|
| `POST /api/auth?action=otp-start` | `{ phone, tenantSlug, purpose: "LOGIN" \| "VERIFY_LINK", portal?: "CUSTOMER" \| "ADMIN" }` |
| `POST /api/auth?action=otp-verify` | `{ phone, code, tenantSlug, portal, name? }` |
| `POST /api/auth?action=otp-link` | Authenticated `{ phone, code }` |
| `GET /api/auth/phone` | Authenticated verification status |

Tenant must have Fast2SMS configured under Administration → Integrations. `tenantSlug` is **required** for OTP. Customer verify may create a portal user; staff verify requires an existing PHONE credential and non-CUSTOMER membership.

OTP send order: WhatsApp AUTH Copy Code → Fast2SMS simple `message_id` → SMS `/dev/otp/send` (`smsOtpId`). Create Copy Code from Integrations ([Fast2SMS docs](https://docs.fast2sms.com/reference/createcopycodetemplate)) or the Fast2SMS panel, then sync.

Admin Fast2SMS APIs (tenant admin JWT):

| Method | Path |
|--------|------|
| `GET`/`PUT` | `/api/integrations/whatsapp` (status / API key) |
| `POST` | `/api/integrations/whatsapp/sync` |
| `PUT` | `/api/integrations/whatsapp/defaults` |
| `POST` | `/api/integrations/whatsapp/templates` (`kind`: `copy_code` \| `text` \| `custom`) |
| `POST` | `/api/integrations/whatsapp/test` (OTP) |
| `POST` | `/api/integrations/whatsapp/send` (`otp` \| `simple` \| `session`) |
| `GET` | `/api/integrations/whatsapp/reports?requestId=` |
| `GET` | `/api/integrations/whatsapp/logs` |
| `GET`/`PUT`/`DELETE` | `/api/integrations/whatsapp/webhooks` |
| `GET` | `/api/integrations/whatsapp/dlt?type=sender\|template` |

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
