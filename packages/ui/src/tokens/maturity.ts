/** Component maturity — Stable | Beta | Internal */
export type ComponentMaturity = "stable" | "beta" | "internal";

export const MATURITY = {
  Button: "stable",
  Card: "stable",
  Input: "stable",
  Badge: "stable",
  ProductCard: "stable",
  PageHeader: "stable",
  DataTable: "stable",
  KpiCard: "stable",
  Chip: "beta",
  ChipGroup: "beta",
  ProductGallery: "beta",
  PriceDisplay: "beta",
  QuantityStepper: "beta",
  StockBadge: "beta",
  BottomNav: "beta",
  SearchBar: "beta",
  SectionHeader: "beta",
  Skeleton: "beta",
  CartSummary: "beta",
  RouteCard: "beta",
  DeliveryStatus: "beta",
  SignaturePad: "internal",
  ChartSlot: "internal",
} as const satisfies Record<string, ComponentMaturity>;
