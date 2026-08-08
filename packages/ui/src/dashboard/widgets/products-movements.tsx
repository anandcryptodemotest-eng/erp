"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type TopProductsShape = {
  topProducts?: { productId?: string; _sum?: { quantity?: number | null; total?: number | null } }[];
};

export function TopProductsWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<TopProductsShape | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: TopProductsShape }>("/api/reports/sales").then((res) => {
      if (!alive) return;
      if (!res) return setError("Sales report unavailable");
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;

  const rows = (data?.topProducts ?? []).slice(0, 6).map((p, i) => ({
    name: p.productId ? `#${i + 1}` : `#${i + 1}`,
    qty: p._sum?.quantity ?? 0,
  }));

  return (
    <WidgetShell title="Top products" subtitle="By units sold" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No product sales" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line,#e8e8e8)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} width={30} />
            <Tooltip />
            <Bar dataKey="qty" fill="var(--brand,#c8922a)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}

type RecentMovements = {
  recentMovements?: { id?: string; type?: string; quantity?: number; product?: { name?: string }; warehouse?: { name?: string } }[];
};

export function RecentMovementsWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<RecentMovements | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: RecentMovements }>("/api/reports/stock?lowStockThreshold=10").then((res) => {
      if (!alive) return;
      if (!res) return setError("Stock report unavailable");
      setData(res.data ?? res);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;
  const rows = data?.recentMovements ?? [];
  return (
    <WidgetShell title="Recent stock movements" subtitle="Latest inventory changes" style={{ height: "100%" }}>
      {rows.length === 0 ? (
        <WidgetEmpty message="No movements" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.slice(0, 8).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--ink,#1a1a1a)]">{m.product?.name}</p>
                <p className="text-xs text-[var(--ink-soft,#666)]/60">{m.type} · {m.warehouse?.name}</p>
              </div>
              <span className="shrink-0 font-semibold text-[var(--ink,#1a1a1a)]">{m.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}