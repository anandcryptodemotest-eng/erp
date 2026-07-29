"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import { PageHeader, StatusBadge } from "@erp/ui";
import type { FormDefinition } from "@erp/workflow";

type FormRow = {
  id: string;
  formId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  definition: FormDefinition;
  publishedAt: string | null;
  updatedAt: string;
};

export default function FormsCatalogPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/api/workflow-forms");
      setRows(r.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestByForm = useMemo(() => {
    const map = new Map<string, FormRow>();
    for (const row of rows) {
      const cur = map.get(row.formId);
      if (!cur || row.version > cur.version) map.set(row.formId, row);
    }
    return [...map.values()].sort((a, b) => a.formId.localeCompare(b.formId));
  }, [rows]);

  async function clone(sourceId: string) {
    setBusy(sourceId);
    try {
      const r = await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId }),
      });
      await load();
      if (r.data?.id) router.push(`/configuration/forms/${r.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(null);
    }
  }

  async function createForm() {
    const formId = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!formId) {
      setError("Enter a form id (e.g. sales-review)");
      return;
    }
    setBusy("create");
    try {
      const r = await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({
          formId,
          name: formId,
          definition: {
            id: formId,
            key: `${formId.replace(/-/g, "_")}_form`,
            title: formId,
            renderer: "generic",
            fields: [],
          },
        }),
      });
      setNewId("");
      await load();
      if (r.data?.id) router.push(`/configuration/forms/${r.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs text-slate-500">
          <Link href="/configuration" className="hover:underline">
            Configuration
          </Link>
          <span className="mx-1">/</span>
          Forms
        </div>
        <PageHeader title="Form catalog" />
        <p className="-mt-4 mb-6 text-sm text-slate-500">
          Independently versioned FORM assets. Workflows reference them with{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">assetRef</code>. Published versions are immutable —
          clone to draft to edit.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-xs text-slate-500">
          New form id
          <input
            className="mt-0.5 block w-56 rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="my-custom-form"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy === "create"}
          onClick={() => void createForm()}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Create draft
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Latest</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : latestByForm.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No forms yet
                </td>
              </tr>
            ) : (
              latestByForm.map((row) => (
                <tr key={row.formId} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.name ?? row.formId}</div>
                    <div className="text-xs text-slate-400">{row.formId}</div>
                  </td>
                  <td className="px-4 py-3">v{row.version}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.lifecycle} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/configuration/forms/${row.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void clone(row.id)}
                      className="text-slate-600 hover:underline disabled:opacity-50"
                    >
                      Clone draft
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
