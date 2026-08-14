"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Container, SectionHeader, StatusChip } from "@erp/ui";
import { api, getUserId } from "@/lib/api-client";

interface EarningLog {
  id: string;
  amount: number;
  type: string;
  description?: string;
  period: string;
  createdAt: string;
}

function typeTone(type: string): "success" | "info" | "danger" | "warning" | "neutral" {
  if (type === "DELIVERY") return "success";
  if (type === "BONUS") return "info";
  if (type === "DEDUCTION") return "danger";
  if (type === "ADJUSTMENT") return "warning";
  return "neutral";
}

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
    if (!userId) {
      setLoading(false);
      return;
    }
    const res = await api<{ data: EarningLog[] }>(
      "delivery",
      `/api/earnings?executiveId=${userId}&period=${selectedPeriod}&limit=100`
    );
    if (!res.error && res.data) setLogs(res.data.data);
    setLoading(false);
  }, [selectedPeriod]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalEarnings = logs.reduce((s, l) => s + Number(l.amount), 0);
  const totalDeliveries = logs.filter((l) => l.type === "DELIVERY").length;

  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function formatPeriod(p: string) {
    const [y, m] = p.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  return (
    <Container layout="compact" className="space-y-4 py-4">
      <SectionHeader title="My earnings" className="mb-0" />

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Period</label>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatPeriod(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-center shadow-[var(--shadow-1)]">
          <div className="font-display text-2xl font-bold text-[var(--accent)]">
            ₹{totalEarnings.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-soft)]">Total earnings</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-center shadow-[var(--shadow-1)]">
          <div className="font-display text-2xl font-bold text-[var(--success)]">{totalDeliveries}</div>
          <div className="mt-1 text-xs text-[var(--ink-soft)]">Deliveries</div>
        </div>
      </div>

      {loading ? <div className="py-12 text-center text-[var(--ink-soft)]">Loading…</div> : null}

      {!loading && logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[var(--ink-soft)]">
          <p className="text-sm">No earnings for {formatPeriod(selectedPeriod)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      ) : null}

      {!loading && logs.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Transactions</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <StatusChip tone={typeTone(log.type)}>{log.type}</StatusChip>
                  </div>
                  {log.description ? (
                    <div className="truncate text-xs text-[var(--ink-soft)]">{log.description}</div>
                  ) : null}
                  <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                    {new Date(log.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
                <div
                  className={`ml-4 text-sm font-bold ${
                    log.type === "DEDUCTION" ? "text-[var(--danger)]" : "text-[var(--success)]"
                  }`}
                >
                  {log.type === "DEDUCTION" ? "−" : "+"}₹{Number(log.amount).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Container>
  );
}
