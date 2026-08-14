# Tenant GST E2E

Started: 2026-08-14T11:33:57.142Z
Duration: 6.4s
Result: 39 pass / 0 fail

## Platform
✓ operator login

## NonGST
✓ tenant gst-none-mssvcvfa
✓ tax.regime=NONE
✓ NONE forces UNREGISTERED scheme — scheme=UNREGISTERED
✓ product with taxRate (ignored when NONE)
✓ customer with GSTIN (U8)
✓ Quick Bill commercial
✓ documentKind=COMMERCIAL — got COMMERCIAL
✓ tax forced 0% — tax=0
✓ PDF url present — /api/invoices/cmssvcx4v000xpi012f533rcr/pdf

## GST
✓ tenant gst-reg-mssvcvfa
✓ tax profile IN_GST Regular
✓ reject invalid GSTIN checksum — status=400 Invalid GSTIN checksum
✓ product taxRate 18%
✓ B2B customer GSTIN
✓ B2C customer no GSTIN
✓ reject customer bad GSTIN — status=400
✓ B2C Quick Bill
✓ B2C documentKind=TAX_INVOICE — got TAX_INVOICE
✓ B2C supplyType=B2C — got B2C
✓ B2C tax = 180 on 1000@18% — tax=180
✓ B2C CGST+SGST intra-state — cgst=90 sgst=90
✓ B2B Quick Bill
✓ B2B supplyType=B2B — got B2B
✓ B2B IGST inter-state — igst=360 cgst=0
✓ B2B total 2360 — total=2360
✓ snapshot immutability after product 18→12 — status=200 tax=360

## EInvoice
✓ Generate IRN sandbox — irn=SANDBOX-5D0342FC66A2…
✓ Cancel IRN → CANCELLED

## EWay
✓ Generate e-way sandbox — no=EWBD69807DF3F62
✓ Cancel e-way
✓ Commercial bill rejects e-way — status=400

## GSTR1
✓ export JSON — count=2 b2b=1 b2c=1
✓ disclaimer present — Export for tax software / CA — Sankalp does not file returns
✓ non-GST tenant export empty (commercial excluded) — count=0

## Composition
✓ settings COMPOSITION — 200
✓ documentKind=BILL_OF_SUPPLY — got BILL_OF_SUPPLY
✓ output tax 0 — tax=0

## Isolation
✓ cross-tenant invoice denied — status=404
