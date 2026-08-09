"use client";
import { useEffect, useState } from "react";
import { WorkspaceHero } from "@erp/ui";
import { api } from "@/lib/admin-api";

interface Vendor { id: string; name: string; phone: string; email: string; gstNumber: string; }

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", gstNumber: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try { const r = await api("/api/vendors?limit=100"); setVendors(r.data); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/vendors", { method: "POST", body: JSON.stringify(form) });
      setMsg("✓ Vendor created"); setShowForm(false); setForm({ name: "", phone: "", email: "", gstNumber: "" }); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return (
    <div className="ws-page">
      <WorkspaceHero
        eyebrow="Procurement"
        title="Vendors"
        description="Supplier contacts for purchase orders and shortage work."
        actions={
          <button type="button" onClick={() => setShowForm(true)} className="ws-btn ws-btn--primary">
            + New vendor
          </button>
        }
      />
      {msg && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      )}
      {loading ? <p className="text-[var(--ink-soft)]">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--mist)] border-b">
              <tr>{["Name","Phone","Email","GST Number"].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-[var(--mist)]">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{v.phone}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{v.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.gstNumber ?? "—"}</td>
                </tr>
              ))}
              {vendors.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--ink-soft)]">No vendors yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="font-bold text-[var(--ink)] mb-4">New Vendor</h2>
            <form onSubmit={create} className="space-y-3">
              {[["Name","text","name"],["Phone","tel","phone"],["Email","email","email"],["GST Number","text","gstNumber"]].map(([label,type,key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">{label}</label>
                  <input type={type} value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="ws-btn ws-btn--primary flex-1">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="ws-btn flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
