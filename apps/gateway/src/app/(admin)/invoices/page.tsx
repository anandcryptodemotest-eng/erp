"use client";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageScaffold, Skeleton, StatusBadge } from "@erp/ui";
import { api, openAuthenticatedDocument } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

interface Invoice {
  id: string;
  number: string;
  type: string;
  status: string;
  total: number;
  paidAmount: number;
  dueDate: string;
  pdfUrl?: string | null;
  entityName?: string | null;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  createdAt: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [payModal, setPayModal] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    try {
      const r = await api("/api/invoices?limit=50");
      setInvoices(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function issue(id: string) {
    try {
      await api(`/api/invoices/${id}?action=issue`, { method: "PATCH", body: JSON.stringify({}) });
      setMsg("Invoice issued");
      void load();
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
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
        body: JSON.stringify({
          amount: Number(payAmount),
          method: payMethod,
          date: new Date(payDate).toISOString(),
        }),
      });
      setMsg(`Payment of ₹${payAmount} recorded`);
      setPayModal(null);
      void load();
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <PageScaffold
      hero={{
        eyebrow: "Trading operations",
        title: "Invoices",
        description: "Issue, print, and record payment on tax invoices. Process orders on Order Desk.",
      }}
    >
      <details className="mb-6 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-sm shadow-[var(--shadow-1)]">
        <summary className="cursor-pointer font-semibold text-[var(--ink)]">How this works</summary>
        <div className="mt-3 space-y-3">
          <LeadToCashGuide current="invoices" />
          <LeadToCashUnderstanding current="invoices" />
        </div>
      </details>
      {msg ? (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices yet" subtitle="Invoices appear after fulfilment on Order Desk." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-sunken)]">
              <tr>
                {["Invoice #", "Type", "Party", "Total", "Paid", "Status", "Due", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {invoices.map((inv) => {
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
                    <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {inv.status === "DRAFT" ? (
                          <Button type="button" size="sm" onClick={() => void issue(inv.id)}>
                            Issue
                          </Button>
                        ) : null}
                        {remaining > 0 && inv.status !== "DRAFT" && inv.status !== "CANCELLED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setPayModal(inv);
                              setPayAmount(remaining.toFixed(2));
                              setMsg("");
                            }}
                          >
                            Pay
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="ghost" onClick={() => void openPdf(inv)}>
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {payModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-4)]">
            <h2 className="mb-4 font-display text-lg font-semibold">Record payment — {payModal.number}</h2>
            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink-soft)]">Amount</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink-soft)]">Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                >
                  {["BANK_TRANSFER", "UPI", "CASH", "CHEQUE", "CARD"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink-soft)]">Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => void pay()}>
                Confirm
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setPayModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageScaffold>
  );
}
