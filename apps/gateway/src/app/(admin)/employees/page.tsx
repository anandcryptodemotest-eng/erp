"use client";
import { useEffect, useState } from "react";
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <button onClick={() => setShowForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">+ New Employee</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["ID","Name","Position","Department","Salary"].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employeeId}</td>
                  <td className="px-4 py-3 font-medium">{emp.firstName} {emp.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.position}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.department}</td>
                  <td className="px-4 py-3 font-semibold">₹{emp.salary?.toLocaleString()}</td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No employees yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="font-bold text-gray-900 mb-4">New Employee</h2>
            <form onSubmit={create} className="space-y-3">
              {[
                ["Employee ID","text","employeeId"],["First Name","text","firstName"],["Last Name","text","lastName"],
                ["Email","email","email"],["Phone","tel","phone"],
                ["Position","text","position"],["Department","text","department"],
                ["Salary","number","salary"],["Hire Date","date","hireDate"],
              ].map(([label,type,key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} required={["employeeId","firstName","lastName","email","position","department","hireDate"].includes(key)}
                    value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
