"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type SalesReport = {
  summary?: { revenue?: number };
  daily?: { date: string; revenue: number; orders: number }[];
};

export function RevenueTrendWidget({ fetchData, config }: WidgetProps) {
  const [data, setData] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchData<{ data: SalesReport }>("/api/reports/sales").then((res) => {
      if (!alive) return;
      if (!res) return setError("Sales report unavailable");
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  if (error) return <WidgetError message={error} />;

  const daily = data?.daily ?? [];
  return (
    <WidgetShell
      title="Revenue trend"
      subtitle="Daily order revenue"
      style={{ height: "100%" }}
    >
      {daily.length === 0 ? (
        <WidgetEmpty message={data ? "No sales in period" : "Loading…"} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand,#c8922a)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--brand,#c8922a)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line,#e8e8e8)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#999" tickLine={false} axisLine={false} width={44} />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value))
              }
            />
            <Area type="monotone" dataKey="revenue" stroke="var(--brand,#c8922a)" strokeWidth={2} fill="url(#revenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}