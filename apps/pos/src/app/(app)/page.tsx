"use client";
import { useEffect, useState, useCallback } from "react";
import { api, getUserId } from "@/lib/api-client";

interface Shift {
  id: string; status: string; cashierId: string; openingBalance: number;
  closingBalance: number | null; openedAt: string; closedAt: string | null;
  _count?: { bills: number };
  entries?: { type: string; amount: number; notes: string | null }[];
}

export default function ShiftPage() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadShift = useCallback(async () => {
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }
    const res = await api<{ data: Shift[] }>("accounting", `/api/shifts?status=OPEN&cashierId=${userId}&limit=1`);
    if (!res.error && res.data.data.length > 0) {
      // Load full shift detail with entry breakdown
      const detail = await api<{ data: Shift }>("accounting", `/api/shifts/${res.data.data[0].id}`);
      setShift(detail.error ? res.data.data[0] : detail.data.data);
    } else {
      setShift(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadShift(); }, [loadShift]);

  async function openShift() {
    const userId = getUserId();
    if (!userId) return;
    setOpening(true); setError("");
    const res = await api<{ data: Shift }>("accounting", "/api/shifts", {
      method: "POST",
      body: JSON.stringify({ cashierId: userId, openingBalance: parseFloat(openingBalance) || 0 }),
    });
    setOpening(false);
    if (res.error) { setError(res.error); return; }
    setShift(res.data.data);
    setMsg("Shift opened successfully");
  }

  async function closeShift() {
    if (!shift) return;
    setClosing(true); setError("");
    const res = await api<{ data: Shift }>("accounting", `/api/shifts/${shift.id}`, {
      method: "PATCH",
      body: JSON.stringify({ closingBalance: parseFloat(closingBalance) || 0 }),
    });
    setClosing(false);
    if (res.error) { setError(res.error); return; }
    setShift(null);
    setMsg("Shift closed successfully");
  }

  // Compute cash summary from entries
  const cashIn = shift?.entries?.filter((e) => e.type === "CASH_IN" || e.type === "BILL_PAYMENT").reduce((s, e) => s + e.amount, 0) ?? 0;
  const cashOut = shift?.entries?.filter((e) => e.type === "CASH_OUT" || e.type === "REFUND").reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="mb-6 text-xl font-bold text-white">Shift Management</h1>

      {loading && <div className="text-slate-400">Loading…</div>}

      {msg && <div className="mb-4 rounded-xl bg-emerald-900/50 border border-emerald-700 px-4 py-3 text-sm text-emerald-300">{msg}</div>}
      {error && <div className="mb-4 rounded-xl bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</div>}

      {!loading && !shift && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">No active shift</h2>
          <p className="mb-5 text-sm text-slate-400">Enter the opening cash balance and start your shift.</p>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Opening Cash (₹)</label>
            <input type="number" min="0" value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-48 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-white outline-none focus:border-emerald-500" />
          </div>
          <button onClick={openShift} disabled={opening}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {opening ? "Opening…" : "Open Shift"}
          </button>
        </div>
      )}

      {!loading && shift && (
        <>
          {/* Shift status card */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-emerald-300">● SHIFT OPEN</span>
              <span className="text-xs text-slate-400">Since {new Date(shift.openedAt).toLocaleTimeString("en-IN")}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
              {[
                { label: "Opening Balance", value: `₹${Number(shift.openingBalance).toLocaleString("en-IN")}` },
                { label: "Bills Today", value: String(shift._count?.bills ?? 0) },
                { label: "Cash In", value: `₹${cashIn.toLocaleString("en-IN")}` },
                { label: "Cash Out", value: `₹${cashOut.toLocaleString("en-IN")}` },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl bg-slate-700/60 p-3">
                  <div className="text-xs text-slate-400">{kpi.label}</div>
                  <div className="mt-1 text-lg font-bold text-white">{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Close shift */}
            <div className="border-t border-slate-700 pt-4">
              <p className="mb-3 text-sm text-slate-400">Count the cash drawer and enter the closing balance to close the shift.</p>
              <div className="flex items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Closing Cash (₹)</label>
                  <input type="number" min="0" value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    className="w-40 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-white outline-none focus:border-red-400" />
                </div>
                <button onClick={closeShift} disabled={closing}
                  className="rounded-xl border border-red-700 bg-red-900/40 px-5 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-900/70 disabled:opacity-50">
                  {closing ? "Closing…" : "Close Shift"}
                </button>
              </div>
            </div>
          </div>

          {/* Entry log */}
          {shift.entries && shift.entries.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Cash Log</h3>
              <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
                {shift.entries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className={`text-xs font-medium rounded px-1.5 py-0.5 mr-2
                        ${entry.type === "CASH_OUT" || entry.type === "REFUND" ? "bg-red-900/50 text-red-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                        {entry.type}
                      </span>
                      <span className="text-slate-400 text-xs">{entry.notes ?? ""}</span>
                    </div>
                    <span className={`font-semibold ${entry.type === "CASH_OUT" || entry.type === "REFUND" ? "text-red-400" : "text-emerald-400"}`}>
                      {entry.type === "CASH_OUT" || entry.type === "REFUND" ? "−" : "+"}₹{Number(entry.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
