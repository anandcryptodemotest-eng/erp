"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, getUserId } from "@/lib/api-client";

interface Assignment {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  assignedAt: string;
  notes?: string;
}

const STATUS_STYLE: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-yellow-100 text-yellow-700",
  PICKED_UP: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-600",
  CANCELLED: "bg-stone-100 text-stone-500",
};

const STATUS_ICON: Record<string, string> = {
  ASSIGNED: "📋",
  ACCEPTED: "✅",
  PICKED_UP: "🏃",
  DELIVERED: "✔️",
  FAILED: "❌",
  CANCELLED: "🚫",
};

export default function HomePage() {
  const [active, setActive] = useState<Assignment[]>([]);
  const [completed, setCompleted] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "done">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }

    const [activeRes, doneRes] = await Promise.all([
      api<{ data: Assignment[] }>("delivery", `/api/assignments?executiveId=${userId}&limit=50`),
      api<{ data: Assignment[] }>("delivery", `/api/assignments?executiveId=${userId}&status=DELIVERED&limit=20`),
    ]);

    if (!activeRes.error) {
      const all = activeRes.data.data;
      setActive(all.filter((a) => !["DELIVERED", "FAILED", "CANCELLED"].includes(a.status)));
    }
    if (!doneRes.error) setCompleted(doneRes.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = tab === "active" ? active : completed;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="p-4">
      {/* Date header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-stone-800">Today's Deliveries</h1>
          <p className="text-xs text-stone-400">{today}</p>
        </div>
        <button onClick={load} className="rounded-xl border border-orange-200 bg-white px-3 py-1.5 text-xs text-orange-500">
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Pending", value: active.filter((a) => a.status === "ASSIGNED").length, color: "text-blue-600" },
          { label: "In Progress", value: active.filter((a) => ["ACCEPTED", "PICKED_UP"].includes(a.status)).length, color: "text-orange-600" },
          { label: "Done", value: completed.length, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-stone-100 px-3 py-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-stone-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex rounded-xl bg-white border border-stone-100 p-1 shadow-sm">
        {(["active", "done"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-colors
              ${tab === t ? "bg-orange-500 text-white" : "text-stone-500 hover:text-stone-700"}`}>
            {t === "active" ? "Active" : "Completed"}
          </button>
        ))}
      </div>

      {loading && <div className="py-12 text-center text-stone-400">Loading…</div>}

      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 text-stone-400">
          <div className="text-5xl mb-3">{tab === "active" ? "🎉" : "📦"}</div>
          <div className="text-sm">{tab === "active" ? "All clear! No active deliveries." : "No completed deliveries yet."}</div>
        </div>
      )}

      <div className="space-y-3">
        {list.map((a) => (
          <Link key={a.id} href={`/assignments/${a.id}`}
            className="block rounded-2xl bg-white border border-stone-100 p-4 shadow-sm hover:border-orange-200 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-stone-800">#{a.orderNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status] ?? "bg-stone-100 text-stone-500"}`}>
                    {STATUS_ICON[a.status]} {a.status}
                  </span>
                </div>
                {a.customerName && <div className="text-xs text-stone-500 mb-0.5">👤 {a.customerName}{a.customerPhone ? ` · ${a.customerPhone}` : ""}</div>}
                <div className="text-xs text-stone-500 truncate">📍 {a.deliveryAddress}</div>
              </div>
              <div className="text-orange-400 text-lg flex-shrink-0">›</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
