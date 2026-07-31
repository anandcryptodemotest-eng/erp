# Process Studio

Platform owns process design by default. Tenant Process Studio is a **granted capability**.

## Architecture

```text
Platform Admin ──┐
                 ├── Gateway (auth + route) ──► Sales Process APIs ──► tenant-scoped data
Tenant Admin ────┘
```

- **No impersonation** — platform JWT carries `scope: "platform"`; sales authorizes via `requireProcessDesigner(ctx)`.
- **TenantCapability** (not TenantSetting) stores `processStudio` and future keys (`CapabilityKey` in `@erp/platform-core`).
- **ModuleLicense** must allow Process Studio (`core`, `process`, or `sales`) before capability can be enabled.

## Entry points

| Host | URL | Requirement |
|------|-----|-------------|
| Platform | `/platform/process` | Platform JWT + `manageProcess` + target tenant picker |
| Tenant | `/admin/workflows`, `/admin/configuration` | Tenant JWT + designer role + license + `processStudio` capability |

## Grant tenant access

1. Ensure tenant has an active `core` or `process` license
2. Platform → Tenants → [tenant] → **Allow tenant Process Studio**
3. Tenant users **re-login** (capabilities are embedded in the JWT)

## Future

Platform Default Process Library → clone → Tenant Copy → Tenant customizations (documented; not built in v1).
