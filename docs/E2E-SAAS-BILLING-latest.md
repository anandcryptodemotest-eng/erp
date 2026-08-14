# Sankalp SaaS billing E2E

Stamp: mssvd88f
Started: 2026-08-14T11:34:13.743Z
Duration: 12.5s
Result: 25 pass / 0 fail

Provider: DEMO only (no Razorpay HTTP).

## Setup
✓ platform login
✓ provision growth/starter/lifetime tenants

## Plans
✓ growth/starter/lifetime listed — 200
✓ platform creates quarterly plan — 201 pro_q_mssvd88f
✓ duplicate plan code 409 — 409 Plan code already exists
✓ tenant catalog includes new plan — 200

## Free
✓ new tenant is Free (no OMS) — 200 free feats=dashboard,organization,users

## Subscribe
✓ OPEN Growth invoice; still Free until paid — 200 ACTIVE feats=dashboard,organization,users

## Entitlement
✓ Free blocks new SREQ — 403 SAAS_FEATURE
✓ ACTIVE allows SREQ — 201 
✓ unpaid renewal still licensed — 201 SUBSCRIBED

## Capture
✓ demo-pay → PAID + ACTIVE — 200 {"status":"ACTIVE","invoice":"PAID","dup":false}

## OMS
✓ catalog + customer — 201/201

## Idempotency
✓ duplicate demo-pay no-op — 200 {"ok":true,"duplicate":true,"invoice":{"id":"cmssvdauv02tjp101ccx1lxxf","tenantId":"cmssvd8zq0237p101b46mpbsj","subscriptionId":"cmssvd94p025yp10149ta3qt3","planId":"cmsrhpnbi002mod01y9ad5xol","invoiceNumber":"INV-SANKALP-000043","billingPeriodKey":"growth_monthly:2026-08-14_2026-09-13","periodStart":"2026-08-14T11:34:16.940Z","periodEnd":"2026-09-13T11:34:16.940Z","subtotalPaise":50000,"taxPaise":0,"totalPaise":50000,"currency":"INR","status":"PAID","issueDate":"2026-08-14T11:34:17.143Z","dueDate":"2026-09-13T11:34:16.940Z","paidAt":"2026-08-14T11:34:18.030Z","createdAt":"2026-08-14T11:34:17.143Z","updatedAt":"2026-08-14T11:34:18.049Z","plan":{"id":"cmsrhpnbi002mod01y9ad5xol","productId":"cmsrhpn9l0021od011zirse2n","code":"growth_monthly","name":"Growth","billingInterval":"MONTHLY","amountPaise":50000,"currency":"INR","includedSeats":15,"razorpayPlanId":null,"isActive":true,"createdAt":"2026-08-13T12:24:12.366Z","updatedAt":"2026-08-13T12:24:12.366Z"},"subscription":{"id":"cmssvd94p025yp10149ta3qt3","tenantId":"cmssvd8zq0237p101b46mpbsj","planId":"cmsrhpnbi002mod01y9ad5xol","pendingPlanId":null,"status":"ACTIVE","startDate":"2026-08-14T11:34:14.741Z","currentPeriodStart":"2026-08-14T11:34:16.940Z","currentPeriodEnd":"2026-09-13T11:34:16.940Z","nextBillingDate":"2026-09-13T11:34:16.940Z","seatLimit":15,"featureCodes":["oms","quick_bill","inventory","accounting","gst","ar","procurement","portal","dashboard","organization","users"],"lastError":null,"createdAt":"2026-08-14T11:34:14.905Z","updatedAt":"2026-08-14T11:34:18.057Z","plan":{"id":"cmsrhpnbi002mod01y9ad5xol","productId":"cmsrhpn9l0021od011zirse2n","code":"growth_monthly","name":"Growth","billingInterval":"MONTHLY","amountPaise":50000,"currency":"INR","includedSeats":15,"razorpayPlanId":null,"isActive":true,"createdAt":"2026-08-13T12:24:12.366Z","updatedAt":"2026-08-13T12:24:12.366Z"}}},"subscription":{"id":"cmssvd94p025yp10149ta3qt3","tenantId":"cmssvd8zq0237p101b46mpbsj","planId":"cmsrhpnbi002mod01y9ad5xol","pendingPlanId":null,"status":"ACTIVE","startDate":"2026-08-14T11:34:14.741Z","currentPeriodStart":"2026-08-14T11:34:16.940Z","currentPeriodEnd":"2026-09-13T11:34:16.940Z","nextBillingDate":"2026-09-13T11:34:16.940Z","seatLimit":15,"featureCodes":["oms","quick_bill","inventory","accounting","gst","ar","procurement","portal","dashboard","organization","users"],"lastError":null,"createdAt":"2026-08-14T11:34:14.905Z","updatedAt":"2026-08-14T11:34:18.057Z","plan":{"id":"cmsrhpnbi002mod01y9ad5xol","productId":"cmsrhpn9l0021od011zirse2n","code":"growth_monthly","name":"Growth","billingInterval":"MONTHLY","amountPaise":50000,"currency":"INR","includedSeats":15,"razorpayPlanId":null,"isActive":true,"createdAt":"2026-08-13T12:24:12.366Z","updatedAt":"2026-08-13T12:24:12.366Z"}}}

## Period
✓ ACTIVE has period end + next billing date — ACTIVE end=2026-09-13T11:34:16.940Z next=2026-09-13T11:34:16.940Z

## Billing run
✓ lead-window run accepted twice — 200/200
✓ one OPEN renewal invoice; period not extended — open=1 ids=cmssvdcm103ixp101csugze2e periodEnd=2026-09-13T11:34:16.940Z

## Renewal pay
✓ PAID extends period — 200 ACTIVE 2026-10-13T11:34:16.940Z

## Starter
✓ oms SREQ allowed — 201 
✓ quick_bill blocked — 403 SAAS_FEATURE
✓ seat limit 403 — 403 SAAS_SEAT_LIMIT
✓ unpaid after grace downgrades to Free — feats=dashboard,organization,users sreq=403 plan=free_once

## Lifetime
✓ ONCE → perpetual ACTIVE — 200 ACTIVE end=null
✓ billing run does not open another invoice — 200 open=0 ACTIVE

## Provider
✓ DEMO path only (no Razorpay HTTP)
