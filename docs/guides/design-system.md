# Design system — Sankalp Design System v2

**Status:** Shipped (BL-022, 2026-08-13) — `@erp/ui` is live across Gateway, Platform, Customer, Delivery, POS  
**Package:** `@erp/ui` is the **single source of truth** for tokens, shell, primitives, motion, and page scaffolds.

## Architecture (correct dependency)

```text
                 @erp/ui
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  Tokens         Shell        Primitives
     │              │              │
     └──────────────┼──────────────┘
                    │
               Scaffolds
                    │
    ┌───────────────┼────────────────┐
    │               │                │
 Gateway         Platform         Customer
                    │
              Delivery / POS
```

**Forbidden:** apps inventing custom tokens, status colors, heroes, shells, or button styles.

## Package layout

```text
packages/ui/
├── tokens/       v2 foundation + themes + density (tokens.css) + .erp-canvas
├── shell/        AdminShell + admin-shell.css
├── primitives/   Button, Skeleton, StatusChip, ActionGroup
├── workspace/    PageScaffold, WorkspaceHero, WorkspaceLayout
├── layout/       BottomNav (mobile/app)
├── commerce/     ProductCard, Gallery, Price, Chip
├── studio/       Studio Kernel + renderers
└── index.ts
```

## Frozen Phase 0 APIs

| API | Use |
|-----|-----|
| CSS tokens in `tokens.css` | Colors, elevation 0–4, radius, motion, focus, density |
| `AdminShell` | Only admin navigation chrome (Gateway + Platform) |
| `BottomNav` | Mobile/app primary nav |
| `Button` | primary / secondary / ghost / danger |
| `Input` / `Select` / `Tabs` / `Modal` | Shared controls |
| `StatusChip` | All status labels (no Tailwind status colors) |
| `EmptyState` / `Skeleton` | Empty + loading |
| `WorkspaceHero` + `PageScaffold` | List/ops page chrome |

`PageHeader` is **deprecated**. Existing usage on v2 routes **must migrate** to `PageScaffold` + `WorkspaceHero`. No new page-specific headers.

## v2 token contract (board)

| Token | Value |
|-------|-------|
| Brand | `#0B5E3C` / dark `#084031` / light `#B6F3BC` |
| Accent | `#F5B33D` (sparse) |
| Success / Warning / Error / Info | `#16A34A` / `#F59E0B` / `#DC2626` / `#0EA5E9` |
| Ink / Line | `#374151` / `#E5E7EB` |
| Surfaces | White raised on soft green-tinted canvas |
| Elevation | `--shadow-0` … `--shadow-4` |
| Radius | 4 / 8 / 12 / 16 / 24 / full |
| Type | Fraunces display · Outfit body |
| Motion | fast 150 · standard 220 · slow 320; press `scale(0.97)`; honor `prefers-reduced-motion` |

## Visual Anti-Patterns — v2

**Never introduce:**

- Purple / indigo as primary UI colors
- Blue Tailwind status badges
- Beige / cream / terracotta canvas
- Glassmorphism
- Excessive gradients
- Excessive rounded cards
- Card-inside-card-inside-card layouts
- Heavy borders around every section
- Page-specific hero/header implementations
- Page-specific status colors
- Emoji as primary UI icons
- Large decorative illustrations in operational screens
- Excessive animation
- Layout shifts during loading
- Different navigation patterns between Gateway and Platform
- Different button/input/chip styling between apps
- Desktop-only interaction patterns in responsive views

Anti-patterns are **hard fails** on migration review.

## Screen patterns (ADR 0014)

| Pattern | Use for |
|---------|---------|
| **Studio** | Multi-step authoring |
| **Form Page** | Medium dedicated forms |
| **Modal Form** | Lightweight CRUD on lists |
| **Workspace** | Lists / queues / dashboards — `PageScaffold` + `WorkspaceHero` |

## Ownership

| Owner | Owns |
|-------|------|
| `@erp/ui` | Tokens, shell, primitives, scaffolds, themes |
| Apps | Composition, domain hooks, APIs only |

## Icons

**Lucide only** for UI chrome.

## Related

- [themes.md](./themes.md)
- [app-guidelines.md](./app-guidelines.md)
- [ADR 0014](../adr/0014-erp-ui-framework-classification.md)
- [ADR 0015](../adr/0015-trustwood-erp-platform-v1.md) (v1 → v2 addendum: same one-brand AdminShell; tokens/primitives upgraded)
- Master plan: Design System v2 execution (BL-022)
