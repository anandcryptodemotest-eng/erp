# AR workbench (P0.2) — checklist

**Status:** Phase 1 shipped (same `Invoice` as OMS / Quick Bill)  
**Date:** 2026-08-13

## Done

- [x] `GET /api/ar/ageing` — outstanding + buckets (current / 1–30 / 31–60 / 61–90 / 90+)
- [x] `POST /api/ar/credit-check` — exposure for convert / Quick Bill
- [x] Admin **Receivables** UI `/ar` — ageing cards + record payment
- [x] Credit block on SREQ convert + Quick Bill when `creditLimit > 0`
- [x] Invoice due date from `Customer.paymentTerms`
- [x] Gateway rewrite `/api/ar/*` → accounting

## Pending (next AR slices)

- [ ] Multi-invoice payment allocation / unapplied cash
- [ ] Collection queue + promise-to-pay notes
- [ ] Accountant dashboard widgets (ageing KPIs)
- [ ] Portal “pay outstanding” (P0.3 Razorpay)
- [ ] Overdue job to flip status → OVERDUE

## Tax note

NIC stays **DEMO/stub** per tenant (`tax.nic.mode=DEMO`). Production IRP when credentials arrive.
