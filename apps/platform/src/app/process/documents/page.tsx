"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import {
  api,
  getAccessToken,
  getProcessTenant,
  setProcessTenant,
  type ProcessTenantRef,
} from "@/lib/api";

type TenantRow = { id: string; name: string; slug: string; isActive: boolean };
type DocRow = {
  id: string;
  tenantId: string;
  documentId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  documentType: string;
};

export default function PlatformDocumentsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<ProcessTenantRef | null>(null);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [targetTenantId, setTargetTenantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setSelected(getProcessTenant());
    api<{ data: TenantRow[] }>("/api/platform/tenants")
      .then((r) => setTenants((r.data ?? []).filter((t) => t.isActive)))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [router]);

  const loadDocs = useCallback(async (tenantId: string) => {
    setError(null);
    setLoadingDocs(true);
    try {
      const r = await api<{ data: DocRow[] }>("/api/workflow-documents", {
        headers: { "x-tenant-id": tenantId },
      });
      setRows(r.data ?? []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.id) void loadDocs(selected.id);
    else setRows([]);
  }, [selected, loadDocs]);

  function onPick(id: string) {
    const t = tenants.find((x) => x.id === id);
    if (!t) return;
    const ref = { id: t.id, name: t.name, slug: t.slug };
    setProcessTenant(ref);
    setSelected(ref);
    setTargetTenantId((cur) => (cur === id ? "" : cur));
  }

  async function seed() {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/workflow-documents", {
        method: "POST",
        headers: { "x-tenant-id": selected.id },
        body: JSON.stringify({ action: "seed" }),
      });
      await loadDocs(selected.id);
      setMsg("Seeded tax-invoice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(doc: DocRow) {
    if (!selected || !targetTenantId) {
      setError("Pick a target tenant in “Assign clone target” first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await api("/api/workflow-documents", {
        method: "POST",
        headers: { "x-tenant-id": selected.id },
        body: JSON.stringify({
          action: "assign",
          sourceTenantId: selected.id,
          targetTenantId,
          documentId: doc.documentId,
          sourceVersion: doc.version,
          publish: false,
        }),
      });
      const targetName = tenants.find((t) => t.id === targetTenantId)?.name ?? targetTenantId;
      setMsg(`Assigned ${doc.documentId} v${doc.version} → ${targetName} as Draft`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function cloneToDraft(doc: DocRow) {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${doc.id}`, {
        method: "PATCH",
        headers: { "x-tenant-id": selected.id },
        body: JSON.stringify({ action: "clone-to-draft" }),
      });
      setMsg(`Created ${doc.documentId} v${r.data.version} as Draft`);
      await loadDocs(selected.id);
      if (r.data?.id) router.push(`/process/documents/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone to draft failed");
    } finally {
      setBusy(false);
    }
  }

  const canAssign = Boolean(selected && targetTenantId && !busy);

  return (
    <Shell>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/process" className="text-xs text-emerald-800 underline">
              ← Process Studio
            </Link>
            <h1 className="text-xl font-semibold">Documents (platform)</h1>
            <p className="text-sm text-stone-600">
              Clone to draft revises in this tenant. Assign copies to another tenant (separate
              flow).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={selected?.id ?? ""}
              onChange={(e) => onPick(e.target.value)}
            >
              <option value="">Select source tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              disabled={!selected || busy}
              onClick={() => void seed()}
            >
              Seed Tax Invoice
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-emerald-800">{msg}</p>}
        <div className="flex flex-wrap items-center gap-2 rounded border bg-stone-50 p-3 text-sm">
          <span className="font-medium">Assign clone target</span>
          <select
            className="rounded border px-2 py-1"
            value={targetTenantId}
            onChange={(e) => setTargetTenantId(e.target.value)}
          >
            <option value="">Choose target tenant…</option>
            {tenants
              .filter((t) => t.id !== selected?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          {!targetTenantId ? (
            <span className="text-xs text-amber-700">
              Assign stays disabled until you pick a target. Use Clone to draft to edit here.
            </span>
          ) : (
            <span className="text-xs text-emerald-700">Target selected — Assign is enabled.</span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Ver</th>
                <th className="px-3 py-2">Lifecycle</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingDocs && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                    Loading templates…
                  </td>
                </tr>
              )}
              {!loadingDocs &&
                rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.name ?? row.documentId}</div>
                      <div className="text-xs text-stone-500">{row.documentId}</div>
                    </td>
                    <td className="px-3 py-2">{row.documentType}</td>
                    <td className="px-3 py-2">v{row.version}</td>
                    <td className="px-3 py-2">{row.lifecycle}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                        <Link
                          href={`/process/documents/${row.id}`}
                          className="text-xs font-semibold text-emerald-800 underline"
                        >
                          {row.lifecycle === "DRAFT" ? "Edit" : "Open / Preview"}
                        </Link>
                        {row.lifecycle !== "DRAFT" && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-800 underline disabled:opacity-50"
                            disabled={busy || !selected}
                            title="Create a new DRAFT version in this tenant"
                            onClick={() => void cloneToDraft(row)}
                          >
                            Clone to draft
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs font-semibold text-stone-700 underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
                          disabled={!canAssign}
                          title={
                            !targetTenantId
                              ? "Select Assign clone target first"
                              : busy
                                ? "Busy…"
                                : "Copy this template into another tenant"
                          }
                          onClick={() => void assign(row)}
                        >
                          Assign → clone
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loadingDocs && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                    {selected
                      ? "No documents — click Seed Tax Invoice."
                      : "Select a source tenant to list templates."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
