"use client";
import { useEffect, useState } from "react";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";
import { money } from "./shell";

type StockReport = {
  summary?: { lowStockCount?: number; totalUnits?: number };
  lowStockItems?: { productName?: string; sku?: string; warehouse?: string; availableQty?: number }[];
};

export function LowStockWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<StockReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: StockReport }>("/api/reports/stock?lowStockThreshold=10").then((res) => {
      if (!alive) return;
      if (!res) return setError("Stock report unavailable");
      setData(res.data ?? res);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;

  const items = data?.lowStockItems ?? [];
  return (
    <WidgetShell title="Low stock" subtitle="Items below reorder threshold" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : items.length === 0 ? (
        <WidgetEmpty message="No low-stock items" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {items.slice(0, 8).map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--ink,#1a1a1a)]">{item.productName}</p>
                <p className="text-xs text-[var(--ink-soft,#666)]/60">{item.sku} · {item.warehouse}</p>
              </div>
              <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {item.availableQty} left
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}