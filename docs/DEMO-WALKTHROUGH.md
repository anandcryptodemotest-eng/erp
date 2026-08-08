# Client demo walkthrough (trustwood-enterprise)

Base URL (this server): **https://150.242.201.102/admin**  
Login: **https://150.242.201.102/admin/login?tenant=trustwood-enterprise**
(Bare `/admin/login` no longer assumes Trust Wood — use the `tenant` query or Organization field.)  
Tenant: **trustwood-enterprise**

Port **3010 is firewalled**. Use **HTTPS on 443** (nginx reverse proxy). Browser may warn about the self-signed cert — proceed once for demo.  
(`localhost` / `:3010` only work on the server itself.)

Prep (once):

```bash
pnpm clear:catalog   # soft-delete active products (idempotent)
pnpm seed:demo
pnpm e2e:portal      # customer → SREQ → convert → tracking
pnpm e2e:oms         # full staff workflow marathon
```

## Logins

| Desk | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@simhapurifresh.com | Admin@123 | ADMIN |
| Sales | sales@trustwood.test | Sales@123 | SALES_EXECUTIVE |
| Pricing | pricing@oms.test | Test@123 | PRICING_EXECUTIVE |
| Dispatch / Warehouse | dispatch@oms.test | Test@123 | DISPATCH_EXECUTIVE |
| Delivery | delivery@oms.test | Test@123 | DELIVERY_EXECUTIVE |
| Accounts | accountant@oms.test | Test@123 | ACCOUNTANT |
| **Portal buyer** | **buyer@trustwood.test** | **Buyer@12345** | CUSTOMER |

## Catalog (seeded)

| Group / SKU | Type | Pricing | Notes |
|-------------|------|---------|-------|
| `TRUSTWOOD-BWP` | Configure | PER_AREA | images by size |
| `TRUSTWOOD-BLOCKBOARD` | Configure | PER_AREA | images by size |
| `TRUSTWOOD-LAMINATE` | Configure | PER_AREA | images by finish |
| `TRUSTWOOD-PHONE` | Configure | PER_EACH | images by color |
| `TW-ADH-1L` | Simple | PER_EACH | no configure axes |

Attributes: thickness / size / grade (or finish / color / storage) + brand. GST unset → 0% on SREQ.

## Sample order (recommended lines)

1. Log in as **Sales**.
2. Create a **Sales Request** for an existing customer with e.g.:
   - 2 × `PLY-BWR-18-8X4`
   - 1 × `BLK-COM-19-8X4`
   - 4 × `LAM-GLOSS-1MM-8X4`
3. **Convert** SREQ → Sales Order (CONFIRMED, v5 snapshot).
4. Open **OMS** and complete tasks in order (each login owns its desk):

| Step | Who | What to show |
|------|-----|----------------|
| Sales review | Sales | ProductList + CatalogSearch + FormFields |
| Verify stock | Sales | Available qty fields |
| Pricing | Pricing | Purchase/sell fields |
| Warehouse ready | Dispatch | Confirm pick list |
| Dispatch | Dispatch | Vehicle / driver |
| Deliver | Delivery | Confirm delivery |
| Invoice | Accountant | Confirm invoice |
| Collect payment | Accountant | Confirm payment → **CLOSED** |

Stock check is on the **Sales** role in the current published `SO_STANDARD` workflow (by design for this demo).

## Optional automated proof

```bash
pnpm e2e:oms
```
