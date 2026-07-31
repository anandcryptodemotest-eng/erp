"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, getAccessToken } from "@/lib/api";
import type { ProvisionTenantResponse } from "@erp/platform-core";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  users: number;
  modules: string[];
  lastLogin: string | null;
  storage: string | null;
  apiUsage: string | null;
};

export default function TenantsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProvisionTenantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan: "starter",
    adminEmail: "",
    adminPassword: "",
  });

  async function load() {
    const r = await api<{ data: TenantRow[] }>("/api/platform/tenants");
    setRows(r.data ?? []);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const r = await api<{ data: ProvisionTenantResponse }>("/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreated(r.data);
      setForm({ name: "", slug: "", plan: "starter", adminEmail: "", adminPassword: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Tenants</h2>
        </div>

        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        {created && (
          <div className="rounded-xl border border-[var(--ok)]/40 bg-[var(--ok)]/10 p-4 text-sm space-y-1">
            <p className="font-semibold text-[var(--ok)]">Tenant Ready</p>
            <p>Slug: {created.slug}</p>
            <p>Admin: {created.adminEmail}</p>
            <p>
              Login:{" "}
              <a className="underline text-[var(--accent)]" href={created.loginUrl} target="_blank" rel="noreferrer">
                {created.loginUrl}
              </a>
            </p>
          </div>
        )}

        <form
          onSubmit={onCreate}
          className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            placeholder="Name"
            className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            placeholder="slug"
            pattern="[a-z0-9-]+"
            className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Admin email"
            className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Admin password"
            className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          />
          <select
            className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
          >
            <option value="starter">starter</option>
            <option value="growth">growth</option>
            <option value="enterprise">enterprise</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create tenant"}
          </button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Last Login</th>
                <th className="px-3 py-2 font-medium">Users</th>
                <th className="px-3 py-2 font-medium">Modules</th>
                <th className="px-3 py-2 font-medium">Storage</th>
                <th className="px-3 py-2 font-medium">API Usage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <Link className="text-[var(--accent)] hover:underline" href={`/tenants/${t.id}`}>
                      {t.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)] font-mono">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2">{t.plan}</td>
                  <td className="px-3 py-2">{t.isActive ? "Active" : "Disabled"}</td>
                  <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{t.lastLogin ?? "—"}</td>
                  <td className="px-3 py-2">{t.users}</td>
                  <td className="px-3 py-2">{t.modules?.join(", ") || "—"}</td>
                  <td className="px-3 py-2">{t.storage ?? "—"}</td>
                  <td className="px-3 py-2">{t.apiUsage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
