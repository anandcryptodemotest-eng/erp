"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getTenantId } from "@/lib/admin-api";
import { PageHeader, Button, Input } from "@erp/ui";

const OMS_ROLES = [
  "ADMIN",
  "MANAGER",
  "SALES_EXECUTIVE",
  "PRICING_EXECUTIVE",
  "DISPATCH_EXECUTIVE",
  "DELIVERY_EXECUTIVE",
  "ACCOUNTANT",
  "PROCUREMENT_OFFICER",
  "USER",
] as const;

type Member = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
};

export default function AdminUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<string[]>([...OMS_ROLES]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("Test@123");
  const [role, setRole] = useState<string>("SALES_EXECUTIVE");
  const [newRole, setNewRole] = useState("");

  const tenantId = typeof window !== "undefined" ? getTenantId() : "";

  const load = useCallback(async () => {
    if (!tenantId) {
      setError("No tenant in session — log in again");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/api/tenants/${tenantId}/users?limit=100`);
      setMembers(r.data ?? []);
      if (r.meta?.roles) setRoles(r.meta.roles);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    const code = newRole.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!code) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await api(`/api/tenants/${tenantId}/roles`, {
        method: "POST",
        body: JSON.stringify({ role: code }),
      });
      if (r.data) setRoles(r.data);
      setMessage(r.message ?? `Role ${code} added`);
      setNewRole("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add role");
    } finally {
      setBusy(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const r = await api(`/api/tenants/${tenantId}/users`, {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          email: email.trim(),
          name: name.trim() || undefined,
          password,
          role,
        }),
      });
      setMessage(r.data?.message ?? `Created ${email} as ${role}`);
      setEmail("");
      setName("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: string) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tenants/${tenantId}/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setMessage("Role updated");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <PageHeader title="Users & roles" />
        <p className="-mt-4 mb-2 text-sm text-slate-500">
          Create team members for this tenant and assign OMS roles. Workflow tasks use the same role names
          (e.g. Pricing task → <code className="text-xs">PRICING_EXECUTIVE</code> user).
        </p>
        <p className="text-xs text-slate-400 font-mono">Tenant: {tenantId || "—"}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <form
        onSubmit={(e) => void addRole(e)}
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-900">Add role</h2>
        <p className="text-xs text-slate-500">
          Custom roles (UPPER_SNAKE_CASE) can be assigned to users and to workflow tasks. Built-in OMS roles are
          always available.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm flex-1 min-w-[200px]">
            <span className="text-slate-600">Role code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              placeholder="e.g. CREDIT_MANAGER"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              required
            />
          </label>
          <Button type="submit" disabled={busy}>
            Add role
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {roles.map((r) => (
            <span key={r} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              {r}
            </span>
          ))}
        </div>
      </form>

      <form
        onSubmit={(e) => void createUser(e)}
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-900">Create user</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          <Input
            label="Password"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="block text-sm">
            <span className="text-slate-600">Role</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create user"}
        </Button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.name || "—"}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => void changeRole(m.userId, e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">Admin setup checklist</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>
            <strong>Users</strong> — create Pricing / Dispatch / Sales users with matching roles (this page).
          </li>
          <li>
            <strong>Workflows</strong> — clone SO_STANDARD draft, set each task’s Role dropdown, publish.
          </li>
          <li>
            <strong>OMS</strong> — each user logs in and only sees tasks for their role.
          </li>
        </ol>
      </div>
    </div>
  );
}
