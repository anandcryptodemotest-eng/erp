"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { WidgetProps } from "../types";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type OrdersByStatus = { status: string; _count: { id: number } }[];

const COLORS = ["#c8922a", "#2f7d5c", "#3b82f6", "#ef4444", "#8b5cf6", "#64748b"];

export function OrderStatusWidget({ fetchData, portal }: WidgetProps) {
  const [data, setData] = useState<OrdersByStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const source =
      portal === "CUSTOMER" ? "/api/customer/orders?statusBreakdown=1" : "/api/reports/sales";
    void fetchData<{ data: { ordersByStatus?: OrdersByStatus } }>(source).then((res) => {
      if (!alive) return;
      if (!res) return setError("Order report unavailable");
      const body = res.data ?? res;
      const rows = Array.isArray(body) ? (body as unknown as OrdersByStatus) : body.ordersByStatus ?? [];
      setData(rows);
    });
    return () => {
      alive = false;
    };
  }, [fetchData, portal]);

  if (error) return <WidgetError message={error} />;

  const chartData = (data ?? []).map((s) => ({
    name: s.status.replaceAll("_", " "),
    value: s._count.id,
  }));

  return (
    <WidgetShell title="Orders by status" subtitle="Distribution of order states" style={{ height: "100%" }}>
      {chartData.length === 0 ? (
        <WidgetEmpty message="No orders" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}