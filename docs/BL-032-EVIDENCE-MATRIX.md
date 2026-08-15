# BL-032 Phase 1 — Widget usefulness evidence matrix

Filled after `pnpm e2e:greenfield` **169/169** (tenant `gf-msty99dq`, 2026-08-15) with starter revision 2 layouts.
This matrix gates [BL-033](PRODUCT-BACKLOG.md) new OMS widgets.

| Form | Widget | Actually useful? | Host gap? | Phase 2 needed? |
|------|--------|------------------|-----------|-----------------|
| sales-review | StatusBanner | Yes | — | No |
| sales-review | PriceSummary | Yes | Draft-line total may drift until complete | No |
| inventory | InventoryView | Yes | No `warehouseName` on rows | No |
| procurement | Comments | Yes | Live list refresh only after reload | No |
| pricing | PriceSummary | Yes | — | No |
| warehouse | WarehousePicker | Yes | Wired via `/api/warehouses` | No |
| warehouse | InventoryView | Yes | — | No |
| dispatch | DriverPicker | Partial | Tenant users list may 403 for non-admin; DispatchFulfillment text still works | No (unless driver directory required) |
| dispatch | ExternalLink | Yes | Uses `porterBookUrl` variable | No |
| delivery | FileUpload | Yes | Prior attachments list not hydrated | Signature? — review later |
| delivery | Comments | Yes | Same as procurement | No |
| invoice | PriceSummary | Yes | — | No |
| payment | FormFields (amount/method/ref) | Yes | Fields only — no allocate/ledger UI | PaymentCapture? — only if AR desk needs richer capture |
| customer-checkout | PriceSummary | Yes | Host must supply order totals | No |

**BL-033 candidates (not started):** PaymentCapture (only if payment FormFields prove insufficient in production), SignaturePad (only if FileUpload POD is insufficient). Do not build barcode/credit widgets without a new matrix row.
