# Tenant GST — implementation & E2E checklist

**Last validated:** 2026-08-13 via `pnpm e2e:gst` → **39/39 PASS**  
**Reports:** [`E2E-GST-latest.md`](E2E-GST-latest.md) · [`TENANT-GST-E2E-CHECKLIST.md`](TENANT-GST-E2E-CHECKLIST.md)

**Product rule:** OMS is universal; GST is a tenant tax pack.

---

## Use-case matrix

| # | Tenant | Buyer | UI | `documentKind` | Tax | IRN | GSTR-1 | E2E |
|---|--------|-------|----|----------------|-----|-----|--------|-----|
| U1 | `NONE` | any | Create Bill / Quick Bill | `COMMERCIAL` | 0% | N/A | excluded | PASS |
| U2 | Regular + eInvoice OFF/OPTIONAL | B2B | Create Bill | `TAX_INVOICE` | snapshot | optional | export | PASS |
| U3 | Regular + OPTIONAL | B2B | Generate IRN | `TAX_INVOICE` | snapshot | manual | export | PASS |
| U4 | Regular + REQUIRED | B2B | block ISSUED until IRN | `TAX_INVOICE` | snapshot | mandatory | — | code path |
| U5 | Regular | B2C | Create Bill | `TAX_INVOICE` | CGST+SGST | N/A | export | PASS |
| U6 | Composition | any | Create Bill | `BILL_OF_SUPPLY` | 0% output | never | export | PASS |
| U7 | Regular mixed cart | B2B | line `taxTreatment` | `TAX_INVOICE` | per-line | — | — | unit |
| U8 | `NONE` → GST dealer | GSTIN buyer | Create Bill | `COMMERCIAL` | 0% | never | excluded | PASS |
| U9 | Any | walk-in | Quick Bill | same rules | same | same | same | PASS |

---

## Phase checklist

### Phase A — Tenant tax + Bill PDF

- [x] `packages/tax-india` — GSTIN, regime/scheme, POS, tax calc (7 unit tests)
- [x] TenantSetting validation + Administration → Tax & Invoicing
- [x] Internal `GET /api/internal/tenants/:id/tax-profile`
- [x] `generateInvoice` enrichment + `normalizeRate` fix
- [x] PDF seeds: tax-invoice / commercial (Bill) / bill-of-supply (modern B2B chrome: Bill From/To cards, accent table header `#173f5f`, notes + amount in words; Unicode ₹ / PNG / multi-page still BL-025)
- [x] SO + SREQ line snapshots (`hsn`, `taxRate`, `taxTreatment`)
- [x] Quick Bill → same Invoice (`/quick-bill`, `POST /api/quick-bills`)
- [x] E2E multi-tenant (GST + non-GST + composition)

### Phase B — E-invoice

- [x] `einvoiceStatus` incl. `CANCELLED`
- [x] Sandbox IRN `POST /api/invoices/:id/einvoice`
- [x] OPTIONAL = manual Generate IRN; cancel path
- [x] Tenant `tax.nic.mode=DEMO` (default stub) vs `PRODUCTION` (blocked until live NIC)
- [ ] Production NIC IRP credentials + real NIC API
- [ ] QR image on tax-invoice PDF after IRN

### Phase C — E-way

- [x] `ewayStatus` + sandbox `POST /api/invoices/:id/eway`
- [x] Commercial bills reject e-way
- [ ] Dispatch workflow auto-trigger

### Phase D — GSTR-1

- [x] `GET /api/invoices/gstr1-export` JSON + CSV
- [x] Admin page `/gstr1-export`
- [x] Non-GST commercial invoices excluded
- [x] Boundary: export only — no GSTN push

### Phase E — AR + payments

- [x] AR workbench phase 1 on same Invoice (ageing, credit-check, `/ar` UI)
- [ ] Razorpay/UPI allocation

---

## Locked invariants (validated)

1. `NONE` → scheme forced `UNREGISTERED`
2. Invalid GSTIN checksum rejected (tenant + customer)
3. Historical invoice tax does not change when product rate changes
4. POS / buyer GSTIN drives IGST vs CGST+SGST
5. Cross-tenant invoice access denied

---

## How to re-run

```bash
pnpm e2e:gst
# or
pnpm --filter @erp/scripts e2e:gst
```

Provisions three fresh tenants (`gst-none-*`, `gst-reg-*`, `gst-comp-*`), creates customers/products, exercises Quick Bill, IRN, e-way, GSTR-1.

Requires platform operator: `platform@erp.local` / `Platform@123` (or env overrides).
