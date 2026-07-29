"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import { PageHeader, StatusBadge } from "@erp/ui";

type TemplateRow = {
  id: string;
  templateCode: string;
  version: number;
  lifecycle: string;
  name: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/api/workflow-templates");
      setRows(r.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function clone(sourceId: string) {
    setBusy(sourceId);
    try {
      const r = await api("/api/workflow-templates", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId }),
      });
      await load();
      if (r.data?.id) router.push(`/workflows/${r.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Workflow templates" />
        <p className="-mt-4 mb-6 text-sm text-slate-500">
          Published templates are read-only. Use <strong>Clone draft</strong> to edit, add, or delete tasks — then
          Publish. Each template belongs to your current login tenant.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No templates yet
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{row.name ?? row.templateCode}</div>
                  <div className="text-xs text-slate-400">{row.templateCode}</div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">v{row.version}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.lifecycle} />
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(row.updatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Link
                    href={`/workflows/${row.id}`}
                    className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {row.lifecycle === "DRAFT" ? "Edit" : "Open"}
                  </Link>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void clone(row.id)}
                    className="inline-flex rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy === row.id ? "…" : "Clone draft"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Canvas → JSON → Validator → Publish. The engine never reads the diagram — only published definition JSON.
      </p>
    </div>
  );
}
