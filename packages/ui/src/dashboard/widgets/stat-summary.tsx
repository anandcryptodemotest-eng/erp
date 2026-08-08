"use client";
import { useEffect, useState } from "react";
import type { WidgetProps } from "../types";
import { WidgetEmpty, WidgetError } from "./shell";

type DashboardSummary = {
  summary?: {
    totalOrders?: number;
    revenue?: number;
    averageOrderValue?: number;
  };
  stockSummary?: { totalStockValue?: number };
};

export function StatSummaryWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: DashboardSummary }>("/api/reports/sales").then((res) => {
      if (!alive) return;
      if (!res) return setError("Reports unavailable");
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;
  if (!data) return <WidgetEmpty message="Loading summary…" />;

  const cards = [
    { label: "Revenue", value: fmtMoney(data.summary?.revenue) },
    { label: "Orders", value: String(data.summary?.totalOrders ?? 0) },
    { label: "Avg order", value: fmtMoney(data.summary?.averageOrderValue) },
  ];

  return (
    <div className="grid h-full grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="flex flex-col justify-center rounded-lg bg-[var(--mist,#f4f6f5)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft,#666)]/60">
            {c.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--ink,#1a1a1a)]">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function fmtMoney(v?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v ?? 0);
}