# OMS E2E — Multi-user journey (Customer → Closed)

## Platform note (v5)

New sales orders use **published** `SO_STANDARD` workflow JSON (sequential).  
Author/change flows in Admin → **Workflows** (Canvas → JSON → Validate → Publish).  
Runtime executes **snapshots** only — never the diagram.

See [WORKFLOW-PLATFORM.md](./WORKFLOW-PLATFORM.md).

## Reset + seed

```bash
pnpm reset:oms
```

## Automated E2E

```bash
pnpm e2e:oms
```

Tenant: `trustwood-enterprise`

## Users (live)

| Persona | Email | Password | App |
|---------|-------|----------|-----|
| Org Admin | `admin@simhapurifresh.com` | `Admin@123` | Admin (+ Workflows designer) |
| Sales Executive | `sales@trustwood.test` | `Sales@123` | Admin OMS |
| Pricing Executive | `pricing@oms.test` | `Test@123` | Admin OMS |
| Dispatch Executive | `dispatch@oms.test` | `Test@123` | Admin OMS |
| Delivery Executive | `delivery@oms.test` | `Test@123` | Admin OMS |
| Accountant | `accountant@oms.test` | `Test@123` | Admin OMS |

## Sequential SO_STANDARD v5

```
Sales Review → Inventory → Procurement? → Pricing → Warehouse
  → Dispatch → Delivery → Invoice → Payment → Close (SYSTEM)
```

Procurement runs only when `shortage` is true. Parallel Pricing∥Warehouse = publish a different template (edges only; no engine change).

## Manual UI journey

### Designer (Admin)
1. Workflows → open SO_STANDARD → Clone draft  
2. Edit canvas / properties → Save draft  
3. Fix validation → Publish  

### Trading desk
1. Customer places SREQ  
2. Sales converts → SO; first READY task = Sales review  
3. Complete inventory → (procurement if shortage) → pricing → warehouse → dispatch → deliver → invoice → pay → close  
