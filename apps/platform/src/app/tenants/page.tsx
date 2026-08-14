"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, PageScaffold, StatusChip } from "@erp/ui";
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
    customerDomain: "",
    adminDomain: "",
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
      setForm({ name: "", slug: "", plan: "starter", adminEmail: "", adminPassword: "", customerDomain: "", adminDomain: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm shadow-[var(--shadow-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

  return (
    <Shell>
      <PageScaffold
        hero={{
          eyebrow: "Platform",
          title: "Tenants",
          description: "Provision Sankalp companies and open tenant admin.",
        }}
      >
        <div className="space-y-6">
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {created && (
          <div className="space-y-1 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] p-4 text-sm">
            <p className="font-semibold text-[var(--success)]">Tenant Ready</p>
            <p>Slug: {created.slug}</p>
            <p>Admin: {created.adminEmail}</p>
            <p>
              Login:{" "}
              <a className="text-[var(--brand)] underline" href={created.loginUrl} target="_blank" rel="noreferrer">
                {created.loginUrl}
              </a>
            </p>
          </div>
        )}

        <form
          onSubmit={onCreate}
          className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            placeholder="Name"
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            placeholder="slug (e.g. acme-corp)"
            pattern="[-a-z0-9]+"
            title="Lowercase letters, numbers, and hyphens only"
            className={fieldClass}
            value={form.slug}
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
              })
            }
          />
          <input
            required
            type="email"
            placeholder="Admin email"
            className={fieldClass}
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Admin password"
            className={fieldClass}
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          />
          <input
            placeholder="Customer domain (optional)"
            className={fieldClass}
            value={form.customerDomain}
            onChange={(e) => setForm({ ...form, customerDomain: e.target.value })}
          />
          <input
            placeholder="Admin domain (optional)"
            className={fieldClass}
            value={form.adminDomain}
            onChange={(e) => setForm({ ...form, adminDomain: e.target.value })}
          />
          <select
            className={fieldClass}
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
          >
            <option value="starter">starter</option>
            <option value="growth">growth</option>
            <option value="enterprise">enterprise</option>
          </select>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create tenant"}
          </Button>
        </form>

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-sunken)] text-[var(--ink-soft)]">
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
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <Link className="font-medium text-[var(--brand)] hover:underline" href={`/tenants/${t.id}`}>
                      {t.name}
                    </Link>
                    <div className="font-mono text-xs text-[var(--ink-soft)]">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2">{t.plan}</td>
                  <td className="px-3 py-2">
                    <StatusChip tone={t.isActive ? "success" : "neutral"}>
                      {t.isActive ? "Active" : "Disabled"}
                    </StatusChip>
                  </td>
                  <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{t.lastLogin ?? "—"}</td>
                  <td className="px-3 py-2">{t.users}</td>
                  <td className="px-3 py-2">{t.modules?.join(", ") || "—"}</td>
                  <td className="px-3 py-2">{t.storage ?? "—"}</td>
                  <td className="px-3 py-2">{t.apiUsage ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link
                      className="inline-flex rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--mist)]"
                      href={`/tenants/${t.id}`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </PageScaffold>
    </Shell>
  );
}
