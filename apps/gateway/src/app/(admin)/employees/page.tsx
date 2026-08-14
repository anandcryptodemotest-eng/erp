"use client";
import { useEffect, useState } from "react";
import { Button, PageScaffold } from "@erp/ui";
import { api } from "@/lib/admin-api";

interface Employee { id: string; employeeId: string; firstName: string; lastName: string; position: string; department: string; salary: number; isActive: boolean; }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: "", firstName: "", lastName: "", email: "", phone: "", position: "", department: "", salary: "25000", hireDate: new Date().toISOString().slice(0,10) });
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try { const r = await api("/api/employees?limit=100"); setEmployees(r.data); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/employees", { method: "POST", body: JSON.stringify({ ...form, salary: Number(form.salary) }) });
      setMsg("✓ Employee created"); setShowForm(false); load();
    } catch (err: unknown) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return (
    <PageScaffold
      hero={{
        eyebrow: "HR",
        title: "Employees",
        description: "Staff master data. Trading work stays on Order Desk.",
        actions: (
          <Button type="button" onClick={() => setShowForm(true)}>
            + New employee
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
              <tr>{["ID","Name","Position","Department","Salary"].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-[var(--mist)]">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employeeId}</td>
                  <td className="px-4 py-3 font-medium">{emp.firstName} {emp.lastName}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{emp.position}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{emp.department}</td>
                  <td className="px-4 py-3 font-semibold">₹{emp.salary?.toLocaleString()}</td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)]">No employees yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="font-bold text-[var(--ink)] mb-4">New Employee</h2>
            <form onSubmit={create} className="space-y-3">
              {[
                ["Employee ID","text","employeeId"],["First Name","text","firstName"],["Last Name","text","lastName"],
                ["Email","email","email"],["Phone","tel","phone"],
                ["Position","text","position"],["Department","text","department"],
                ["Salary","number","salary"],["Hire Date","date","hireDate"],
              ].map(([label,type,key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">{label}</label>
                  <input type={type} required={["employeeId","firstName","lastName","email","position","department","hireDate"].includes(key)}
                    value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
    </PageScaffold>
  );
}
