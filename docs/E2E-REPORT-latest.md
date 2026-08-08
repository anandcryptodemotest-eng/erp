# E2E Report (structured)

| Field | Value |
|-------|-------|
| Environment | http://localhost:3010/admin |
| Tenant | trustwood-enterprise |
| Seed Version | 2026-08-07T20:12:03.113Z |
| Products Created | see seed:demo |
| Groups Created | TRUSTWOOD-* |
| Buyer Created | buyer@trustwood.test |
| Portal | PASS |
| OMS | FAIL |
| Images | PASS |
| Checkout | FAIL |
| Tax | FAIL |
| Conversion | FAIL |
| Tracking | FAIL |

## Known Gaps

- [FAIL] Phase1 simple Adhesive missing

## Phase log

```
[PASS] Phase0 Admin login
[PASS] Phase0 Buyer login (CUSTOMER)
[PASS] Phase0 Sales login
[PASS] Phase1 catalog groups present
[PASS] Phase1 phone SKUs TW-PHONE-BLACK-128 / TW-PHONE-BLUE-128
[PASS] Phase1 variant images differ (Black vs Blue)
[PASS] Phase1 blockboard images differ by size
[FAIL] Phase1 simple Adhesive missing
```
