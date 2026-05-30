"use client";
import { useEffect, useState, useCallback } from "react";
import { api, getUserId } from "@/lib/api-client";

interface EarningLog {
  id: string;
  amount: number;
  type: string;
  description?: string;
  period: string;
  createdAt: string;
}

interface PeriodSummary { period: string; total: number; count: number }

export default function EarningsPage() {
  const [logs, setLogs] = useState<EarningLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }
    const res = await api<{ data: EarningLog[] }>(
      "delivery",
      `/api/earnings?executiveId=${userId}&period=${selectedPeriod}&limit=100`
    );
    if (!res.error) setLogs(res.data.data);
    setLoading(false);
  }, [selectedPeriod]);

  useEffect(() => { load(); }, [load]);

  const totalEarnings = logs.reduce((s, l) => s + Number(l.amount), 0);
  const totalDeliveries = logs.filter((l) => l.type === "DELIVERY").length;

  // Generate last 6 month options
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function formatPeriod(p: string) {
    const [y, m] = p.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  const TYPE_STYLE: Record<string, string> = {
    DELIVERY: "bg-green-100 text-green-700",
    BONUS: "bg-blue-100 text-blue-700",
    DEDUCTION: "bg-red-100 text-red-600",
    ADJUSTMENT: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold text-stone-800">My Earnings</h1>

      {/* Month picker */}
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Period</label>
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-orange-400">
          {monthOptions.map((m) => (
            <option key={m} value={m}>{formatPeriod(m)}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-orange-600">₹{totalEarnings.toLocaleString("en-IN")}</div>
          <div className="text-xs text-stone-400 mt-1">Total Earnings</div>
        </div>
        <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{totalDeliveries}</div>
          <div className="text-xs text-stone-400 mt-1">Deliveries</div>
        </div>
      </div>

      {/* Transactions */}
      {loading && <div className="py-12 text-center text-stone-400">Loading…</div>}

      {!loading && logs.length === 0 && (
        <div className="flex flex-col items-center py-16 text-stone-400">
          <div className="text-5xl mb-3">💰</div>
          <div className="text-sm">No earnings for {formatPeriod(selectedPeriod)}</div>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-700">Transactions</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[log.type] ?? "bg-stone-100 text-stone-500"}`}>
                      {log.type}
                    </span>
                  </div>
                  {log.description && <div className="text-xs text-stone-400 truncate">{log.description}</div>}
                  <div className="text-xs text-stone-300 mt-0.5">
                    {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className={`text-sm font-bold ml-4 ${log.type === "DEDUCTION" ? "text-red-500" : "text-green-600"}`}>
                  {log.type === "DEDUCTION" ? "−" : "+"}₹{Number(log.amount).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
