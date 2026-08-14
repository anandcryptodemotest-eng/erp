"use client";
import { useEffect, useState } from "react";
import { api, getAdminUser } from "@/lib/admin-api";
import { Button, PageScaffold, Skeleton, StatusBadge } from "@erp/ui";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: number;
  isBlocked?: boolean;
  portalUserId?: string | null;
}

interface CustomerDetail extends Customer {
  address?: string | null;
  city?: string | null;
  outstandingBalance?: number;
  addresses?: {
    id: string;
    label: string;
    line1: string;
    city: string;
    state?: string | null;
    pincode: string;
    isDefault: boolean;
  }[];
  orders?: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    date: string;
  }[];
}

const SALES_ROLES = new Set(["SALES_EXECUTIVE", "SALES_REP"]);

export default function CustomersPage() {
  const role = getAdminUser()?.role ?? "";
  const isSalesLookup = SALES_ROLES.has(role);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api("/api/customers?limit=100");
      setCustomers(r.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openCustomer(id: string) {
    setDetailLoading(true);
    try {
      const r = await api(`/api/customers/${id}`);
      setSelected(r.data);
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDetailLoading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/customers", { method: "POST", body: JSON.stringify(form) });
      setMsg("Customer created");
      setShowForm(false);
      setForm({ name: "", phone: "", email: "" });
      load();
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <PageScaffold
      hero={{
        eyebrow: "Trading operations",
        title: isSalesLookup ? "Customer lookup" : "Customers",
        description: isSalesLookup
          ? "Find buyers and recent orders while reviewing sales requests."
          : "Customer master data for trading and portal accounts.",
        actions: (
          <Button type="button" onClick={() => setShowForm(true)}>
            + New customer
          </Button>
        ),
      }}
    >
      <div className="space-y-6">
      {msg && (
        <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2 text-sm text-[var(--success)]">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or email…"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm shadow-[var(--shadow-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          />
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--surface-sunken)]">
                  <tr>
                    {["Name", "Phone", "Email", "Credit", "Portal"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-[var(--ink-soft)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={`cursor-pointer hover:bg-[var(--mist)] ${selected?.id === c.id ? "bg-[color-mix(in_srgb,var(--brand)_6%,white)]" : ""}`}
                      onClick={() => openCustomer(c.id)}
                    >
                      <td className="px-4 py-3 font-medium">
                        {c.name}
                        {c.isBlocked && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-[var(--danger)]">Blocked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-soft)]">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-soft)]">{c.email ?? "—"}</td>
                      <td className="px-4 py-3">₹{Number(c.creditLimit ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-soft)]">
                        {c.portalUserId ? "Linked" : "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)]">
                        No customers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 min-h-[320px]">
          {detailLoading && <p className="text-sm text-[var(--ink-soft)]">Loading detail…</p>}
          {!detailLoading && !selected && (
            <p className="text-sm text-[var(--ink-soft)]">Select a customer to see addresses, credit and recent orders.</p>
          )}
          {!detailLoading && selected && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ink)]">{selected.name}</h2>
                <p className="text-sm text-[var(--ink-soft)]">
                  {[selected.phone, selected.email].filter(Boolean).join(" · ") || "No contact"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[var(--mist)] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)]">Credit limit</div>
                  <div className="font-semibold">₹{Number(selected.creditLimit ?? 0).toLocaleString("en-IN")}</div>
                </div>
                <div className="rounded-lg bg-[var(--mist)] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)]">Outstanding</div>
                  <div className="font-semibold">
                    ₹{Number(selected.outstandingBalance ?? 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
              {selected.isBlocked && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Blocked — cannot convert new orders until cleared.
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">Addresses</h3>
                <ul className="space-y-2 text-sm text-[var(--ink-soft)]">
                  {(selected.addresses ?? []).map((a) => (
                    <li key={a.id} className="rounded-lg border border-[var(--line)] p-2">
                      <span className="font-medium">{a.label}</span>
                      {a.isDefault && <span className="ml-2 text-[10px] text-amber-700">DEFAULT</span>}
                      <div className="text-xs text-[var(--ink-soft)] mt-0.5">
                        {[a.line1, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                      </div>
                    </li>
                  ))}
                  {(selected.addresses ?? []).length === 0 && (
                    <li className="text-xs text-[var(--ink-soft)]">{selected.address || "No addresses on file"}</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">Recent orders</h3>
                <ul className="space-y-2">
                  {(selected.orders ?? []).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">{o.orderNumber}</span>
                      <StatusBadge status={o.status} />
                      <span className="text-[var(--ink-soft)]">₹{Number(o.total).toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                  {(selected.orders ?? []).length === 0 && (
                    <li className="text-xs text-[var(--ink-soft)]">No prior orders</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-4)]">
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--ink)]">New Customer</h2>
            <form onSubmit={create} className="space-y-3">
              {(
                [
                  ["Name", "text", "name"],
                  ["Phone", "tel", "phone"],
                  ["Email", "email", "email"],
                ] as const
              ).map(([label, type, key]) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-[var(--ink-soft)]">{label}</label>
                  <input
                    type={type}
                    required={key === "name"}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">
                  Create
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PageScaffold>
  );
}
