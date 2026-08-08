"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";

type SalesReport = {
  summary: {
    totalOrders: number;
    revenue: number;
    tax: number;
    averageOrderValue: number;
  };
  ordersByStatus: { status: string; _count: { id: number } }[];
  daily: { date: string; orders: number; revenue: number }[];
  topProducts: { productId: string; _sum: { quantity: number | null; total: number | null } }[];
};

type StockReport = {
  summary: {
    totalProducts: number;
    totalUnits: number;
    totalStockValue: number;
    totalRetailValue: number;
    lowStockCount: number;
  };
  lowStockItems: { productName: string; sku: string; warehouse: string; availableQty: number }[];
  recentMovements: { id: string; type: string; quantity: number; reference: string | null; createdAt: string; product: { name: string; sku: string }; warehouse: { name: string } }[];
};

type DeliveryReport = {
  summary: {
    totalAssignments: number;
    deliveredCount: number;
    failedCount: number;
    successRate: number;
    avgDeliveryMinutes: number;
  };
  byStatus: { status: string; _count: { id: number } }[];
};

type ReconciliationReport = {
  invoices: { count: number; outstanding: number; discrepancies: { invoiceId: string }[] };
  notes: { credit: { count: number; total: number }; debit: { count: number; total: number } };
  journals: { count: number; difference: number; balanced: boolean; discrepancies: { journalEntryId: string }[] };
  trialBalance: { difference: number; balanced: boolean };
};

type ReportKey = "sales" | "stock" | "delivery" | "reconciliation";

type ReportState = {
  sales: SalesReport | null;
  stock: StockReport | null;
  delivery: DeliveryReport | null;
  reconciliation: ReconciliationReport | null;
  errors: Partial<Record<ReportKey, string>>;
  loading: Record<ReportKey, boolean>;
};

const initialState: ReportState = {
  sales: null,
  stock: null,
  delivery: null,
  reconciliation: null,
  errors: {},
  loading: { sales: true, stock: true, delivery: true, reconciliation: true },
};

function dateValue(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="admin-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--ink)]">{value}</p>
      {detail && <p className="mt-1 text-xs text-[var(--ink-soft)]/65">{detail}</p>}
    </div>
  );
}

function PanelError({ report, message, onRetry }: { report: string; message: string; onRetry: () => void }) {
  return (
    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p>{report} could not be loaded: {message}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Retry {report.toLowerCase()}</button>
    </div>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(dateValue(30));
  const [to, setTo] = useState(dateValue(0));
  const [state, setState] = useState<ReportState>(initialState);
  const [retryPanel, setRetryPanel] = useState<ReportKey | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const params = `from=${encodeURIComponent(`${from}T00:00:00.000Z`)}&to=${encodeURIComponent(`${to}T23:59:59.999Z`)}`;
    const requests: Record<ReportKey, Promise<{ data: SalesReport | StockReport | DeliveryReport | ReconciliationReport }>> = {
      sales: api<{ data: SalesReport }>(`/api/reports/sales?${params}`),
      stock: api<{ data: StockReport }>("/api/reports/stock?lowStockThreshold=10"),
      delivery: api<{ data: DeliveryReport }>(`/api/reports/delivery?${params}`),
      reconciliation: api<{ data: ReconciliationReport }>(`/api/reports/reconciliation?${params}`),
    };
    const reports: ReportKey[] = retryPanel ? [retryPanel] : ["sales", "stock", "delivery", "reconciliation"];
    setState((current) => ({
      ...current,
      errors: retryPanel ? { ...current.errors, [retryPanel]: undefined } : {},
      loading: retryPanel
        ? { ...current.loading, [retryPanel]: true }
        : { sales: true, stock: true, delivery: true, reconciliation: true },
    }));

    Promise.allSettled(reports.map((report) => requests[report])).then((results) => {
      setState((current) => {
        const next = { ...current, errors: { ...current.errors }, loading: { ...current.loading } };
        results.forEach((result, index) => {
          const report = reports[index];
          next.loading[report] = false;
          if (result.status === "fulfilled") {
            next[report] = result.value.data as never;
          } else {
            next.errors[report] = result.reason instanceof Error ? result.reason.message : "Report could not be loaded.";
          }
        });
        return next;
      });
    });
  }, [from, to, retryPanel, retryVersion]);

  function retry(report: ReportKey) {
    setRetryPanel(report);
    setRetryVersion((value) => value + 1);
  }

  const daily = state.sales?.daily ?? [];
  const maxRevenue = Math.max(...daily.map((item) => item.revenue), 1);
  const hasErrors = Object.keys(state.errors).length > 0;

  return (
    <main className="p-5 md:p-8">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Business intelligence</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--ink)]">Analytics</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]/70">A focused view of sales performance, inventory exposure, and delivery execution.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-white p-3 shadow-sm">
          <label className="text-xs font-medium text-[var(--ink-soft)]">From<input type="date" value={from} onChange={(event) => { setRetryPanel(null); setFrom(event.target.value); }} className="mt-1 block rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]" /></label>
          <label className="text-xs font-medium text-[var(--ink-soft)]">To<input type="date" value={to} onChange={(event) => { setRetryPanel(null); setTo(event.target.value); }} className="mt-1 block rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]" /></label>
        </div>
      </div>

      {hasErrors && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Some report panels are unavailable. Each affected panel can be retried independently.</div>}
      {Object.values(state.loading).some(Boolean) && <div className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-soft)]">Refreshing reports...</div>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={money(state.sales?.summary.revenue ?? 0)} detail="Completed sales in period" />
        <Stat label="Orders" value={(state.sales?.summary.totalOrders ?? 0).toLocaleString()} detail={`Average ${money(state.sales?.summary.averageOrderValue ?? 0)}`} />
        <Stat label="Stock value" value={money(state.stock?.summary.totalStockValue ?? 0)} detail={`${(state.stock?.summary.totalUnits ?? 0).toLocaleString()} available units`} />
        <Stat label="Delivery success" value={`${state.delivery?.summary.successRate ?? 0}%`} detail={`${state.delivery?.summary.deliveredCount ?? 0} delivered`} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="admin-card p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Revenue trend</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Daily order revenue for the selected period.</p></div><span className="rounded-full bg-[var(--mist)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Sales</span></div>
          {state.errors.sales ? <PanelError report="Sales" message={state.errors.sales} onRetry={() => retry("sales")} /> : daily.length === 0 ? <p className="py-16 text-center text-sm text-[var(--ink-soft)]/60">No sales recorded for this period.</p> : <div className="mt-8 flex h-48 items-end gap-1.5 overflow-hidden border-b border-[var(--line)] pb-0">{daily.map((item) => <div key={item.date} className="group flex h-full flex-1 flex-col justify-end"><div title={`${item.date}: ${money(item.revenue)}`} className="min-h-[3px] rounded-t bg-[var(--brand)]/80 transition-colors group-hover:bg-[var(--brand)]" style={{ height: `${Math.max(3, (item.revenue / maxRevenue) * 100)}%` }} /></div>)}</div>}
          <div className="mt-3 flex justify-between text-xs text-[var(--ink-soft)]/55"><span>{daily[0]?.date ?? ""}</span><span>{daily[daily.length - 1]?.date ?? ""}</span></div>
        </div>

        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Delivery execution</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Operational health in the selected period.</p>{state.errors.delivery ? <PanelError report="Delivery" message={state.errors.delivery} onRetry={() => retry("delivery")} /> : <div className="mt-7 space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span className="text-[var(--ink-soft)]">Delivered</span><strong className="text-[var(--ink)]">{state.delivery?.summary.deliveredCount ?? 0}</strong></div><div className="h-2 rounded-full bg-[var(--mist)]"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${state.delivery?.summary.successRate ?? 0}%` }} /></div></div><div className="flex justify-between border-t border-[var(--line)] pt-4 text-sm"><span className="text-[var(--ink-soft)]">Failed</span><strong className="text-[var(--ink)]">{state.delivery?.summary.failedCount ?? 0}</strong></div><div className="flex justify-between text-sm"><span className="text-[var(--ink-soft)]">Average delivery time</span><strong className="text-[var(--ink)]">{state.delivery?.summary.avgDeliveryMinutes ?? 0} min</strong></div></div>}</div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Inventory watchlist</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Items at or below the threshold of 10 units.</p></div><strong className="text-2xl text-amber-600">{state.stock?.summary.lowStockCount ?? 0}</strong></div>{state.errors.stock ? <PanelError report="Inventory" message={state.errors.stock} onRetry={() => retry("stock")} /> : (state.stock?.lowStockItems ?? []).length === 0 ? <p className="py-10 text-center text-sm text-[var(--ink-soft)]/60">Inventory levels look healthy.</p> : <div className="mt-5 divide-y divide-[var(--line)]">{state.stock?.lowStockItems.slice(0, 6).map((item) => <div key={`${item.sku}-${item.warehouse}`} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--ink)]">{item.productName}</p><p className="text-xs text-[var(--ink-soft)]/60">{item.sku} / {item.warehouse}</p></div><span className="shrink-0 text-sm font-semibold text-amber-700">{item.availableQty} left</span></div>)}</div>}</div>
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Period snapshot</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">The selected window at a glance.</p><dl className="mt-5 divide-y divide-[var(--line)]">{[["Revenue tax", money(state.sales?.summary.tax ?? 0)], ["Tracked products", (state.stock?.summary.totalProducts ?? 0).toLocaleString()], ["Retail stock value", money(state.stock?.summary.totalRetailValue ?? 0)], ["Delivery assignments", (state.delivery?.summary.totalAssignments ?? 0).toLocaleString()]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[var(--ink-soft)]">{label}</dt><dd className="font-semibold text-[var(--ink)]">{value}</dd></div>)}</dl></div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Order status</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Orders grouped by workflow status.</p>{state.errors.sales ? <PanelError report="Sales" message={state.errors.sales} onRetry={() => retry("sales")} /> : <div className="mt-5 divide-y divide-[var(--line)]">{(state.sales?.ordersByStatus ?? []).map((item) => <div key={item.status} className="flex justify-between py-2 text-sm"><span className="text-[var(--ink-soft)]">{item.status.replaceAll("_", " ")}</span><strong className="text-[var(--ink)]">{item._count.id}</strong></div>)}</div>}</div>
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Top products</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Highest-volume products in the period.</p>{state.errors.sales ? <PanelError report="Sales" message={state.errors.sales} onRetry={() => retry("sales")} /> : <div className="mt-5 divide-y divide-[var(--line)]">{(state.sales?.topProducts ?? []).slice(0, 5).map((item) => <div key={item.productId} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate text-[var(--ink-soft)]">{item.productId}</span><strong className="shrink-0 text-[var(--ink)]">{item._sum.quantity ?? 0} units</strong></div>)}</div>}</div>
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Delivery status</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Assignments grouped by status.</p>{state.errors.delivery ? <PanelError report="Delivery" message={state.errors.delivery} onRetry={() => retry("delivery")} /> : <div className="mt-5 divide-y divide-[var(--line)]">{(state.delivery?.byStatus ?? []).map((item) => <div key={item.status} className="flex justify-between py-2 text-sm"><span className="text-[var(--ink-soft)]">{item.status.replaceAll("_", " ")}</span><strong className="text-[var(--ink)]">{item._count.id}</strong></div>)}</div>}</div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Recent stock movements</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Latest inventory changes across warehouses.</p>{state.errors.stock ? <PanelError report="Inventory" message={state.errors.stock} onRetry={() => retry("stock")} /> : <div className="mt-5 divide-y divide-[var(--line)]">{(state.stock?.recentMovements ?? []).slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm"><div className="min-w-0"><p className="truncate font-medium text-[var(--ink)]">{item.product.name}</p><p className="text-xs text-[var(--ink-soft)]/60">{item.type} / {item.warehouse.name}</p></div><span className="shrink-0 font-semibold text-[var(--ink)]">{item.quantity}</span></div>)}</div>}</div>
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Metric definitions</h2><dl className="mt-5 divide-y divide-[var(--line)] text-sm"><div className="py-3"><dt className="font-semibold text-[var(--ink)]">Revenue</dt><dd className="mt-1 text-[var(--ink-soft)]/70">Non-cancelled order totals in the selected window.</dd></div><div className="py-3"><dt className="font-semibold text-[var(--ink)]">Stock value</dt><dd className="mt-1 text-[var(--ink-soft)]/70">Available units multiplied by current cost price.</dd></div><div className="py-3"><dt className="font-semibold text-[var(--ink)]">Delivery success</dt><dd className="mt-1 text-[var(--ink-soft)]/70">Delivered assignments divided by assignments in the window.</dd></div></dl></div>
      </section>

      <section className="mt-6">
        <div className="admin-card p-6"><h2 className="font-display text-lg font-semibold text-[var(--ink)]">Accounting reconciliation</h2><p className="mt-1 text-sm text-[var(--ink-soft)]/65">Invoice payments, notes, journals, and trial-balance consistency.</p>{state.errors.reconciliation ? <PanelError report="Accounting" message={state.errors.reconciliation} onRetry={() => retry("reconciliation")} /> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-[var(--mist)] p-4"><p className="text-xs text-[var(--ink-soft)]">Invoice mismatches</p><strong className="mt-2 block text-xl text-[var(--ink)]">{state.reconciliation?.invoices.discrepancies.length ?? 0}</strong></div><div className="rounded-lg bg-[var(--mist)] p-4"><p className="text-xs text-[var(--ink-soft)]">Journal status</p><strong className="mt-2 block text-xl text-[var(--ink)]">{state.reconciliation?.journals.balanced ? "Balanced" : "Review"}</strong></div><div className="rounded-lg bg-[var(--mist)] p-4"><p className="text-xs text-[var(--ink-soft)]">Trial balance difference</p><strong className="mt-2 block text-xl text-[var(--ink)]">{money(state.reconciliation?.trialBalance.difference ?? 0)}</strong></div><div className="rounded-lg bg-[var(--mist)] p-4"><p className="text-xs text-[var(--ink-soft)]">Open invoice balance</p><strong className="mt-2 block text-xl text-[var(--ink)]">{money(state.reconciliation?.invoices.outstanding ?? 0)}</strong></div></div>}</div>
      </section>
    </main>
  );
}
