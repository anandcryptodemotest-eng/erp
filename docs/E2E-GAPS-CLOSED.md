# E2E Product Gaps — Closed

This document records the nine end-to-end gaps that were closing the loop on the
fruit-seller / grocery use case (**Simhapuri Fresh**, a sell-by-weight produce
seller), the fix for each, how to verify it against a live local stack, and the
production environment variables required to move each fix from dev-mode to a
real external integration.

Each gap was fixed as a real wiring/feature change (not a stub) and verified
against a running stack. See [FRUIT-SELLER-DEMO.md](./FRUIT-SELLER-DEMO.md) for
how to boot the stack.

---

## Verification — current status

All five suites pass against the live stack (run from `scripts/`):

| Suite | Script | Result |
| --- | --- | --- |
| Staff order lifecycle | `verify-fruit-seller.ts` | **19/19** |
| Customer storefront (portal) | `verify-portal-fruit-seller.ts` | **25/25** |
| Online order payment | `verify-payment.mjs` | **10/10** |
| Delivery tracking + POD | `verify-delivery-tracking.mjs` | **6/6** |
| Customer returns | `verify-returns.mjs` | **7/7** |

Run them all:

```bash
# Node 20 via nvm; services already running (see FRUIT-SELLER-DEMO.md)
export PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH
export SERVICE_SECRET=dev-service-secret
cd scripts
for s in verify-fruit-seller.ts verify-portal-fruit-seller.ts \
         verify-payment.mjs verify-delivery-tracking.mjs verify-returns.mjs; do
  echo "== $s =="; node_modules/.bin/tsx "$s" | tail -2
done
```

> **Note on FEFO assertions.** The staff and portal suites assert that the
> earliest-expiry lot (`*-LOT-A`, seeded at 20 kg, T+1d expiry) is consumed
> first. These lots are shared, stateful test data — after many runs a lot can
> be fully drained, and the FEFO assertion then reports `LOT-A 0 -> 0`. That is
> depleted test stock, not a regression. Re-seed or top up the lot:
>
> ```bash
> node_modules/.bin/tsx seed-fruit-seller.ts   # idempotent; no-op if already seeded
> # or receive a fresh LOT-A with a new idempotencyKey (see scripts history)
> ```

---

## The nine fixes

### 1. Own-fleet auto driver-assignment
**Was:** dispatch posted `{salesOrderId, driverId, vehicleInfo}` to the delivery
service, but the delivery endpoint required `{orderId, orderNumber, executiveId}`
plus a mandatory HR-employee check — and sales swallowed the resulting error in a
bare `catch {}`, so no assignment was ever created.

**Now:**
- `apps/delivery/src/app/api/assignments/route.ts` accepts both payload shapes
  (maps `salesOrderId→orderId`, `driverId→executiveId`), derives `orderNumber`
  from the sales order when omitted, folds `vehicleInfo` into notes, and dedups an
  existing open assignment. HR verification is strict for a human dispatcher but
  best-effort for service-key calls (an own-fleet driver need not be an HR
  employee).
- `apps/sales/src/workflow-adapter/sales-order-adapter.ts` sends the correct
  payload and no longer swallows the error — it logs a warning and surfaces
  `deliveryAssignmentId` / `deliveryAssignmentWarning`.

### 2. Buyer order notifications over SMS / WhatsApp / push
**Was:** `apps/sales/src/lib/notify-customer.ts` hardcoded `channels: ["IN_APP"]`,
so buyers only ever got in-app notifications.

**Now:** notifications default to `["IN_APP", "SMS", "WHATSAPP", "FCM"]` and pass
the customer phone. The gateway resolves phone/email from the user record and
filters to tenant-enabled channels; unconfigured channels degrade gracefully
(recorded as `DEMO`/`SKIPPED`, never a hard failure). Buyer events wired:
`ORDER_PLACED`/`ORDER_CONFIRMED`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED`,
`ORDER_PAID`, `ORDER_CANCELLED`, `ORDER_UPDATED`.

### 3. OTP delivery fallback (phone login without WhatsApp)
**Was:** `otp-service.ts` sent OTP only over WhatsApp and threw a 503 when
WhatsApp was unconfigured, blocking phone login out of the box.

**Now:** a delivery chain — (1) configured provider, (2) generic Fast2SMS quick
SMS, (3) dev mode. Dev mode is **on by default outside production**
(`NODE_ENV !== production` and `OTP_DEV_MODE` unset) and returns a `devCode` in the
response so phone login works immediately; it is **off in production** unless
explicitly enabled. The hashed-challenge security model is unchanged.

### 4. Self-serve signup routed through provisioning
**Was:** self-serve registration created a bare tenant with a `core`-only module
license — no inventory/sales modules, no order workflow, no warehouse — so a new
tenant couldn't actually transact.

**Now:** a shared `provisionTenant()` helper
(`apps/gateway/src/lib/provision-tenant.ts`) is used by both the platform-operator
route and self-serve signup. It creates the tenant, admin user, module licenses,
default branch, order workflow, and seed warehouse, then drains onboarding
reconciliation. The `general` vertical was upgraded from core-only to
core/inventory/sales + OMS workflow + seed warehouse.

### 5. Removed hardcoded `TAX_RATE = 0.10` fallback
**Was:** returns and procurement fell back to `process.env.TAX_RATE ?? "0.10"` — a
flat 10% applied to any line without an explicit rate.

**Now:** tax is taken from the real per-line rate — the original order item's
`taxRate` for returns, the caller-supplied rate for quotes and POs, the PO's
effective rate for procurement returns — defaulting to `0`, never 10%.
Authoritative GST is still computed at invoice time via `@erp/tax-india`.

### 6. Online payment for customer orders (PSP + dev-mode)
**Was:** checkout stored a payment-method string only; nothing collected money on
the order amount.

**Now:** an `OrderPayment` model in sales plus pay/verify endpoints. The gateway
owns the PSP (Razorpay) SDK: it creates a provider order on the amount due and
verifies the HMAC signature; sales persists the `OrderPayment`, marks the order
`PAID`, and records the payment against the accounting invoice. **Dev mode** (no
Razorpay keys) simulates the provider order and auto-settles so the prepaid flow
is demoable end to end. (Sales intentionally has no Razorpay dependency — PSP SDK
calls happen only in the gateway.)

### 7. Instant online order (no mandatory staff conversion)
**Was:** customer checkout created a Sales Request that a staff member had to
convert to a sales order before anything happened.

**Now:** an online/customer sales request auto-confirms to a `CONFIRMED` sales
order immediately (reserving stock) and returns the order so the storefront shows
instant confirmation and can trigger payment. It's best-effort: on failure the
request stays open for staff review. The staff `convert` endpoint is now
idempotent (returns 200 when already converted). COD and prepaid both work.

### 8. Delivery live tracking + proof-of-delivery
**Was:** no driver location capture and no proof-of-delivery.

**Now:** `POST/GET /api/assignments/:id/tracking` appends and reads GPS pings
(blocked once delivered). Proof-of-delivery (photo URL, signature URL, recipient
name, notes) is captured on the `DELIVERED` transition via new POD columns on
`DeliveryAssignment`. The assignment PATCH persists the local status + POD first,
then best-effort syncs sales (a sales 404 no longer loses the POD). A gateway
portal route exposes tracking to the buyer's order page.

### 9. Customer-initiated returns
**Was:** returns could only be opened by staff, and the quantity gate required
`quantity <= shippedQty` — but the grocery flow deducts stock at dispatch and
leaves `shippedQty = 0`, so produce could never be returned.

**Now:** the returns endpoint accepts role `CUSTOMER` (scoped to the buyer's own
order via `portalUserId` ownership — 403 otherwise), the returnable statuses
include `DELIVERED`/`PAID`/`CLOSED`, and the quantity gate uses
`shippedQty > 0 ? shippedQty : orderedQty`. A gateway portal route
(`POST /api/portal/orders/:id/return`) lets the storefront open a `PENDING`
return that feeds the existing staff approve → complete (restock + credit note)
flow unchanged.

---

## Production environment variables

Each fix ships a safe dev-mode default. To enable the real external integration
in production, set:

| Fix | Variable(s) | Where | Effect when set |
| --- | --- | --- | --- |
| #6 Online payment | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | gateway **and** sales | Live Razorpay orders + HMAC signature verification instead of dev simulation. |
| #3 OTP login | `OTP_DEV_MODE=false` | gateway | Turns off the dev `devCode` in responses (it is already off when `NODE_ENV=production`). |
| #2 / #3 SMS + WhatsApp | Fast2SMS credentials (per tenant integration config) | gateway | Real SMS/WhatsApp delivery instead of `DEMO` records. |
| #2 Push | `FIREBASE_SERVER_KEY` (+ device FCM tokens) | gateway | Real FCM push instead of `SKIPPED`. |

General production notes:
- Set `NODE_ENV=production` so dev-mode shortcuts (OTP devCode, payment
  simulation) are disabled by default.
- Provide a real object store / CDN URL for POD photo & signature uploads (#8).
- Keep `SERVICE_SECRET` and `JWT_SECRET` as strong per-environment secrets.
