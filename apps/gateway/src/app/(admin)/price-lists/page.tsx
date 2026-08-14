"use client";
import { useEffect, useState } from "react";
import { ActionGroup, Button, PageScaffold, Trash2 } from "@erp/ui";
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
    <PageScaffold
      hero={{
        eyebrow: "Catalog",
        title: "Price lists",
        description: "Operational list prices. Quotes still run through the pricing engine.",
        actions: (
          <Button type="button" onClick={() => setShowForm(true)}>
            + New price list
          </Button>
        ),
      }}
    >
      {msg && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      )}
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
              <button type="submit" className="ws-btn ws-btn--primary flex-1">
                Create
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="ws-btn flex-1">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </PageScaffold>
  );
}
