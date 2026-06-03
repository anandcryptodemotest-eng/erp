"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

interface Invoice { id: string; number: string; type: string; status: string; total: number; paidAmount: number; dueDate: string; customer?: { name: string } | null; vendor?: { name: string } | null; createdAt: string; }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [payModal, setPayModal] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10));

  async function load() {
    setLoading(true);
    try { const r = await api("/api/invoices?limit=50"); setInvoices(r.data); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function issue(id: string) {
    try {
      await api(`/api/invoices/${id}?action=issue`, { method: "PATCH", body: JSON.stringify({}) });
      setMsg("✓ Invoice issued"); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function pay() {
    if (!payModal) return;
    try {
      await api(`/api/invoices/${payModal.id}?action=pay`, {
        method: "PATCH",
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod, date: new Date(payDate).toISOString() }),
      });
      setMsg(`✓ Payment of ₹${payAmount} recorded`);
      setPayModal(null); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return (
    <div className="p-8">
      <LeadToCashGuide current="invoices" />
      <LeadToCashUnderstanding current="invoices" />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
      </div>
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Invoice #","Type","Party","Total","Paid","Status","Due",""].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => {
                const party = inv.customer?.name ?? inv.vendor?.name ?? "—";
                const remaining = inv.total - (inv.paidAmount ?? 0);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.number}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.type === "AR" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{inv.type}</span>
                    </td>
                    <td className="px-4 py-3">{party}</td>
                    <td className="px-4 py-3 font-semibold">₹{inv.total?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">₹{(inv.paidAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {inv.status === "DRAFT" && (
                          <button onClick={() => issue(inv.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Issue</button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.status !== "DRAFT" && remaining > 0 && (
                          <button onClick={() => { setPayModal(inv); setPayAmount(remaining.toFixed(2)); setMsg(""); }}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Pay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-gray-900 mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-4">{payModal.number}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {["BANK_TRANSFER","CASH","CHEQUE","UPI"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={pay} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700">Confirm</button>
              <button onClick={() => setPayModal(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
