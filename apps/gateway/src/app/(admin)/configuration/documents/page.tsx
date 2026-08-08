"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import { PageHeader, StatusBadge } from "@erp/ui";
import type { DocumentDefinition } from "@erp/documents";

type DocRow = {
  id: string;
  documentId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  documentType: string;
  definition: DocumentDefinition;
  publishedAt: string | null;
  updatedAt: string;
};

export default function DocumentsCatalogPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ data: DocRow[] }>("/api/workflow-documents");
      setRows(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = useMemo(() => {
    const map = new Map<string, DocRow>();
    for (const row of rows) {
      const cur = map.get(row.documentId);
      if (!cur || row.version > cur.version) map.set(row.documentId, row);
    }
    return [...map.values()];
  }, [rows]);

  async function seed() {
    setBusy("seed");
    try {
      await api("/api/workflow-documents", {
        method: "POST",
        body: JSON.stringify({ action: "seed" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(null);
    }
  }

  async function createDraft() {
    setBusy("create");
    try {
      const r = await api<{ data: DocRow }>("/api/workflow-documents", {
        method: "POST",
        body: JSON.stringify({
          documentId: `doc-${Date.now().toString(36)}`,
          name: "New document",
          documentType: "INVOICE",
        }),
      });
      if (r.data?.id) router.push(`/configuration/documents/${r.data.id}`);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  async function cloneToDraft(row: DocRow) {
    setBusy(`clone-${row.id}`);
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "clone-to-draft" }),
      });
      if (r.data?.id) router.push(`/configuration/documents/${r.data.id}`);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone to draft failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader title="Documents" />
          <p className="-mt-4 text-sm text-[var(--ink-soft)]">
            Print templates. Published versions are immutable — Clone to draft to edit. New draft
            creates a blank template.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-xs font-semibold"
            disabled={busy != null}
            onClick={() => void seed()}
          >
            {busy === "seed" ? "Seeding…" : "Seed Tax Invoice"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white"
            disabled={busy != null}
            onClick={() => void createDraft()}
          >
            New draft
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-stone-50 text-xs uppercase text-[var(--ink-soft)]">
              <tr>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Lifecycle</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {latest.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.name ?? row.documentId}</div>
                    <div className="text-xs text-[var(--ink-soft)]">{row.documentId}</div>
                  </td>
                  <td className="px-3 py-2">{row.documentType}</td>
                  <td className="px-3 py-2">v{row.version}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.lifecycle} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-3">
                      <Link
                        href={`/configuration/documents/${row.id}`}
                        className="text-xs font-semibold text-emerald-800 underline"
                      >
                        {row.lifecycle === "DRAFT" ? "Edit" : "Open / Preview"}
                      </Link>
                      {row.lifecycle !== "DRAFT" && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-800 underline disabled:opacity-50"
                          disabled={busy != null}
                          onClick={() => void cloneToDraft(row)}
                        >
                          {busy === `clone-${row.id}` ? "Cloning…" : "Clone to draft"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {latest.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-[var(--ink-soft)]">
                    No documents yet — seed the Tax Invoice starter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
