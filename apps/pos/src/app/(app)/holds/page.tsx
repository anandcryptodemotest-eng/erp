"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";

interface BillItemPreview { productName: string; quantity: number }
interface Bill { id: string; billNumber: string; total: number; createdAt: string; status: string; items?: BillItemPreview[] }
interface Warehouse { id: string; name: string }

export default function HoldsPage() {
  const [isReady, setIsReady] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ data: Bill[] }>("accounting", "/api/bills?status=HELD&limit=20");
    if (!res.error) setBills(res.data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    api<{ data: Warehouse[] }>("inventory", "/api/warehouses?limit=50").then((res) => {
      if (!res.error) {
        setWarehouses(res.data.data);
        if (res.data.data.length > 0) setWarehouseId(res.data.data[0].id);
      }
    });
  }, [load]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function resumeBill(bill: Bill) {
    if (!warehouseId) { setError("Select a warehouse before completing a held bill"); return; }
    setResuming(bill.id); setError("");
    // Mark as COMPLETED
    const res = await api("accounting", `/api/bills/${bill.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED", warehouseId }),
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

  const totalHeldValue = bills.reduce((sum, bill) => sum + Number(bill.total), 0);

  return (
    <div className={`relative p-4 transition-all duration-500 sm:p-6 ${isReady ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent" />
      <div className="relative mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Held Bills</h1>
            <p className="mt-1 text-sm text-slate-400">Resume parked bills quickly or cancel them safely.</p>
          </div>
          <button onClick={load} className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-300 transition-all duration-200 ease-out hover:bg-slate-700 hover:text-white active:scale-[0.98]">
          Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-600">
            <div className="text-xs text-slate-400">Held Bills</div>
            <div className="mt-1 text-xl font-bold text-white">{bills.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-600">
            <div className="text-xs text-slate-400">Held Value</div>
            <div className="mt-1 text-xl font-bold text-emerald-300">₹{totalHeldValue.toLocaleString("en-IN")}</div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-600">
            <label className="mb-1 block text-xs font-medium text-slate-400">Warehouse for completion</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>}

        {loading && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                <div className="pos-skeleton h-4 w-1/2 rounded" />
                <div className="pos-skeleton mt-2 h-3 w-1/3 rounded" />
                <div className="pos-skeleton mt-4 h-10 rounded-xl" />
                <div className="mt-4 flex gap-2">
                  <div className="pos-skeleton h-8 flex-1 rounded-xl" />
                  <div className="pos-skeleton h-8 w-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && bills.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/70 py-16 text-slate-500">
            <div className="mb-3 text-5xl">⏸️</div>
            <div className="text-sm">No held bills</div>
          </div>
        )}

        {!loading && bills.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bills.map((bill, idx) => (
              <div
                key={bill.id}
                style={{ transitionDelay: `${idx * 35}ms` }}
                className={`rounded-2xl border border-slate-700 bg-slate-800/85 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-600 ${isReady ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-bold text-white">{bill.billNumber}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{new Date(bill.createdAt).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-2 py-1 text-sm font-bold text-emerald-300">
                    ₹{Number(bill.total).toLocaleString("en-IN")}
                  </div>
                </div>

                {bill.items && (
                  <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                    {bill.items.slice(0, 3).map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                    {bill.items.length > 3 && ` +${bill.items.length - 3} more`}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => resumeBill(bill)}
                    disabled={resuming === bill.id}
                    className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white transition-all duration-200 ease-out hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
                  >
                    {resuming === bill.id ? "Processing..." : "Complete"}
                  </button>
                  <button
                    onClick={() => cancelBill(bill.id)}
                    className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-2 text-xs font-medium text-red-300 transition-all duration-200 ease-out hover:bg-red-900/50 active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
