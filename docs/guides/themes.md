# Themes & density — TrustWood ERP Platform v1.0

Brand themes change **color / gradient / logo / illustrations only**.  
Density changes **control height, padding, row height** independently.

## Markup

```html
<html data-theme="trustwood" data-density="dense" class="erp-canvas">
```

Shared page backdrop: `.erp-canvas` / `--page-bg` in `@erp/ui/tokens.css`.

## Brand themes (`data-theme`)

| Theme | Character | Primary apps |
|-------|-----------|--------------|
| `trustwood` | Premium commerce + **both admin hosts** | Customer, Tenant Admin, **Platform Admin** |
| `platform` | **Deprecated** for admin (remapped to TrustWood) | — |
| `pos` | Counter — near-black / high contrast | POS |
| `delivery` | Field — light canvas / orange accent | Delivery |

Admin differentiation is **nav + permissions + context**, not a second theme (ADR 0015).

Semantic color tokens (same names in every theme):

`--ink` · `--ink-soft` · `--accent` · `--brand` · `--surface` · `--surface-raised` · `--canvas` · `--mist` · `--line` · `--danger` · `--success` · `--warning` · `--info`

Legacy aliases: `--forest`, `--amber`, `--paper`, `--linen`.

## Density (`data-density`)

| Mode | Touch / controls | Use |
|------|------------------|-----|
| `comfortable` | 44px touch | Customer PWA |
| `dense` | 36px controls, tighter radius | Tenant + Platform admin |
| `compact` / `compact-touch` | 48px touch | POS + Delivery |

## App matrix

| App | Theme | Density |
|-----|-------|---------|
| Customer | trustwood | comfortable |
| Gateway `/admin` | trustwood | dense |
| Platform `/platform` | trustwood | dense |
| POS | pos | compact-touch |
| Delivery | delivery | compact-touch |

Customer and both admin hosts share **TrustWood** brand; density differs for commerce vs dense tables.
