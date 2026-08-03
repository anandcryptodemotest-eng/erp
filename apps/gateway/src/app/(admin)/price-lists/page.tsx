"use client";
import { useEffect, useState } from "react";
import { ActionGroup, Button, Trash2 } from "@erp/ui";
import { api } from "@/lib/admin-api";

const iconSm = { width: "var(--icon-sm)", height: "var(--icon-sm)" } as const;
const deleteIconBtn =
  "text-[var(--ink-soft)] hover:text-[var(--danger)] focus-visible:text-[var(--danger)]";

interface PriceList {
  id: string;
  name: string;
  description?: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", currency: "INR", isDefault: false });
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api("/api/price-lists?limit=100");
      setLists(r.data ?? []);
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/price-lists", { method: "POST", body: JSON.stringify(form) });
      setMsg("Price list created");
      setShowForm(false);
      setForm({ name: "", description: "", currency: "INR", isDefault: false });
      load();
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function remove(list: PriceList) {
    if (!confirm(`Delete price list "${list.name}"? It will be deactivated (soft delete).`)) return;
    try {
      await api(`/api/price-lists/${list.id}`, { method: "DELETE" });
      setMsg(`Price list "${list.name}" deleted`);
      load();
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Price Lists</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Operational list prices — quotes still run through @erp/pricing.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
        >
          + New Price List
        </button>
      </div>
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      {loading ? (
        <p className="text-[var(--ink-soft)]">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--mist)] border-b">
              <tr>
                {["Name", "Currency", "Default", "Active", ""].map((h) => (
                  <th key={h || "actions"} className="px-3 py-2.5 text-left font-medium text-[var(--ink-soft)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lists.map((l) => (
                <tr key={l.id} className="hover:bg-[var(--mist)]">
                  <td className="px-3 py-2.5 font-medium">{l.name}</td>
                  <td className="px-3 py-2.5 text-[var(--ink-soft)]">{l.currency}</td>
                  <td className="px-3 py-2.5">{l.isDefault ? "Yes" : "—"}</td>
                  <td className="px-3 py-2.5">{l.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <ActionGroup aria-label="Row actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={deleteIconBtn}
                        aria-label={`Delete price list ${l.name}`}
                        title="Delete price list"
                        onClick={() => void remove(l)}
                      >
                        <Trash2 style={iconSm} aria-hidden />
                      </Button>
                    </ActionGroup>
                  </td>
                </tr>
              ))}
              {lists.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[var(--ink-soft)]">
                    No price lists yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={create} className="bg-white rounded-xl shadow-xl p-6 w-96 space-y-3">
            <h2 className="text-lg font-semibold">New Price List</h2>
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Default list
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
                Create
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
