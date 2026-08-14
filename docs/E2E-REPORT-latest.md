# E2E Report (structured)

| Field | Value |
|-------|-------|
| Environment | http://localhost:3010/admin |
| Tenant | trustwood-enterprise |
| Seed Version | 2026-08-14T11:34:07.579Z |
| Products Created | see seed:demo |
| Groups Created | TRUSTWOOD-* |
| Buyer Created | buyer@trustwood.test |
| Portal | PASS |
| OMS | PASS |
| Images | PASS |
| Checkout | PASS |
| Tax | PASS |
| Conversion | PASS |
| Tracking | PASS |

## Known Gaps

- (none)

## Phase log

```
[PASS] Phase0 Admin login
[PASS] Phase0 Buyer login (CUSTOMER)
[PASS] Phase0 Sales login
[PASS] Phase1 catalog groups present
[PASS] Phase1 phone SKUs TW-PHONE-BLACK-128 / TW-PHONE-BLUE-128
[PASS] Phase1 variant images differ (Black vs Blue)
[PASS] Phase1 blockboard images differ by size
[PASS] Phase1 simple Adhesive SKU found
[PASS] Phase2 customer profile
[PASS] Phase2 address exists
[PASS] Phase2 SREQ SREQ-00013 OPEN
[PASS] Phase2 resolved price propagated to SREQ
[PASS] Phase2 tax=0 (unset GST → 0)
[PASS] Phase2 subtotal≈52299
[PASS] Phase3 converted → SO cmssvd4rp00ayo001h3rwlnmg
[PASS] Phase3 runtime v5
[PASS] Phase3 sales-review completed
[PASS] Phase4 tracking SREQ-00013 status=CONVERTED
[PASS] Phase4 total consistent with checkout
[PASS] Phase4 tax consistent with checkout
```
