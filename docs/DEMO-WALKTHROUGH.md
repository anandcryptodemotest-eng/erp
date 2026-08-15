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
pnpm seed:demo       # catalog + SO_STANDARD forms + Porter settings
# Existing tenant with old forms:
#   Configuration → Forms → Upgrade unmodified starters → Confirm
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
4. Open **Order Desk** (`/sales-desk`) and complete tasks in order (each login owns its desk):

| Step | Who | Market beat | What to show |
|------|-----|-------------|--------------|
| Confirm dealer order | Sales | Amend lines / promised date | ProductList + CatalogSearch + notes + PriceSummary |
| Check godown availability | Sales | ATP vs indent | InventoryView + available qty (Sales owns stock check in this demo) |
| Raise shortage indent | Sales | Optional if available &lt; ordered | Skip on happy path |
| Confirm trade margin | Pricing | Purchase vs sell | Purchase cost fields; sell readonly |
| Pick & pack | Dispatch | Select godown | WarehousePicker → persists on SO |
| Dispatch from yard | Dispatch | Own fleet **or** Porter | Own fleet: vehicle + driver. Porter: **Open Porter booking** ExternalLink (does not complete task) → then Complete |
| Confirm site delivery | Delivery | POD | FileUpload + Comments |
| **Bill & Collect** | Accountant | Tax invoice + cash | See below (one Work Item) |

### Bill & Collect (Accountant) — products, prices, advance

Open **Bill & Collect** (not separate “Issue invoice” / “Record payment” queues):

1. **Update qty / unit price** on lines if the billed amounts differ from prep.  
2. Click **Generate invoice PDF** → **Download PDF** and review (modern B2B layout: brand header, Bill From/To, accent line table, notes + amount in words).  
3. Optionally enter **Advance / amount collected**, method, UTR.  
4. **Confirm & complete**.  
   - No cash → invoice issued; reopen later to collect.  
   - Advance → invoice `PARTIALLY_PAID`, order `PARTIAL`; collect remainder on the same Work Item or AR.  
   - Full amount → order closes toward **CLOSED**.

Cash always posts against the **Accounting invoice** for that SO (never as orphan advance on Confirm Order).

### Porter (dispatch only)

1. On Dispatch, choose fulfillment **Porter**.
2. Click **Open Porter booking** (ExternalLink) — opens `porter.in` (or tenant `logistics.porter.bookUrl`).
3. Enter tracking / mark booked in DispatchFulfillment, then **Complete**.
4. Opening the link never dispatches the order by itself.

Happy-path demo prefers **own fleet** (faster, no portal dependency).

Stock check is on the **Sales** role in the published `SO_STANDARD` workflow (by design for this demo).

## Optional automated proof

```bash
pnpm e2e:oms
pnpm e2e:greenfield
```
