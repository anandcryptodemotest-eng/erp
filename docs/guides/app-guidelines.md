# App guidelines — PWA & Capacitor-ready

Every human UI app should support installable / wrap-ready shells without forking UI.

## Apps

| App | Port | Shell |
|-----|------|--------|
| Customer | 3007 | PWA + Capacitor-ready |
| POS | 3008 | PWA + Capacitor-ready |
| Delivery | 3009 | PWA + Capacitor-ready |
| Gateway | admin | Web (dense) |
| Platform | 3011 | Web (dense) |

## PWA checklist (customer / POS / delivery)

- [x] `manifest.json` with name, theme_color, icons  
- [ ] Install prompt UX (browser-native is fine)  
- [x] Update notification (customer `PwaRegister`; extend to POS/delivery as needed)  
- [x] Offline shell (customer `offline.html` + `sw.js`; mirror for field apps when wrapping)  
- [x] Safe-area insets (`env(safe-area-inset-*)`)  
- [ ] Pull-to-refresh: prefer explicit Refresh actions in field/POS; avoid fighting browser PTR on iOS  
- [x] Loading skeletons (`Skeleton` / app-local shimmer)

## Capacitor readiness

Do **not** fork UI for native. Wrap the same Next origin when store builds are required.

Constraints:

1. Same-origin HTTPS (or configured allow-navigation)  
2. Relative API paths or env-based base URL  
3. Safe-area padding on sticky nav / CTAs  
4. No desktop-only hover-only actions for primary flows  
5. Touch targets ≥ `--touch-min` (foundation / density)  
6. Avoid `window`-only APIs without guards  

- [Capacitor readiness notes](./capacitor-readiness.md)  


| Surface | Layout token |
|---------|----------------|
| Customer mobile | Compact / Wide content |
| Customer desktop | `--layout-wide` in portal frame |
| Admin | `--layout-full`, dense tables |
| POS | Full viewport counter |
| Delivery | Compact single column |

## Related

- [design-system.md](./design-system.md)  
- [themes.md](./themes.md)  
