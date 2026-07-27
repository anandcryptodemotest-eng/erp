# OMS E2E — Multi-user journey (Customer → Closed)

## Reset + seed

```bash
pnpm reset:oms
```

## Automated E2E

```bash
pnpm e2e:oms
```

Covers: **Customer places order** → Sales → Pricing → Dispatch → Delivery → Closed.

## Users

| Persona | Email | Password | App |
|---------|-------|----------|-----|
| **End customer** | `customer@oms.test` | `Test@123` | http://localhost:3007/login |
| Org Admin | `admin@simhapurifresh.com` | `Admin@123` | http://localhost:3010/login |
| Sales | `sales@oms.test` | `Test@123` | Admin OMS |
| Pricing | `pricing@oms.test` | `Test@123` | Admin OMS |
| Dispatch | `dispatch@oms.test` | `Test@123` | Admin OMS |
| Delivery | `delivery@oms.test` | `Test@123` | Admin OMS |

Tenant: `simhapuri-fresh`

## Manual UI journey

### 0. Customer (portal :3007)
1. Login as `customer@oms.test`
2. Products → add Marine Plywood to cart → Checkout → **Submit for review**
3. Orders → see status **With Sales** (`PENDING_SALES_REVIEW`)

### 1–5. Internal team (admin :3010)
1. **Sales** — OMS → review → verify stock  
2. **Pricing** — complete pricing  
3. **Dispatch** — ready + dispatch  
4. **Delivery** — deliver + close  
5. **Customer** — refresh Orders → **Closed**

Seeded: BuildRight Contractors (portal-linked), Site Office address, PLY-BWR-18-8X4, OMS Trading workflow.
