# Sankalp Customer APK — locked engineering contract

**Status:** Architecture LOCKED · Implementation READY · Security GOOD · RN LOCKED OUT

## Acceptance criterion

Build an Android application that is a secure Capacitor shell around the existing Sankalp Next.js customer portal, without duplicating customer UI or business logic, using only the approved HTTPS customer hostname in production.

## Locked architectural decisions

| Decision | Locked |
|----------|--------|
| Customer UI | Existing Next.js (`apps/customer`) |
| Android technology | Capacitor |
| React Native | No |
| Next.js rewrite | No |
| Next.js bundled into APK | No |
| Remote WebView | Yes |
| Remote URL | HTTPS only |
| Production host | `customer.sankalpplatforms.com` |
| Production TLS | CA-signed |
| Raw IP | No (production) |
| HTTP | No |
| `www/` | Minimal Capacitor placeholder |
| Tenant logic | Existing Next.js tenant layer |
| Test tenant | `gf-mskn4dia` via `?tenant=` |
| Production tenant | Organization selector (follow-on) |
| OMS logic | Server-side |
| Offline | No in v1 |
| Admin APK | No |
| Push | Later |
| Native storage | Later |
| Android project | Committed under `apps/customer-android/android/` |
| Release guard | Mandatory |
| AAB | Required for Play Store |

## Architecture boundary

```
ANDROID
   │
Capacitor Shell  (no OMS / auth / catalog / cart / tenant logic)
   │
 HTTPS
   │
Next.js Customer Portal  (apps/customer)
   │
 /api/*
   │
Gateway → OMS / Auth
```

The Capacitor layer must **not** become a second application. Adding catalog, cart, authentication, tenant resolution, or OMS calls inside the Android project violates this contract.

## Capacitor version policy

At implementation start, pin one stable Capacitor release **exactly** (no `^` / `~`) and record it in `apps/customer-android/README.md`:

```
Capacitor version: <X.Y.Z>
```

All of `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen` must use that same `X.Y.Z`.

## Monorepo layout

```
apps/customer-android/
├── package.json
├── capacitor.config.ts
├── www/
│   └── index.html          # placeholder only
├── android/                # committed
└── README.md
```

- Exclude from Next.js / turbo `build`, `lint`, `typecheck`.
- Gitignore only `local.properties`, keystores, `keystore.properties`.

## Environments (`CAPACITOR_SERVER_URL`)

| Environment | URL |
|-------------|-----|
| Development | `https://staging-customer.sankalpplatforms.com` |
| Test | `https://customer.sankalpplatforms.com/login?tenant=gf-mskn4dia` |
| Production | `https://customer.sankalpplatforms.com` |

## Release guard + AAB inspection

Before accepting a production AAB:

1. `release:check`
2. Approved HTTPS hostname?
3. No debug network config?
4. No staging URL?
5. No raw IP?
6. Application ID = `com.sankalp.erp.customer`?
7. Valid `versionCode`?
8. Then `bundleRelease`

Hard-fail on `http://`, raw IP, staging host, or self-signed debug trust left enabled.

## Android versioning

- `versionName = "1.0.0"` — customer-facing
- `versionCode = 1` — increment every Play Store upload

## Implementation sequence

1. Create Capacitor package  
2. Generate Android project  
3. Configure HTTPS remote URL  
4. Build debug APK  
5. Test tenant / login / catalog / SREQ  
6. Harden Android shell (back, splash, status bar, network errors)  
7. Configure signing  
8. `release:check` → AAB  
9. Internal Play testing  
10. Production  

## Out of scope (v1)

- React Native / Expo  
- Next.js rewrite or packaging Next into `webDir`  
- Native OMS / offline catalog  
- Admin desk APK  
- Permanent single-tenant bake in the store binary  

## Related

- Customer portal: `apps/customer`
- Platform adapters: `apps/customer/src/lib/tenant.ts`, `apps/customer/src/lib/platform`
- UI roadmap (Capacitor wrap): `docs/SANKALP-UI-UX-ROADMAP.md`
