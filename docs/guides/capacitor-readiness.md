# Capacitor readiness (scaffold notes)

Wrap the existing Next.js apps — do not fork UI.

## Customer (first)

```bash
# From apps/customer when ready for store builds:
npx cap init "Trust Wood" com.trustwood.customer --web-dir out
# Prefer reverse-proxy to next start origin instead of static export if SSR/API routes are required.
```

Ensure:

- `data-theme` / `data-density` on `<html>`
- Safe-area on BottomNav and sticky CTAs
- Service worker registered only on https / localhost
- API base URL via env for device builds

## POS / Delivery

Same pattern with themes `pos` / `delivery` and density `compact-touch`.
