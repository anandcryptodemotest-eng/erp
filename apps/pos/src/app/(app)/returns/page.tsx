"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";

interface BillItem { id: string; name: string; sku: string; qty: number; unitPrice: number }
interface Bill { id: string; billNumber: string; total: number; items: BillItem[]; status: string }

export default function ReturnsPage() {
  const [billNumber, setBillNumber] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Return quantities per item
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function searchBill() {
    if (!billNumber.trim()) return;
    setSearching(true); setSearchError(""); setBill(null); setReturnQtys({});
    const res = await api<{ data: Bill[] }>("accounting", `/api/bills?billNumber=${encodeURIComponent(billNumber.trim())}&limit=1`);
    setSearching(false);
    if (res.error || res.data.data.length === 0) {
      setSearchError("Bill not found"); return;
    }
    const found = res.data.data[0];
    // Fetch full detail with items
    const detail = await api<{ data: Bill }>("accounting", `/api/bills/${found.id}`);
    if (detail.error) { setSearchError(detail.error); return; }
    setBill(detail.data.data);
    const initial: Record<string, number> = {};
    detail.data.data.items.forEach((i) => { initial[i.id] = 0; });
    setReturnQtys(initial);
  }

  async function processReturn() {
    if (!bill) return;
    const items = bill.items
      .filter((i) => (returnQtys[i.id] ?? 0) > 0)
      .map((i) => ({ billItemId: i.id, qty: returnQtys[i.id] }));

    if (items.length === 0) { setError("Select at least one item to return"); return; }
    setProcessing(true); setError(""); setSuccess("");

    const res = await api<{ data: { id: string; refundAmount: number } }>(
      "accounting", `/api/bills/${bill.id}/returns`,
      { method: "POST", body: JSON.stringify({ items, reason }) }
    );
    setProcessing(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(`Return processed — Refund ₹${Number(res.data.data.refundAmount).toLocaleString("en-IN")}`);
    setBill(null); setBillNumber(""); setReturnQtys({});
  }

  const totalRefund = bill
    ? bill.items.reduce((s, i) => s + i.unitPrice * (returnQtys[i.id] ?? 0), 0)
    : 0;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="mb-6 text-xl font-bold text-white">Process Return</h1>

      {success && <div className="mb-4 rounded-xl bg-emerald-900/40 border border-emerald-700 px-4 py-3 text-sm text-emerald-300">{success}</div>}

      {/* Bill search */}
      <div className="mb-6 flex gap-3">
        <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchBill()}
          placeholder="Enter bill number…"
          className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500" />
        <button onClick={searchBill} disabled={searching}
          className="rounded-xl bg-slate-700 border border-slate-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50">
          {searching ? "…" : "Find Bill"}
        </button>
      </div>

      {searchError && <div className="mb-4 rounded-xl bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{searchError}</div>}
      {error && <div className="mb-4 rounded-xl bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</div>}

      {bill && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-white">{bill.billNumber}</div>
              <div className="text-xs text-slate-400">Total: ₹{Number(bill.total).toLocaleString("en-IN")}</div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${bill.status === "COMPLETED" ? "bg-emerald-900 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
              {bill.status}
            </span>
          </div>

          {/* Items with return qty */}
          <div className="space-y-2 mb-5">
            {bill.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-700/50 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-xs text-slate-400">{item.sku} · Sold: {item.qty} × ₹{Number(item.unitPrice).toLocaleString("en-IN")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Return:</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 1) }))}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-500">−</button>
                    <span className="w-6 text-center text-sm font-bold text-white">{returnQtys[item.id] ?? 0}</span>
                    <button onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.min(item.qty, (q[item.id] ?? 0) + 1) }))}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-500">+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Reason (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Damaged, wrong item, customer changed mind…"
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
          </div>

          {/* Refund total */}
          {totalRefund > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-900/30 border border-emerald-800 px-4 py-3">
              <span className="text-sm text-emerald-300 font-medium">Refund Amount</span>
              <span className="text-lg font-bold text-emerald-400">₹{totalRefund.toLocaleString("en-IN")}</span>
            </div>
          )}

          <button onClick={processReturn} disabled={processing || totalRefund === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
            {processing ? "Processing…" : "Process Return & Refund"}
          </button>
        </div>
      )}
    </div>
  );
}
