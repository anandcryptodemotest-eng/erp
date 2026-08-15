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
import {
  buildRevenueTrendHref,
  REVENUE_TREND_RANGES,
  revenueTrendRangeBounds,
  type RevenueTrendRange,
} from "../charts/hrefs";
import { formatInr } from "../ops-attention";
import { WidgetShell, WidgetEmpty, WidgetError } from "./shell";

type Daily = { date: string; revenue: number; orders: number };
type SalesReport = {
  summary?: { revenue?: number };
  daily?: Daily[];
};

function navigate(href: string) {
  if (typeof window !== "undefined") window.location.assign(href);
}

export function RevenueTrendWidget({ fetchData }: WidgetProps) {
  const [range, setRange] = useState<RevenueTrendRange>("7D");
  const [data, setData] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const { from, to } = revenueTrendRangeBounds(range);
    const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    void fetchData<{ data: SalesReport }>(`/api/reports/sales?${qs}`).then((res) => {
      if (!alive) return;
      if (!res) {
        setError("Sales report unavailable");
        setData(null);
        setLoading(false);
        return;
      }
      setData(res.data ?? (res as unknown as SalesReport));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchData, range]);

  if (error) return <WidgetError message={error} />;

  const daily = data?.daily ?? [];
  const chips = (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Sales trend range">
      {REVENUE_TREND_RANGES.map((key) => {
        const active = key === range;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={
              active
                ? "rounded-md bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-inverse)]"
                : "rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] hover:bg-[var(--mist)]"
            }
          >
            {key}
          </button>
        );
      })}
    </div>
  );

  return (
    <WidgetShell
      title="Sales trend"
      subtitle="Daily revenue — click a day to open Order Desk"
      actions={chips}
      style={{ height: "100%" }}
    >
      {loading && !data ? (
        <WidgetEmpty message="Loading…" />
      ) : daily.length === 0 ? (
        <WidgetEmpty message={data ? "No sales in period" : "Loading…"} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={daily}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            style={{ cursor: "pointer" }}
            onClick={(state) => {
              const point = state as { activePayload?: { payload?: Daily }[] } | null;
              const payload = point?.activePayload?.[0]?.payload;
              if (!payload?.date) return;
              navigate(buildRevenueTrendHref({ from: payload.date, to: payload.date }));
            }}
          >
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
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as Daily | undefined;
                return (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-[var(--ink)]">{String(label)}</p>
                    <p className="mt-1 text-[var(--ink)]">{formatInr(Number(row?.revenue ?? 0))}</p>
                    <p className="text-[var(--ink-soft)]">{row?.orders ?? 0} orders</p>
                    <p className="mt-1 font-medium text-[var(--brand)]">Open Order Desk →</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="revenue" stroke="var(--brand,#c8922a)" strokeWidth={2} fill="url(#revenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}
