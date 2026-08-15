"use client";
import { useEffect, useState } from "react";
import { KpiCard } from "../../kpi-card";
import type { WidgetProps } from "../types";
import {
  buildOpsAttention,
  formatAttentionLine,
  formatInr,
  formatInrCompact,
  type OpsAttentionItem,
} from "../ops-attention";
import { kpisForVariant, type OpsKpi, type OpsKpiVariant } from "../ops-kpis";
import {
  buildMyTasksStatusHref,
  buildOrderStatusHref,
  buildSreqStatusHref,
  countByStatus,
  formatStatusLabel,
  positiveStatusCounts,
  taskVizMode,
  type StatusCount,
} from "../charts/hrefs";
import { StatusBars } from "./status-bars";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

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
  customerName?: string;
  dueAt?: string;
};

type CustomerRow = { id: string; name: string; email?: string; phone?: string };
type PriceListRow = { id: string; name: string; isDefault?: boolean; updatedAt?: string };
type ProductRow = { id: string; name: string; sku?: string };

type OpsSummary = {
  kpis?: OpsKpi;
  attention?: OpsAttentionItem[];
  activity?: ActivityRow[];
  sreqs?: SreqRow[];
  orders?: OrderRow[];
  tasks?: TaskRow[];
  taskStatusCounts?: StatusCount[];
  sreqStatusCounts?: StatusCount[];
  orderStatusCounts?: StatusCount[];
  customers?: CustomerRow[];
  priceLists?: PriceListRow[];
  products?: ProductRow[];
};

function money(v?: number) {
  return formatInr(v ?? 0);
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const mins = Math.round(ms / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const ACTIVITY_MAX = 8;

function useOpsSummary(fetchData: WidgetProps["fetchData"]) {
  const [data, setData] = useState<OpsSummary | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setError("");
    void fetchData<{ data: OpsSummary }>("/api/dashboard/ops-summary").then((res) => {
      if (!alive) return;
      if (!res) return setError("Dashboard summary unavailable");
      setData(res.data ?? res);
    });
    return () => {
      alive = false;
    };
  }, [fetchData, tick]);

  return { data, error, retry: () => setTick((n) => n + 1) };
}

export function OpsKpiRowWidget({ fetchData, config }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  const [phoneOps, setPhoneOps] = useState(false);

  useEffect(() => {
    const apply = () => {
      const mode =
        typeof document !== "undefined"
          ? document.querySelector(".admin-shell")?.getAttribute("data-admin-mode")
          : null;
      setPhoneOps(mode === "operational" && window.matchMedia("(max-width: 767px)").matches);
    };
    apply();
    window.addEventListener("resize", apply);
    const shell = document.querySelector(".admin-shell");
    const mo = shell ? new MutationObserver(apply) : null;
    if (shell && mo) mo.observe(shell, { attributes: true, attributeFilter: ["data-admin-mode"] });
    return () => {
      window.removeEventListener("resize", apply);
      mo?.disconnect();
    };
  }, []);

  if (error) return <WidgetError message={error} onRetry={retry} />;
  const variant = (typeof config?.variant === "string" ? config.variant : "admin") as OpsKpiVariant;
  const cards = kpisForVariant(variant, data?.kpis);
  const weighted = variant === "admin" && cards.some((c) => c.span);
  const compactKpis = variant === "sales" || variant === "pricing" || variant === "dispatch" || variant === "delivery";

  if (phoneOps) {
    const cells = cards.slice(0, 4).map((c) => {
      let display = data ? c.value : "…";
      if (data && c.value.startsWith("₹")) {
        const digits = Number(c.value.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(digits)) display = formatInrCompact(digits);
      }
      return {
        label: c.label.replace(/^Today'?s\s+/i, "").replace(/^My\s+/i, ""),
        value: display,
        href: c.href,
      };
    });
    return (
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-sm)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Today</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
          {cells.map((cell) => (
            <a key={cell.label} href={cell.href} className="-m-1 block min-w-0 rounded-md p-1 hover:bg-[var(--mist)]">
              <p className="truncate text-base font-bold tabular-nums text-[var(--ink)]">{cell.value}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{cell.label}</p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={compactKpis ? "grid h-full gap-2" : "grid h-full gap-3"}
      style={
        weighted
          ? { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }
          : { gridTemplateColumns: `repeat(${Math.min(cards.length, 5)}, minmax(0, 1fr))` }
      }
    >
      {cards.map((c) => (
        <div
          key={c.label}
          className="min-w-0"
          style={weighted ? { gridColumn: `span ${c.span ?? 3}` } : undefined}
        >
          <KpiCard
            label={c.label}
            value={data ? c.value : "…"}
            href={c.href}
            icon={c.icon}
            color={c.color}
            subtext={compactKpis ? undefined : c.subtext}
            compact={compactKpis}
            className="h-full"
          />
        </div>
      ))}
    </div>
  );
}

export function TodayAttentionWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
  const rows = Array.isArray(data?.attention)
    ? data.attention.filter((row) => row.value > 0)
    : data
      ? buildOpsAttention({
          sreqsOpen: data.kpis?.sreqsOpen ?? 0,
          pendingFulfilment: data.kpis?.pendingDispatches ?? 0,
          deliveriesPending: data.kpis?.outForDelivery ?? 0,
          overdueReceivables: data.kpis?.overdueReceivables ?? 0,
          openTasks: data.kpis?.openTasks ?? 0,
        })
      : [];
  return (
    <WidgetShell
      title="TODAY"
      subtitle="What needs your attention right now?"
      style={{ height: "100%" }}
    >
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="Nothing waiting — Order Desk is clear." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href={row.href}
                className={
                  row.tone === "danger"
                    ? "inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-1.5 text-sm font-medium text-[var(--danger)]"
                    : "inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--mist)] px-3 py-1.5 text-sm font-medium text-[var(--ink)]"
                }
              >
                {formatAttentionLine(row, money)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function RecentActivityWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
  const rows = (data?.activity ?? []).slice(0, ACTIVITY_MAX);
  return (
    <WidgetShell title="Recent activity" subtitle="Latest movement" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="Nothing new" />
      ) : (
        <ul className="overflow-y-auto">
          {rows.map((row) => {
            const when = relativeTime(row.at);
            const line = [row.title, row.subtitle, when].filter(Boolean).join(" · ");
            return (
              <li key={row.id}>
                <a href={row.href} className="ws-row py-1">
                  <p className="min-w-0 truncate text-sm text-[var(--ink,#1a1a1a)]">{line}</p>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

export function SreqOrderTableWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
  const sreqs = data?.sreqs ?? [];
  const orders = data?.orders ?? [];
  const sreqCounts =
    data?.sreqStatusCounts?.length
      ? data.sreqStatusCounts
      : countByStatus(sreqs);
  const orderCounts =
    data?.orderStatusCounts?.length
      ? data.orderStatusCounts
      : countByStatus(orders);
  const recent = [
    ...sreqs.map((r) => ({
      key: `sreq-${r.id}`,
      href: `/admin/sales-desk?sreqId=${encodeURIComponent(r.id)}`,
      ref: r.requestNumber || "SREQ",
      customer: r.customerName,
      status: r.status,
      total: r.total,
    })),
    ...orders.map((r) => ({
      key: `so-${r.id}`,
      href: `/admin/sales-desk?salesOrderId=${encodeURIComponent(r.id)}`,
      ref: r.orderNumber || "SO",
      customer: r.customerName,
      status: r.status,
      total: r.total,
    })),
  ].slice(0, 6);

  return (
    <WidgetShell title="Requests & orders" subtitle="Status by pipeline — click a bar to open Order Desk" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : sreqCounts.length === 0 && orderCounts.length === 0 && recent.length === 0 ? (
        <WidgetEmpty message="No recent work" />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">SREQ</p>
              {positiveStatusCounts(sreqCounts).length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">No open requests</p>
              ) : (
                <StatusBars
                  items={positiveStatusCounts(sreqCounts)}
                  hrefFor={buildSreqStatusHref}
                  actionHint="View requests →"
                />
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Sales orders</p>
              {positiveStatusCounts(orderCounts).length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">No open orders</p>
              ) : (
                <StatusBars
                  items={positiveStatusCounts(orderCounts)}
                  hrefFor={buildOrderStatusHref}
                  actionHint="View orders →"
                />
              )}
            </div>
          </div>
          {recent.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Recent</p>
              <ul className="space-y-1.5">
                {recent.map((row) => (
                  <li key={row.key}>
                    <a href={row.href} className="ws-row !py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{row.ref}</p>
                        <p className="truncate text-xs text-[var(--ink-soft)]">
                          {row.status} · {row.customer}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--ink-soft)]">{money(row.total)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

export function MyTasksListWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
  const rows = data?.tasks ?? [];
  const counts = positiveStatusCounts(
    data?.taskStatusCounts?.length
      ? data.taskStatusCounts
      : countByStatus(rows, { exclude: ["COMPLETED", "CANCELLED", "SKIPPED", "DONE"] })
  );
  const total = counts.reduce((n, c) => n + c.count, 0);
  const mode = taskVizMode(counts);
  const title = `My tasks · ${total}`;

  return (
    <WidgetShell
      title={title}
      subtitle={mode === "empty" ? undefined : "Status first — then next work on Order Desk"}
      style={{ height: "100%" }}
    >
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : mode === "empty" ? (
        <div className="flex h-full flex-col justify-center py-2">
          <p className="text-sm font-medium text-[var(--ink)]">You&apos;re all caught up.</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">No work needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto">
          {mode === "single" && counts[0] ? (
            <a
              href={buildMyTasksStatusHref(counts[0].status)}
              className="flex items-baseline justify-between gap-3 rounded-md px-0.5 py-1 hover:bg-[var(--mist)]"
              title={`${formatStatusLabel(counts[0].status)} · ${counts[0].count} · Open →`}
            >
              <span className="truncate text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">
                {formatStatusLabel(counts[0].status)}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">{counts[0].count}</span>
            </a>
          ) : (
            <StatusBars items={counts} hrefFor={buildMyTasksStatusHref} actionHint="Open →" />
          )}
          {rows.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Next</p>
              <ul className="space-y-1.5">
                {rows.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    <a
                      href={
                        row.salesOrderId
                          ? `/admin/sales-desk?salesOrderId=${encodeURIComponent(row.salesOrderId)}`
                          : buildMyTasksStatusHref()
                      }
                      className="ws-row !py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.title}</p>
                        <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">
                          {[row.orderNumber, row.customerName, row.status].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[var(--ink-soft)]" aria-hidden>
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href={buildMyTasksStatusHref()}
                className="mt-2 inline-block text-xs font-semibold text-[var(--brand)] hover:underline"
              >
                View all tasks →
              </a>
            </div>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

export function RecentCustomersWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  const [compactList, setCompactList] = useState(false);

  useEffect(() => {
    const apply = () => {
      // Tablet / tight grid: prefer compact list over dense dual-line rows (BL-044).
      setCompactList(window.matchMedia("(max-width: 1023px)").matches);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  if (error) return <WidgetError message={error} onRetry={retry} />;
  const rows = data?.customers ?? [];
  return (
    <WidgetShell title="Recent customers" subtitle="Relationship context" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No customers" />
      ) : (
        <ul className={compactList ? "space-y-1 overflow-y-auto" : "space-y-1.5 overflow-y-auto"}>
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href={`/admin/customers?id=${encodeURIComponent(row.id)}`}
                className={compactList ? "ws-row !py-1" : "ws-row !py-1.5"}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink,#1a1a1a)]">{row.name}</p>
                  {!compactList ? (
                    <p className="truncate text-xs text-[var(--ink-soft,#666)]/70">{row.email || row.phone || "—"}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[var(--ink-soft)]" aria-hidden>
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function PriceOpsWidget({ fetchData }: WidgetProps) {
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
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
  const { data, error, retry } = useOpsSummary(fetchData);
  if (error) return <WidgetError message={error} onRetry={retry} />;
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
