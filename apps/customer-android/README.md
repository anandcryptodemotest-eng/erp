# @erp/customer-android

A **Capacitor remote-WebView shell** around the existing Next.js customer portal
(`apps/customer`). The app loads the live portal over HTTPS — **Next.js is not
bundled into the APK**, and no catalog / cart / auth / tenant / OMS logic lives
here. This package is intentionally thin.

> Architecture is locked. See **`docs/CUSTOMER-ANDROID-APK.md`** before changing
> anything here.

```
Android
  │
Capacitor shell  (this package — no business logic)
  │  HTTPS
Next.js customer portal  (apps/customer)
  │  /api/*
Gateway → OMS / Auth
```

## Capacitor version

Pinned exactly (no `^` / `~`). Capacitor's **core** packages share one version
line; the **plugins** are versioned independently, so they do not all share a
single `X.Y.Z` (the contract predates that split). Each is pinned to its exact
latest v8 release:

```
Capacitor core:  8.5.3   (@capacitor/core, @capacitor/android, @capacitor/cli)
@capacitor/app:            8.1.2
@capacitor/status-bar:     8.0.4
@capacitor/splash-screen:  8.0.2
```

Bump these deliberately and re-run `pnpm release:check` after any change.

## Environments

Set `CAPACITOR_SERVER_URL` before `sync` / build. Must be `https://` — the config
and the release guard both reject `http://`, raw IPs, and (for releases) the
staging host.

| Environment | `CAPACITOR_SERVER_URL` |
| ----------- | ---------------------- |
| Development | `https://staging-customer.sankalpplatforms.com` |
| Test        | `https://customer.sankalpplatforms.com/login?tenant=gf-mskn4dia` |
| Production  | `https://customer.sankalpplatforms.com` (default) |

App id: `com.sankalp.erp.customer` · `versionName` 1.0.0 · `versionCode` starts at
1 and must increment on every Play Store upload.

## Prerequisites (local machine only)

The native steps below need a toolchain that is **not** present in CI sandboxes:

- Node 20+ and `pnpm` (workspace package manager)
- JDK 21 (Capacitor 8 / modern Android Gradle Plugin)
- Android SDK (via Android Studio), with `ANDROID_HOME` / `ANDROID_SDK_ROOT` set

## Build & run sequence

```bash
# from repo root — installs Capacitor into the workspace
pnpm install

# 1. Generate the native Android project (first time only; commits under android/)
pnpm --filter @erp/customer-android add:android

# 2. Point the shell at an environment and copy config into the native project
CAPACITOR_SERVER_URL=https://staging-customer.sankalpplatforms.com \
  pnpm --filter @erp/customer-android sync

# 3a. Debug APK (device/emulator testing)
pnpm --filter @erp/customer-android apk:debug
#    → android/app/build/outputs/apk/debug/app-debug.apk

# 3b. Open in Android Studio instead (signing config, emulator, etc.)
pnpm --filter @erp/customer-android open:android
```

### Test checklist (step 5 of the contract)

Install the debug APK and verify against the test tenant
(`?tenant=gf-mskn4dia`): login, catalog browse, product detail, cart, and placing
a sales request — all served by the remote portal, nothing re-implemented here.

## Release (AAB for Play Store)

```bash
# Hard-fails on http://, raw IP, staging host, debug TLS trust, wrong appId,
# or a non-positive versionCode. Run it standalone first:
pnpm --filter @erp/customer-android release:check

# Build the signed release bundle (runs release:check first):
pnpm --filter @erp/customer-android aab:release
#    → android/app/build/outputs/bundle/release/app-release.aab
```

Signing is configured in Android Studio (keystore + `keystore.properties`), which
is git-ignored. Never commit keystores.

## What must NOT go here

Adding catalog, cart, authentication, tenant resolution, offline storage, or OMS
calls to this package violates the locked contract. Those belong in `apps/customer`
and are reached over HTTPS. Push / native storage are explicitly deferred.
