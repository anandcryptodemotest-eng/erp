"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getUserId } from "@/lib/api-client";

interface Bill { id: string; billNumber: string; total: number; createdAt: string; status: string; items?: { name: string; qty: number }[] }

export default function HoldsPage() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ data: Bill[] }>("accounting", "/api/bills?status=HELD&limit=20");
    if (!res.error) setBills(res.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resumeBill(bill: Bill) {
    setResuming(bill.id); setError("");
    // Mark as COMPLETED
    const res = await api("accounting", `/api/bills/${bill.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setResuming(null);
    if (res.error) { setError(res.error); return; }
    // Refresh list
    load();
  }

  async function cancelBill(id: string) {
    setError("");
    const res = await api("accounting", `/api/bills/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.error) { setError(res.error); return; }
    load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Held Bills</h1>
        <button onClick={load} className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-white">
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</div>}

      {loading && <div className="text-slate-400">Loading…</div>}

      {!loading && bills.length === 0 && (
        <div className="flex flex-col items-center py-16 text-slate-600">
          <div className="text-5xl mb-3">⏸️</div>
          <div className="text-sm">No held bills</div>
        </div>
      )}

      {!loading && bills.length > 0 && (
        <div className="space-y-3">
          {bills.map((bill) => (
            <div key={bill.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-bold text-white">{bill.billNumber}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{new Date(bill.createdAt).toLocaleString("en-IN")}</div>
                  {bill.items && (
                    <div className="mt-2 text-xs text-slate-500">
                      {bill.items.slice(0, 3).map((i) => `${i.name} ×${i.qty}`).join(", ")}
                      {bill.items.length > 3 && ` +${bill.items.length - 3} more`}
                    </div>
                  )}
                </div>
                <div className="text-lg font-bold text-emerald-400">₹{Number(bill.total).toLocaleString("en-IN")}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => resumeBill(bill)} disabled={resuming === bill.id}
                  className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  {resuming === bill.id ? "Processing…" : "▶ Complete"}
                </button>
                <button onClick={() => cancelBill(bill.id)}
                  className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-900/50">
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
