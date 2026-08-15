# Tenant GST — E2E validation checklist

Generated: 2026-08-15T14:04:11.139Z
Score: **39/39**

| Section | Check | Status | Detail |
|---------|-------|--------|--------|
| Platform | operator login | PASS |  |
| NonGST | tenant gst-none-msug5sin | PASS |  |
| NonGST | tax.regime=NONE | PASS |  |
| NonGST | NONE forces UNREGISTERED scheme | PASS | scheme=UNREGISTERED |
| NonGST | product with taxRate (ignored when NONE) | PASS |  |
| NonGST | customer with GSTIN (U8) | PASS |  |
| NonGST | Quick Bill commercial | PASS |  |
| NonGST | documentKind=COMMERCIAL | PASS | got COMMERCIAL |
| NonGST | tax forced 0% | PASS | tax=0 |
| NonGST | PDF url present | PASS | /api/invoices/cmsug5u9b000dlo015xq19023/pdf |
| GST | tenant gst-reg-msug5sin | PASS |  |
| GST | tax profile IN_GST Regular | PASS |  |
| GST | reject invalid GSTIN checksum | PASS | status=400 Invalid GSTIN checksum |
| GST | product taxRate 18% | PASS |  |
| GST | B2B customer GSTIN | PASS |  |
| GST | B2C customer no GSTIN | PASS |  |
| GST | reject customer bad GSTIN | PASS | status=400 |
| GST | B2C Quick Bill | PASS |  |
| GST | B2C documentKind=TAX_INVOICE | PASS | got TAX_INVOICE |
| GST | B2C supplyType=B2C | PASS | got B2C |
| GST | B2C tax = 180 on 1000@18% | PASS | tax=180 |
| GST | B2C CGST+SGST intra-state | PASS | cgst=90 sgst=90 |
| GST | B2B Quick Bill | PASS |  |
| GST | B2B supplyType=B2B | PASS | got B2B |
| GST | B2B IGST inter-state | PASS | igst=360 cgst=0 |
| GST | B2B total 2360 | PASS | total=2360 |
| GST | snapshot immutability after product 18→12 | PASS | status=200 tax=360 |
| EInvoice | Generate IRN sandbox | PASS | irn=SANDBOX-2CBA2516877C… |
| EInvoice | Cancel IRN → CANCELLED | PASS |  |
| EWay | Generate e-way sandbox | PASS | no=EWB0DAF0CD3E3F3 |
| EWay | Cancel e-way | PASS |  |
| EWay | Commercial bill rejects e-way | PASS | status=400 |
| GSTR1 | export JSON | PASS | count=2 b2b=1 b2c=1 |
| GSTR1 | disclaimer present | PASS | Export for tax software / CA — Sankalp does not file returns |
| GSTR1 | non-GST tenant export empty (commercial excluded) | PASS | count=0 |
| Composition | settings COMPOSITION | PASS | 200 |
| Composition | documentKind=BILL_OF_SUPPLY | PASS | got BILL_OF_SUPPLY |
| Composition | output tax 0 | PASS | tax=0 |
| Isolation | cross-tenant invoice denied | PASS | status=404 |

## Use-case coverage

| ID | Scenario | Covered |
|----|----------|---------|
| U1 | Non-GST tenant commercial bill | Yes |
| U2 | GST Regular B2B tax invoice | Yes |
| U3 | OPTIONAL e-invoice Generate IRN | Yes |
| U5 | GST B2C tax invoice | Yes |
| U8 | Non-GST sells to GST dealer | Yes |
| U9 | Quick Bill same Invoice | Yes |
| D | GSTR-1 export | Yes |
| C | E-way sandbox | Yes |
