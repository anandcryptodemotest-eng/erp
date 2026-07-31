"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CapabilityKey } from "@erp/platform-core";
import { Shell } from "@/components/Shell";
import { api, getAccessToken } from "@/lib/api";

type Detail = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  users: number;
  licenses: { moduleId: string; plan: string; isActive: boolean }[];
  loginUrl: string;
  lastLogin: string | null;
  storage: string | null;
  apiUsage: string | null;
};

type CapsResp = {
  licenseAllowsProcessStudio: boolean;
  capabilities: { key: string; enabled: boolean; canEnable: boolean }[];
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Detail | null>(null);
  const [caps, setCaps] = useState<CapsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", plan: "starter" });

  async function loadCaps() {
    const r = await api<{ data: CapsResp }>(`/api/platform/tenants/${id}/capabilities`);
    setCaps(r.data);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api<{ data: Detail }>(`/api/platform/tenants/${id}`)
      .then((r) => {
        setRow(r.data);
        setForm({ name: r.data.name, plan: r.data.plan || "starter" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    loadCaps().catch((e) => setError(e instanceof Error ? e.message : "Capabilities load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function toggleActive() {
    if (!row) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await api<{ data: Detail }>(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      setRow({ ...row, ...r.data });
      setOk(r.data.isActive ? "Tenant enabled" : "Tenant disabled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    const name = form.name.trim();
    if (name.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await api<{ data: Detail }>(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, plan: form.plan }),
      });
      const next = { ...row, ...r.data };
      setRow(next);
      setForm({ name: next.name, plan: next.plan || "starter" });
      setOk("Tenant updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProcessStudio() {
    if (!caps) return;
    const current = caps.capabilities.find((c) => c.key === CapabilityKey.ProcessStudio);
    const nextEnabled = !current?.enabled;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api(`/api/platform/tenants/${id}/capabilities`, {
        method: "PUT",
        body: JSON.stringify({ key: CapabilityKey.ProcessStudio, enabled: nextEnabled }),
      });
      await loadCaps();
      setOk(
        nextEnabled
          ? "Tenant Process Studio enabled (users must re-login)"
          : "Tenant Process Studio disabled"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capability update failed");
    } finally {
      setBusy(false);
    }
  }

  const processCap = caps?.capabilities.find((c) => c.key === CapabilityKey.ProcessStudio);

  return (
    <Shell>
      <div className="space-y-4 max-w-3xl">
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        {ok && <p className="text-sm text-[var(--ok)]">{ok}</p>}
        {!row ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{row.name}</h2>
                <p className="font-mono text-sm text-[var(--muted)]">{row.slug}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleActive()}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {row.isActive ? "Disable tenant" : "Enable tenant"}
              </button>
            </div>

            <form
              onSubmit={(e) => void onSave(e)}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold">Edit tenant</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm space-y-1">
                  <span className="text-[var(--muted)]">Name</span>
                  <input
                    required
                    minLength={2}
                    className="w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm space-y-1">
                  <span className="text-[var(--muted)]">Plan</span>
                  <select
                    className="w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
                    value={form.plan}
                    onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                  >
                    <option value="starter">starter</option>
                    <option value="growth">growth</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                </label>
                <label className="block text-sm space-y-1 sm:col-span-2">
                  <span className="text-[var(--muted)]">Slug (read-only)</span>
                  <input
                    readOnly
                    className="w-full rounded-lg border border-[var(--line)] bg-black/10 px-3 py-2 font-mono text-[var(--muted)]"
                    value={row.slug}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
              <h3 className="text-sm font-semibold">Capabilities</h3>
              <p className="text-xs text-[var(--muted)]">
                Operational enablement (requires matching ModuleLicense). Distinct from branding
                settings.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">Process Studio</p>
                  <p className="text-xs text-[var(--muted)]">
                    License allows: {caps?.licenseAllowsProcessStudio ? "yes" : "no"} · Capability:{" "}
                    {processCap?.enabled ? "on" : "off"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || (!processCap?.enabled && !processCap?.canEnable)}
                  onClick={() => void toggleProcessStudio()}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
                >
                  {processCap?.enabled ? "Disable for tenant" : "Allow tenant Process Studio"}
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div>
                <dt className="text-[var(--muted)]">Status</dt>
                <dd>{row.isActive ? "Active" : "Disabled"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Created</dt>
                <dd>{new Date(row.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Users</dt>
                <dd>{row.users}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Modules</dt>
                <dd>{row.licenses?.map((l) => l.moduleId).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Last Login</dt>
                <dd>{row.lastLogin ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Storage</dt>
                <dd>{row.storage ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">API Usage</dt>
                <dd>{row.apiUsage ?? "—"}</dd>
              </div>
            </dl>
            <p className="text-sm">
              Tenant admin login:{" "}
              <a
                className="text-[var(--accent)] underline"
                href={row.loginUrl}
                target="_blank"
                rel="noreferrer"
              >
                {row.loginUrl}
              </a>
            </p>
          </>
        )}
      </div>
    </Shell>
  );
}
