"use client";
import { useEffect, useState } from "react";
import { Button, PageScaffold, StatusBadge } from "@erp/ui";
import { api } from "@/lib/admin-api";

interface Payroll { id: string; period: string; status: string; netSalary: number; employee: { firstName: string; lastName: string } | null; }
interface Employee { id: string; employeeId: string; firstName: string; lastName: string; }

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: "", period: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`, allowances: "0", deductions: "0" });

  async function load() {
    setLoading(true);
    try {
      const [pr, emp] = await Promise.all([api("/api/payroll?limit=50"), api("/api/employees?limit=100")]);
      setPayrolls(pr.data); setEmployees(emp.data);
      if (emp.data.length > 0) setForm(f => ({ ...f, employeeId: emp.data[0].employeeId }));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/payroll", { method: "POST", body: JSON.stringify({ employeeId: form.employeeId, period: form.period, allowances: Number(form.allowances), deductions: Number(form.deductions) }) });
      setMsg("✓ Payroll created"); setShowForm(false); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function process(id: string) {
    try {
      await api(`/api/payroll/${id}?action=process`, { method: "PATCH", body: JSON.stringify({}) });
      setMsg("✓ Payroll processed"); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function pay(id: string) {
    try {
      await api(`/api/payroll/${id}?action=pay`, { method: "PATCH", body: JSON.stringify({}) });
      setMsg("✓ Marked as paid"); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return (
    <PageScaffold
      hero={{
        eyebrow: "HR",
        title: "Payroll",
        description: "Generate and process payroll runs.",
        actions: (
          <Button type="button" onClick={() => { setShowForm(true); setMsg(""); }}>
            + Create payroll
          </Button>
        ),
      }}
    >
      {msg && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      )}
      {loading ? <p className="text-[var(--ink-soft)]">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--mist)] border-b">
              <tr>{["Employee","Period","Net Salary","Status",""].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {payrolls.map(pr => (
                <tr key={pr.id} className="hover:bg-[var(--mist)]">
                  <td className="px-4 py-3">{pr.employee ? `${pr.employee.firstName} ${pr.employee.lastName}` : "—"}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{pr.period}</td>
                  <td className="px-4 py-3 font-semibold">₹{pr.netSalary?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td className="px-4 py-3">
                    {pr.status === "DRAFT" && (
                      <button type="button" onClick={() => process(pr.id)} className="ws-btn">Process</button>
                    )}
                    {pr.status === "PROCESSED" && (
                      <button type="button" onClick={() => pay(pr.id)} className="ws-btn ws-btn--primary">Mark paid</button>
                    )}
                  </td>
                </tr>
              ))}
              {payrolls.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)]">No payroll records yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-[var(--ink)] mb-4">New Payroll Entry</h2>
            <form onSubmit={generate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Employee</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
                  {employees.map(e => <option key={e.id} value={e.employeeId}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Period (YYYY-MM)</label>
                <input type="text" placeholder="2026-01" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Allowances (₹)</label>
                  <input type="number" value={form.allowances} onChange={e => setForm(f => ({ ...f, allowances: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Deductions (₹)</label>
                  <input type="number" value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="ws-btn ws-btn--primary flex-1">Generate</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-[var(--mist)] text-[var(--ink-soft)] py-2 rounded-lg text-sm hover:bg-[color-mix(in_srgb,var(--mist)_80%,var(--ink-soft))]">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
