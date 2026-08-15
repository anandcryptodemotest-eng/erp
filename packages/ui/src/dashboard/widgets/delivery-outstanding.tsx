"use client";
import { useEffect, useState } from "react";
import type { WidgetProps } from "../types";
import { buildInvoicesOutstandingHref, buildOutstandingInvoiceHref } from "../charts/hrefs";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type DeliveryReport = {
  summary?: { totalAssignments?: number; deliveredCount?: number; failedCount?: number; successRate?: number };
  byStatus?: { status: string; _count: { id: number } }[];
};

export function DeliveryPerformanceWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<DeliveryReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: DeliveryReport }>("/api/reports/delivery").then((res) => {
      if (!alive) return;
      if (!res) return setError("Delivery report unavailable");
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;
  const s = data?.summary;
  const stats = [
    { label: "Assignments", value: String(s?.totalAssignments ?? 0) },
    { label: "Delivered", value: String(s?.deliveredCount ?? 0) },
    { label: "Success", value: `${s?.successRate ?? 0}%` },
  ];
  return (
    <WidgetShell title="Delivery performance" subtitle="Assignments and success rate" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : (
        <div className="grid h-full grid-cols-3 gap-3">
          {stats.map((c) => (
            <div key={c.label} className="flex flex-col justify-center rounded-lg bg-[var(--mist,#f4f6f5)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft,#666)]/60">
                {c.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--ink,#1a1a1a)]">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

type AccountingReport = {
  invoices?: { outstanding?: number; count?: number; discrepancies?: unknown[] };
  trialBalance?: { difference?: number; balanced?: boolean };
};

export function OutstandingInvoicesWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<AccountingReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: AccountingReport }>("/api/reports/reconciliation").then((res) => {
      if (!alive) return;
      if (!res) return setError("Accounting report unavailable");
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;
  const inv = data?.invoices;
  const stats = [
    { label: "Outstanding", value: money(inv?.outstanding), href: buildOutstandingInvoiceHref("all") },
    { label: "Invoices", value: String(inv?.count ?? 0), href: buildInvoicesOutstandingHref() },
    { label: "Mismatches", value: String(inv?.discrepancies?.length ?? 0), href: buildOutstandingInvoiceHref("all") },
  ];
  return (
    <WidgetShell title="Outstanding invoices" subtitle="Open receivables — click to collect" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : (
        <div className="flex h-full flex-col justify-center gap-3">
          {stats.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="flex items-center justify-between rounded-lg bg-[var(--mist,#f4f6f5)] px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_12%,var(--mist))]"
            >
              <span className="text-sm text-[var(--ink-soft,#666)]">{c.label}</span>
              <span className="font-semibold text-[var(--ink,#1a1a1a)]">{c.value}</span>
            </a>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function money(v?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v ?? 0);
}