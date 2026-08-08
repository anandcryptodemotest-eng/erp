"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type OrderRow = {
  id?: string;
  requestNumber?: string;
  status?: string;
  total?: number;
  createdAt?: string;
};

type OrdersResponse = {
  data?: OrderRow[];
};

export function MyOrdersWidget({ fetchData }: WidgetProps) {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<OrdersResponse>("/api/sales-requests?limit=5").then((res) => {
      if (!alive) return;
      if (!res) return setError("Orders unavailable");
      setRows(res.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;

  return (
    <WidgetShell title="My recent orders" subtitle="Latest purchase requests" style={{ height: "100%" }}>
      {!rows ? (
        <WidgetEmpty message="Loading…" />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No orders yet" />
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--ink,#1a1a1a)]">{o.requestNumber}</p>
                <p className="text-xs text-[var(--ink-soft,#666)]/60">{o.status}</p>
              </div>
              <span className="shrink-0 font-semibold text-[var(--ink,#1a1a1a)]">
                {money(o.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

type SpendingRow = { month?: string; total?: number };

export function MonthlySpendingWidget({ fetchData }: WidgetProps) {
  const [data, setData] = useState<SpendingRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<OrdersResponse>("/api/sales-requests?limit=200").then((res) => {
      if (!alive) return;
      if (!res) return setError("Spending unavailable");
      const orders = res.data ?? [];
      setData(bucketByMonth(orders));
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;

  return (
    <WidgetShell title="Monthly spending" subtitle="Last 6 months" style={{ height: "100%" }}>
      {!data ? (
        <WidgetEmpty message="Loading…" />
      ) : data.length === 0 ? (
        <WidgetEmpty message="No spending data" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} width={44} />
            <Tooltip formatter={(v) => money(Number(v))} />
            <Bar dataKey="total" fill="var(--forest,#2f7d5c)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}

function bucketByMonth(orders: OrderRow[]): SpendingRow[] {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (!o.createdAt && !(o.total ?? 0)) continue;
    const d = o.createdAt ? new Date(o.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] ?? 0) + (o.total ?? 0);
  }
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-6)
    .map(([month, total]) => ({ month, total }));
}

function money(v?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v ?? 0);
}