import {
  Boxes,
  ClipboardList,
  IndianRupee,
  ListOrdered,
  Package,
  Receipt,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { KpiCardProps } from "../kpi-card";
import { formatInr } from "./ops-attention";

export type OpsKpi = {
  revenue?: number;
  salesOrders?: number;
  sreqs?: number;
  sreqsOpen?: number;
  openTasks?: number;
  customers?: number;
  todaySales?: number;
  mySreqs?: number;
  myOrders?: number;
  myTasks?: number;
  priceLists?: number;
  priceUpdates?: number;
  priceRequests?: number;
  pendingDispatches?: number;
  todayDispatches?: number;
  delayedOrders?: number;
  outForDelivery?: number;
  deliveredToday?: number;
  delayedDeliveries?: number;
  pendingInvoices?: number;
  receivables?: number;
  overdueReceivables?: number;
  toCollect?: number;
  payments?: number;
  products?: number;
  categories?: number;
  brands?: number;
  attributes?: number;
};

export type OpsKpiVariant =
  | "admin"
  | "sales"
  | "pricing"
  | "dispatch"
  | "delivery"
  | "accountant"
  | "catalog";

export type OpsKpiSpec = {
  label: string;
  value: string;
  href: string;
  subtext?: string;
  icon: LucideIcon;
  color: NonNullable<KpiCardProps["color"]>;
  /** 12-col span. Admin cockpit hero is wider; other variants omit this. */
  span?: number;
};

export function kpisForVariant(variant: OpsKpiVariant, k?: OpsKpi): OpsKpiSpec[] {
  switch (variant) {
    case "sales":
      return [
        { label: "Today's sales", value: formatInr(k?.todaySales ?? 0), href: "/admin/analytics", icon: IndianRupee, color: "amber" },
        { label: "Open SREQs", value: String(k?.mySreqs ?? 0), href: "/admin/sales-desk", icon: ClipboardList, color: "indigo" },
        { label: "Orders", value: String(k?.myOrders ?? 0), href: "/admin/sales-desk", icon: ShoppingCart, color: "emerald" },
        { label: "My tasks", value: String(k?.myTasks ?? 0), href: "/admin/sales-desk", icon: ListOrdered, color: "violet" },
      ];
    case "pricing":
      return [
        { label: "Price lists", value: String(k?.priceLists ?? 0), href: "/admin/price-lists", icon: Tag, color: "indigo" },
        { label: "Updated (7d)", value: String(k?.priceUpdates ?? 0), href: "/admin/price-lists", icon: Receipt, color: "amber" },
        { label: "Price requests", value: String(k?.priceRequests ?? 0), href: "/admin/price-lists", icon: ClipboardList, color: "slate" },
        { label: "Open tasks", value: String(k?.openTasks ?? 0), href: "/admin/sales-desk", icon: ListOrdered, color: "violet" },
      ];
    case "dispatch":
      return [
        { label: "Pending dispatch", value: String(k?.pendingDispatches ?? 0), href: "/admin/sales-desk", icon: Package, color: "indigo" },
        { label: "Dispatched today", value: String(k?.todayDispatches ?? 0), href: "/admin/sales-desk", icon: Truck, color: "emerald" },
        { label: "Delayed", value: String(k?.delayedOrders ?? 0), href: "/admin/sales-desk", icon: ClipboardList, color: "red" },
      ];
    case "delivery":
      return [
        { label: "Out for delivery", value: String(k?.outForDelivery ?? 0), href: "/admin/sales-desk", icon: Truck, color: "blue" },
        { label: "Delivered today", value: String(k?.deliveredToday ?? 0), href: "/admin/sales-desk", icon: Package, color: "emerald" },
        { label: "Delayed", value: String(k?.delayedDeliveries ?? 0), href: "/admin/sales-desk", icon: ClipboardList, color: "red" },
      ];
    case "accountant":
      return [
        { label: "Invoices", value: String(k?.pendingInvoices ?? 0), href: "/admin/invoices", icon: Receipt, color: "indigo" },
        { label: "Receivables", value: formatInr(k?.receivables ?? 0), href: "/admin/invoices", icon: IndianRupee, color: "amber" },
        { label: "Payments", value: formatInr(k?.payments ?? 0), href: "/admin/invoices", icon: IndianRupee, color: "emerald" },
      ];
    case "catalog":
      return [
        { label: "Products", value: String(k?.products ?? 0), href: "/admin/products", icon: Package, color: "indigo" },
        { label: "Categories", value: String(k?.categories ?? 0), href: "/admin/categories", icon: Boxes, color: "violet" },
        { label: "Brands", value: String(k?.brands ?? 0), href: "/admin/brands", icon: Tag, color: "amber" },
        { label: "Attributes", value: String(k?.attributes ?? 0), href: "/admin/attributes", icon: ListOrdered, color: "slate" },
      ];
    default: {
      const overdue = k?.overdueReceivables ?? 0;
      const toCollect = k?.toCollect ?? k?.receivables ?? 0;
      const heroValue = overdue > 0 ? overdue : toCollect;
      const subtext =
        overdue > 0
          ? `${formatInr(toCollect)} outstanding · ${formatInr(k?.revenue ?? 0)} revenue`
          : `Revenue this period ${formatInr(k?.revenue ?? 0)}`;
      return [
        {
          label: "To collect / overdue receivables",
          value: formatInr(heroValue),
          href: "/admin/ar",
          icon: IndianRupee,
          color: overdue > 0 ? "red" : "amber",
          subtext,
          span: 6,
        },
        {
          label: "Orders",
          value: String(k?.salesOrders ?? 0),
          href: "/admin/sales-desk",
          icon: ShoppingCart,
          color: "emerald",
          span: 2,
        },
        {
          label: "To fulfil",
          value: String(k?.pendingDispatches ?? 0),
          href: "/admin/sales-desk",
          icon: Package,
          color: "indigo",
          span: 2,
        },
        {
          label: "Open tasks",
          value: String(k?.openTasks ?? 0),
          href: "/admin/sales-desk",
          icon: ListOrdered,
          color: "violet",
          span: 2,
        },
      ];
    }
  }
}
