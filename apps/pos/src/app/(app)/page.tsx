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
  const netCashFlow = cashIn - cashOut;

  function formatINR(value: number) {
    return `₹${Number(value).toLocaleString("en-IN")}`;
  }

  return (
    <div className="relative p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent" />
      <div className="relative mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Shift Management</h1>
            <p className="mt-1 text-sm text-slate-400">Monitor cash movement, control shift lifecycle, and close with confidence.</p>
          </div>
          {shift && (
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/40 px-3 py-2 text-xs font-semibold text-emerald-300">
              Shift open since {new Date(shift.openedAt).toLocaleTimeString("en-IN")}
            </div>
          )}
        </div>

        {loading && (
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="pos-skeleton h-6 w-28 rounded-full" />
                <div className="pos-skeleton h-3 w-40 rounded" />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-700 bg-slate-700/40 p-3">
                    <div className="pos-skeleton h-2.5 w-14 rounded" />
                    <div className="pos-skeleton mt-2 h-5 w-20 rounded" />
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                <div className="pos-skeleton h-2.5 w-20 rounded" />
                <div className="pos-skeleton mt-2 h-7 w-36 rounded" />
              </div>

              <div className="mt-6 border-t border-slate-700 pt-5">
                <div className="pos-skeleton h-3 w-2/3 rounded" />
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <div className="pos-skeleton mb-1 h-2.5 w-24 rounded" />
                    <div className="pos-skeleton h-10 w-56 rounded-xl" />
                  </div>
                  <div className="pos-skeleton h-10 w-28 rounded-xl" />
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="pos-skeleton h-3 w-16 rounded" />
                <div className="pos-skeleton h-6 w-16 rounded-lg" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-full">
                        <div className="pos-skeleton h-4 w-20 rounded" />
                        <div className="pos-skeleton mt-2 h-2.5 w-32 rounded" />
                      </div>
                      <div className="pos-skeleton h-4 w-14 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
        {msg && <div className="rounded-2xl border border-emerald-700 bg-emerald-900/40 px-4 py-3 text-sm text-emerald-300">{msg}</div>}
        {error && <div className="rounded-2xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>}

        {!loading && !shift && (
          <div className="rounded-3xl border border-slate-700 bg-slate-800/80 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">No active shift</h2>
            <p className="mt-1 text-sm text-slate-400">Enter opening cash and start the counter for this cashier.</p>
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Opening Cash (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-56 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500"
                />
              </div>
              <button
                onClick={openShift}
                disabled={opening}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
              >
                {opening ? "Opening..." : "Open Shift"}
              </button>
            </div>
          </div>
        )}

        {!loading && shift && (
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-full border border-emerald-700 bg-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-300">SHIFT OPEN</span>
                <span className="text-xs text-slate-400">Cashier: {shift.cashierId.slice(0, 8)}...</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Opening", value: formatINR(shift.openingBalance), tone: "text-white" },
                  { label: "Bills", value: String(shift._count?.bills ?? 0), tone: "text-white" },
                  { label: "Cash In", value: formatINR(cashIn), tone: "text-emerald-300" },
                  { label: "Cash Out", value: formatINR(cashOut), tone: "text-rose-300" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-2xl border border-slate-700 bg-slate-700/40 p-3">
                    <div className="text-xs text-slate-400">{kpi.label}</div>
                    <div className={`mt-1 text-lg font-bold ${kpi.tone}`}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                <div className="text-xs text-slate-400">Net Cash Flow</div>
                <div className={`mt-1 text-2xl font-bold ${netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {netCashFlow >= 0 ? "+" : "-"}{formatINR(Math.abs(netCashFlow))}
                </div>
              </div>

              <div className="mt-6 border-t border-slate-700 pt-5">
                <p className="text-sm text-slate-400">Count the cash drawer and enter the closing amount to close this shift.</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Closing Cash (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={closingBalance}
                      onChange={(e) => setClosingBalance(e.target.value)}
                      className="w-56 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-white outline-none transition-all duration-200 ease-out focus:border-rose-400"
                    />
                  </div>
                  <button
                    onClick={closeShift}
                    disabled={closing}
                    className="rounded-xl border border-rose-700 bg-rose-900/30 px-5 py-2.5 text-sm font-semibold text-rose-300 transition-all duration-200 ease-out hover:bg-rose-900/50 active:scale-[0.98] disabled:opacity-50"
                  >
                    {closing ? "Closing..." : "Close Shift"}
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Cash Log</h3>
                <span className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-400">{shift.entries?.length ?? 0} entries</span>
              </div>

              {shift.entries && shift.entries.length > 0 ? (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {shift.entries.map((entry, i) => {
                    const isOut = entry.type === "CASH_OUT" || entry.type === "REFUND";
                    return (
                      <div key={i} className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${isOut ? "bg-rose-900/50 text-rose-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                              {entry.type}
                            </span>
                            <div className="mt-1 text-xs text-slate-400">{entry.notes ?? "No notes"}</div>
                          </div>
                          <span className={`text-sm font-bold ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
                            {isOut ? "-" : "+"}{formatINR(entry.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                  No cash entries yet for this shift.
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
