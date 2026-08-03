"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getTenantId } from "@/lib/admin-api";
import { PageHeader, Button, Input } from "@erp/ui";

type Section =
  | "general"
  | "branding"
  | "modules"
  | "users"
  | "branches"
  | "security"
  | "portal"
  | "integrations";

const SECTIONS: { id: Section; label: string; description: string }[] = [
  { id: "general", label: "General", description: "Name, plan, currency, timezone" },
  { id: "branding", label: "Branding", description: "Display name and accent" },
  { id: "modules", label: "Modules", description: "Licensed modules (read-only)" },
  { id: "users", label: "Users", description: "Team members and roles" },
  { id: "branches", label: "Branches", description: "Locations and defaults" },
  { id: "security", label: "Security", description: "Organisation security settings" },
  { id: "portal", label: "Portal", description: "Customer portal slug and name" },
  { id: "integrations", label: "Integrations", description: "External connectors" },
];

type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  role: string;
  modules: string[];
  settings: Record<string, string>;
};

type ModuleInfo = { id: string; name: string; description: string; dependencies: string[] };
type Branch = {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  isDefault: boolean;
};

export default function AdministrationPage() {
  const tenantId = typeof window !== "undefined" ? getTenantId() : "";
  const [section, setSection] = useState<Section>("general");
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [plan, setPlan] = useState("starter");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [brandName, setBrandName] = useState("");
  const [brandAccent, setBrandAccent] = useState("#c8922a");
  const [portalSlug, setPortalSlug] = useState("");
  const [portalName, setPortalName] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState("24");
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCity, setBranchCity] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) {
      setError("No tenant in session — log in again");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [t, mods, br] = await Promise.all([
        api(`/api/tenants/${tenantId}`),
        api("/api/modules"),
        api("/api/branches"),
      ]);
      const data = t.data as TenantDetail;
      setTenant(data);
      setName(data.name ?? "");
      setPlan(data.plan ?? "starter");
      setCurrency(data.settings?.currency ?? "INR");
      setTimezone(data.settings?.timezone ?? "Asia/Kolkata");
      setBrandName(data.settings?.["brand.displayName"] ?? data.name ?? "");
      setBrandAccent(data.settings?.["brand.accent"] ?? "#c8922a");
      setPortalSlug(data.settings?.["portal.slug"] ?? data.slug ?? "");
      setPortalName(data.settings?.["portal.name"] ?? data.name ?? "");
      setSessionTimeout(data.settings?.["security.sessionHours"] ?? "24");
      setCatalog(mods.modules ?? []);
      setBranches(br.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveGeneral() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, plan }),
      });
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ currency, timezone }),
      });
      setMessage("General settings saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          "brand.displayName": brandName,
          "brand.accent": brandAccent,
        }),
      });
      setMessage("Branding saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePortal() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          "portal.slug": portalSlug.trim().toLowerCase(),
          "portal.name": portalName,
        }),
      });
      setMessage("Portal settings saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSecurity() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          "security.sessionHours": sessionTimeout,
        }),
      });
      setMessage("Security settings saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function licenseModule(moduleId: string) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/modules", {
        method: "POST",
        body: JSON.stringify({ tenantId, moduleId, plan: "basic" }),
      });
      setMessage(`Module ${moduleId} activated`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "License failed");
    } finally {
      setBusy(false);
    }
  }

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/branches", {
        method: "POST",
        body: JSON.stringify({
          code: branchCode.trim().toUpperCase(),
          name: branchName.trim(),
          city: branchCity.trim() || undefined,
          isDefault: branches.length === 0,
        }),
      });
      setBranchCode("");
      setBranchName("");
      setBranchCity("");
      setMessage("Branch created");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create branch failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-[var(--ink-soft)]">Loading tenant administration…</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <PageHeader title="Administration" />
        <p className="-mt-4 mb-2 text-sm text-[var(--ink-soft)]">
          Tenant configuration — organisation identity, portal, and branches. Module licenses and
          Process Studio are managed by Platform Admin.
          workflows live under Process Studio.
        </p>
        {tenant && (
          <p className="text-xs text-[var(--ink-soft)]">
            {tenant.name} · <span className="font-mono">{tenant.slug}</span> · your role {tenant.role}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSection(s.id);
                setMessage(null);
                setError(null);
              }}
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                section === s.id
                  ? "bg-[var(--ink)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--line)]"
              }`}
            >
              <div className="font-medium">{s.label}</div>
              <div className={`text-[11px] ${section === s.id ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                {s.description}
              </div>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          {section === "general" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">General</h2>
              <Input label="Organisation name" value={name} onChange={(e) => setName(e.target.value)} />
              <label className="block text-xs text-[var(--ink-soft)]">
                Plan
                <select
                  className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                >
                  <option value="starter">starter</option>
                  <option value="growth">growth</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>
              <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              <Input label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              <p className="text-xs text-[var(--ink-soft)]">
                Slug <span className="font-mono text-[var(--ink-soft)]">{tenant?.slug}</span> is fixed after
                create (used for membership lookup).
              </p>
              <Button disabled={busy} onClick={() => void saveGeneral()}>
                {busy ? "Saving…" : "Save general"}
              </Button>
            </div>
          )}

          {section === "branding" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Branding</h2>
              <Input
                label="Display name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <Input
                label="Accent colour"
                value={brandAccent}
                onChange={(e) => setBrandAccent(e.target.value)}
              />
              <div
                className="h-10 rounded-xl border border-[var(--line)]"
                style={{ background: brandAccent }}
              />
              <Button disabled={busy} onClick={() => void saveBranding()}>
                {busy ? "Saving…" : "Save branding"}
              </Button>
            </div>
          )}

          {section === "modules" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Modules</h2>
              <p className="text-xs text-[var(--ink-soft)]">
                Licensed modules are managed by Platform Admin. Contact your operator to change
                entitlements or enable Process Studio.
              </p>
              <p className="text-xs text-[var(--ink-soft)]">
                Active: {(tenant?.modules ?? []).join(", ") || "none"}
              </p>
              <ul className="space-y-2">
                {catalog.map((m) => {
                  const on = tenant?.modules?.includes(m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-[var(--ink)]">{m.name}</div>
                        <div className="text-xs text-[var(--ink-soft)]">{m.description}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          on ? "bg-emerald-50 text-emerald-700" : "bg-[var(--mist)] text-[var(--ink-soft)]"
                        }`}
                      >
                        {on ? "Active" : "Off"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {section === "users" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Users</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                Invite staff and assign permission sets (including Process Owner and Catalog Manager)
                on the Users page.
              </p>
              <Link
                href="/users"
                className="inline-flex rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
              >
                Open Users →
              </Link>
            </div>
          )}

          {section === "branches" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Branches</h2>
              <ul className="space-y-2">
                {branches.map((b) => (
                  <li key={b.id} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--ink)]">
                      {b.code} — {b.name}
                    </span>
                    {b.city ? <span className="text-[var(--ink-soft)]"> · {b.city}</span> : null}
                    {b.isDefault && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
                        Default
                      </span>
                    )}
                  </li>
                ))}
                {branches.length === 0 && (
                  <li className="text-xs text-[var(--ink-soft)]">No branches yet.</li>
                )}
              </ul>
              <form onSubmit={(e) => void createBranch(e)} className="space-y-2 border-t border-[var(--line)] pt-4">
                <Input
                  label="Code"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  required
                />
                <Input
                  label="Name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                />
                <Input
                  label="City"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Add branch"}
                </Button>
              </form>
            </div>
          )}

          {section === "security" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Security</h2>
              <Input
                label="Session length (hours)"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
              />
              <p className="text-xs text-[var(--ink-soft)]">
                Stored as tenant setting. Token TTL still follows platform JWT defaults until auth
                reads this key.
              </p>
              <Button disabled={busy} onClick={() => void saveSecurity()}>
                {busy ? "Saving…" : "Save security"}
              </Button>
            </div>
          )}

          {section === "portal" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Customer portal</h2>
              <Input
                label="Portal slug"
                value={portalSlug}
                onChange={(e) => setPortalSlug(e.target.value)}
              />
              <Input
                label="Portal display name"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
              />
              <p className="text-xs text-[var(--ink-soft)]">
                Customers join with this slug (`?tenant=` / subdomain / env). Align{" "}
                <span className="font-mono">NEXT_PUBLIC_TENANT_SLUG</span> in the customer app for
                local deploy.
              </p>
              <Button disabled={busy} onClick={() => void savePortal()}>
                {busy ? "Saving…" : "Save portal"}
              </Button>
            </div>
          )}

          {section === "integrations" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Integrations</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                External connectors are not configured yet. This section is reserved under Tenant
                Configuration per the Tenant Operating Model.
              </p>
              <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--mist)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
                Coming soon
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
