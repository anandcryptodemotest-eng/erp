"use client";
import { useEffect, useState } from "react";
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
import { KpiCard, type KpiCardProps } from "../../kpi-card";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type OpsKpi = {
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
  payments?: number;
  products?: number;
  categories?: number;
  brands?: number;
  attributes?: number;
};

type ActivityRow = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  href: string;
  at?: string;
};

type SreqRow = {
  id: string;
  requestNumber: string;
  status: string;
  total: number;
  customerName: string;
  createdAt?: string;
  salesOrderId?: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  createdAt?: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  action?: string;
  salesOrderId?: string;
  orderNumber?: string;
  dueAt?: string;
};

type CustomerRow = { id: string; name: string; email?: string; phone?: string };
type PriceListRow = { id: string; name: string; isDefault?: boolean; updatedAt?: string };
type ProductRow = { id: string; name: string; sku?: string };

type OpsSummary = {
  kpis?: OpsKpi;
  activity?: ActivityRow[];
  sreqs?: SreqRow[];
  orders?: OrderRow[];
  tasks?: TaskRow[];
  customers?: CustomerRow[];
  priceLists?: PriceListRow[];
  products?: ProductRow[];
};

type Variant =
  | "admin"
  | "sales"
  | "pricing"
  | "dispatch"
  | "delivery"
  | "accountant"
  | "catalog";

function money(v?: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v ?? 0);
}

function useOpsSummary(fetchData: WidgetProps["fetchData"]) {
  const [data, setData] = useState<OpsSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: OpsSummary }>("/api/dashboard/ops-summary").then((res) => {
      if (!alive) return;
      if (!res) return setError("Dashboard summary unavailable");
      setData(res.data ?? res);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  return { data, error };
}

type KpiSpec = {
  label: string;
  value: string;
  href: string;
  subtext?: string;
  icon: LucideIcon;
  color: NonNullable<KpiCardProps["color"]>;
};

function kpisForVariant(variant: Variant, k?: OpsKpi): KpiSpec[] {
  switch (variant) {
    case "sales":
      return [
        { label: "Today's sales", value: money(k?.todaySales), href: "/admin/analytics", icon: IndianRupee, color: "amber" },
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
        { label: "Receivables", value: money(k?.receivables), href: "/admin/invoices", icon: IndianRupee, color: "amber" },
        { label: "Payments", value: money(k?.payments), href: "/admin/invoices", icon: IndianRupee, color: "emerald" },
      ];
    case "catalog":
      return [
        { label: "Products", value: String(k?.products ?? 0), href: "/admin/products", icon: Package, color: "indigo" },
        { label: "Categories", value: String(k?.categories ?? 0), href: "/admin/categories", icon: Boxes, color: "violet" },
        { label: "Brands", value: String(k?.brands ?? 0), href: "/admin/brands", icon: Tag, color: "amber" },
        { label: "Attributes", value: String(k?.attributes ?? 0), href: "/admin/attributes", icon: ListOrdered, color: "slate" },
      ];
    default:
      return [
        { label: "Revenue", value: money(k?.revenue), href: "/admin/analytics", icon: IndianRupee, color: "amber" },
        { label: "Sales orders", value: String(k?.salesOrders ?? 0), href: "/admin/sales-desk", icon: ShoppingCart, color: "emerald" },
        { label: "Open SREQs", value: String(k?.sreqsOpen ?? 0), href: "/admin/sales-desk", icon: ClipboardList, color: "indigo" },
        { label: "Open tasks", value: String(k?.openTasks ?? 0), href: "/admin/sales-desk", icon: ListOrdered, color: "violet" },
        { label: "Customers", value: String(k?.customers ?? 0), href: "/admin/customers", icon: Users, color: "blue" },
      ];
  }
}

export function OpsKpiRowWidget({ fetchData, config }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const variant = (typeof config?.variant === "string" ? config.variant : "admin") as Variant;
  const cards = kpisForVariant(variant, data?.kpis);
  return (
    <div
      className="grid h-full gap-3"
      style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 5)}, minmax(0, 1fr))` }}
    >
      {cards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={data ? c.value : "…"}
          href={c.href}
          icon={c.icon}
          color={c.color}
          subtext={c.subtext}
          className="h-full"
        />
      ))}
    </div>
  );
}

export function RecentActivityWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const rows = data?.activity ?? [];
  return (
    <WidgetShell title="Recent activity" subtitle="What needs attention" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="Nothing new" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <a href={row.href} className="ws-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.title}</p>
                  <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">{row.subtitle}</p>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--ink-soft,#666)]/50">
                  {row.kind}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function SreqOrderTableWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const sreqs = data?.sreqs ?? [];
  const orders = data?.orders ?? [];
  return (
    <WidgetShell title="Recent requests & orders" subtitle="Open to process on Order Desk" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : sreqs.length === 0 && orders.length === 0 ? (
        <WidgetEmpty message="No recent work" />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--ink-soft,#666)]/60">
              <tr>
                <th className="pb-2 font-semibold">Ref</th>
                <th className="pb-2 font-semibold">Customer</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {sreqs.map((row) => (
                <tr key={`sreq-${row.id}`} className="border-t border-[var(--line,#e8e8e8)]">
                  <td className="py-2">
                    <a className="font-medium text-[var(--brand,#c8922a)] hover:underline" href={`/admin/sales-desk?sreqId=${encodeURIComponent(row.id)}`}>
                      {row.requestNumber || "SREQ"}
                    </a>
                  </td>
                  <td className="py-2 text-[var(--ink-soft,#666)]">{row.customerName}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2 text-right font-medium">{money(row.total)}</td>
                </tr>
              ))}
              {orders.map((row) => (
                <tr key={`so-${row.id}`} className="border-t border-[var(--line,#e8e8e8)]">
                  <td className="py-2">
                    <a
                      className="font-medium text-[var(--brand,#c8922a)] hover:underline"
                      href={`/admin/sales-desk?salesOrderId=${encodeURIComponent(row.id)}`}
                    >
                      {row.orderNumber || "SO"}
                    </a>
                  </td>
                  <td className="py-2 text-[var(--ink-soft,#666)]">{row.customerName}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2 text-right font-medium">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}

export function MyTasksListWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const rows = data?.tasks ?? [];
  return (
    <WidgetShell title="My tasks" subtitle="Open on Order Desk to complete" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No open tasks" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href={
                  row.salesOrderId
                    ? `/admin/sales-desk?salesOrderId=${encodeURIComponent(row.salesOrderId)}`
                    : "/admin/sales-desk"
                }
                className="ws-row"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.title}</p>
                  <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">
                    {row.orderNumber ? `${row.orderNumber} · ${row.status}` : row.status}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function RecentCustomersWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const rows = data?.customers ?? [];
  return (
    <WidgetShell title="Recent customers" subtitle="Open customer record" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No customers" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href="/admin/customers"
                className="ws-row"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.name}</p>
                  <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">{row.email || row.phone || "—"}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function PriceOpsWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const rows = data?.priceLists ?? [];
  return (
    <WidgetShell title="Price lists" subtitle="Open a list to review rates" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No price lists" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href="/admin/price-lists"
                className="ws-row"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.name}</p>
                  <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">
                    {row.isDefault ? "Default" : "List"}
                    {row.updatedAt ? ` · updated ${new Date(row.updatedAt).toLocaleDateString("en-IN")}` : ""}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function RecentProductsWidget({ fetchData }: WidgetProps) {
  const { data, error } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} />;
  const rows = data?.products ?? [];
  return (
    <WidgetShell title="Catalog snapshot" subtitle="Open a product" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No products" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href="/admin/products"
                className="ws-row"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.name}</p>
                  <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">{row.sku || "—"}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
