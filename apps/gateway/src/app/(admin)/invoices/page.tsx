"use client";
import { useEffect, useState } from "react";
import { StatusBadge, WorkspaceHero } from "@erp/ui";
import { api, openAuthenticatedDocument } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

interface Invoice { id: string; number: string; type: string; status: string; total: number; paidAmount: number; dueDate: string; pdfUrl?: string | null; entityName?: string | null; customer?: { name: string } | null; vendor?: { name: string } | null; createdAt: string; }

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

  async function openPdf(inv: Invoice) {
    try {
      await openAuthenticatedDocument(inv.pdfUrl || `/api/invoices/${inv.id}/pdf`, `${inv.number}.pdf`);
      setMsg("");
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    <div className="ws-page">
      <WorkspaceHero
        eyebrow="Trading operations"
        title="Invoices"
        description="Issue, print, and record payment on tax invoices. Process orders on Order Desk."
      />
      <details className="mb-6 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-[var(--ink)]">How this works</summary>
        <div className="mt-3 space-y-3">
          <LeadToCashGuide current="invoices" />
          <LeadToCashUnderstanding current="invoices" />
        </div>
      </details>
      {msg && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      )}
      {loading ? <p className="text-[var(--ink-soft)]">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--mist)] border-b">
              <tr>{["Invoice #","Type","Party","Total","Paid","Status","Due",""].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => {
                const party = inv.entityName ?? inv.customer?.name ?? inv.vendor?.name ?? "—";
                const remaining = inv.total - (inv.paidAmount ?? 0);
                return (
                  <tr key={inv.id} className="hover:bg-[var(--mist)]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.number}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.type} />
                    </td>
                    <td className="px-4 py-3">{party}</td>
                    <td className="px-4 py-3 font-semibold">₹{inv.total?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">₹{(inv.paidAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {inv.pdfUrl ? (
                          <button type="button" onClick={() => void openPdf(inv)} className="ws-btn">PDF</button>
                        ) : null}
                        {inv.status === "DRAFT" && (
                          <button type="button" onClick={() => issue(inv.id)} className="ws-btn ws-btn--primary">Issue</button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.status !== "DRAFT" && remaining > 0 && (
                          <button type="button" onClick={() => { setPayModal(inv); setPayAmount(remaining.toFixed(2)); setMsg(""); }}
                            className="ws-btn">Record payment</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-soft)]">No invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-[var(--ink)] mb-1">Record Payment</h2>
            <p className="text-sm text-[var(--ink-soft)] mb-4">{payModal.number}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Amount (₹)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {["BANK_TRANSFER","CASH","CHEQUE","UPI"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={pay} className="ws-btn ws-btn--primary flex-1">Confirm</button>
              <button type="button" onClick={() => setPayModal(null)} className="ws-btn flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
