"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { WidgetProps } from "../types";
import { buildOrderStatusHref } from "../charts/hrefs";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type OrdersByStatus = { status: string; _count: { id: number } }[];

const COLORS = ["#c8922a", "#2f7d5c", "#3b82f6", "#ef4444", "#8b5cf6", "#64748b"];

function navigate(href: string) {
  if (typeof window !== "undefined") window.location.assign(href);
}

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
    status: s.status,
    value: s._count.id,
  }));

  return (
    <WidgetShell
      title="Orders by status"
      subtitle="Click a segment to open Order Desk"
      style={{ height: "100%" }}
    >
      {chartData.length === 0 ? (
        <WidgetEmpty message="No orders" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              style={{ cursor: "pointer" }}
              onClick={(_, index) => {
                const row = chartData[index];
                if (!row) return;
                navigate(buildOrderStatusHref(row.status));
              }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as { name?: string; value?: number } | undefined;
                return (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-[var(--ink)]">{row?.name}</p>
                    <p className="mt-1 text-[var(--ink)]">{row?.value ?? 0} orders</p>
                    <p className="mt-1 font-medium text-[var(--brand)]">Open Order Desk →</p>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
              onClick={(entry) => {
                const name = String((entry as { value?: string }).value ?? "");
                const row = chartData.find((c) => c.name === name);
                navigate(buildOrderStatusHref(row?.status ?? name));
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}
