"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import { Button, PageScaffold, StatusBadge } from "@erp/ui";
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
  const [upgradePreview, setUpgradePreview] = useState<{
    eligible: number;
    alreadyCurrent: number;
    customized: number;
    missing: number;
    rows: { formId: string; status: string }[];
  } | null>(null);

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

  async function createForm(idOverride?: string) {
    const formId = (idOverride ?? newId).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
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
            layout: [
              { widget: "FormFields", props: {} },
              { widget: "ActionButtons", props: {} },
            ],
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

  async function restoreStarters() {
    setBusy("seed");
    setError(null);
    try {
      await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "seed" }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  async function previewUpgrade() {
    setBusy("upgrade-preview");
    setError(null);
    setUpgradePreview(null);
    try {
      const r = await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "upgrade-starters", dryRun: true }),
      });
      const meta = (r.meta ?? r) as {
        summary?: {
          eligible: number;
          alreadyCurrent: number;
          customized: number;
          missing: number;
        };
        dryRun?: boolean;
        latestRevision?: number;
      };
      const summary = meta.summary ?? {
        eligible: 0,
        alreadyCurrent: 0,
        customized: 0,
        missing: 0,
      };
      setUpgradePreview({
        ...summary,
        rows: (r.data ?? []) as { formId: string; status: string }[],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upgrade preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmUpgrade() {
    setBusy("upgrade");
    setError(null);
    try {
      await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "upgrade-starters", dryRun: false }),
      });
      setUpgradePreview(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageScaffold
      className="space-y-6"
      hero={{
        title: "Form catalog",
        description:
          "Independently versioned FORM assets. Workflows reference them with assetRef. Published versions are immutable — clone to draft to edit. Catalog starts empty — build your own, or restore starter forms if you want a reference.",
      }}
    >
      <div className="mb-4 text-xs text-[var(--ink-soft)]">
        <Link href="/configuration" className="hover:underline">
          Configuration
        </Link>
        <span className="mx-1">/</span>
        Forms
      </div>
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--line)] bg-white p-4">
        <label className="block text-xs text-[var(--ink-soft)]">
          New form id
          <input
            className="mt-0.5 block w-56 rounded border border-[var(--line)] px-2 py-1.5 text-sm"
            placeholder="my-custom-form"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={busy === "create"}
          onClick={() => void createForm()}
        >
          Create draft
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy === "seed"}
          onClick={() => void restoreStarters()}
          title="Loads published SO_STANDARD starter forms only if missing for each form id"
        >
          Restore starter forms
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy === "upgrade-preview" || busy === "upgrade"}
          onClick={() => void previewUpgrade()}
          title="Dry-run: show which unmodified starters can upgrade to revision 2"
        >
          Upgrade unmodified starters…
        </Button>
      </div>

      {upgradePreview && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)]/60 px-4 py-3 space-y-3 text-sm">
          <p className="font-medium text-[var(--ink)]">Upgrade unmodified starters</p>
          <p className="text-[var(--ink-soft)]">
            {upgradePreview.eligible} eligible · {upgradePreview.alreadyCurrent} already current ·{" "}
            {upgradePreview.customized} customized — unchanged
            {upgradePreview.missing > 0 ? ` · ${upgradePreview.missing} missing` : ""}
          </p>
          <ul className="max-h-40 overflow-y-auto text-xs text-[var(--ink-soft)] space-y-0.5">
            {upgradePreview.rows.map((row) => (
              <li key={row.formId}>
                <span className="font-mono text-[var(--ink)]">{row.formId}</span> — {row.status}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy === "upgrade" || upgradePreview.eligible === 0}
              onClick={() => void confirmUpgrade()}
            >
              Confirm upgrade ({upgradePreview.eligible})
            </Button>
            <Button type="button" variant="secondary" onClick={() => setUpgradePreview(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-[var(--ink-soft)]">
            In-flight orders keep pinned form versions. Customized forms are never overwritten.
          </p>
        </div>
      )}

      {!loading && latestByForm.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--mist)]/80 px-6 py-10 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--ink)]">No forms yet — blank slate</p>
          <p className="text-sm text-[var(--ink-soft)] max-w-lg mx-auto">
            Create a draft, add widgets in the designer, and use the live task simulation on the right to see how
            the OMS task screen will look. When you are ready, I can review your form layout and fields.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button
              type="button"
              disabled={busy === "create"}
              onClick={() => void createForm(newId.trim() || "my-first-task")}
            >
              Start with a blank form
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy === "seed"}
              onClick={() => void restoreStarters()}
            >
              Restore starter forms
            </Button>
          </div>
        </div>
      )}

      {(loading || latestByForm.length > 0) && (
      <div className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--mist)] text-left text-xs uppercase tracking-wide text-[var(--ink-soft)]">
            <tr>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Latest</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)]">
                  Loading…
                </td>
              </tr>
            ) : (
              latestByForm.map((row) => (
                <tr key={row.formId} className="hover:bg-[var(--mist)]/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">{row.name ?? row.formId}</div>
                    <div className="text-xs text-[var(--ink-soft)]">{row.formId}</div>
                  </td>
                  <td className="px-4 py-3">v{row.version}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.lifecycle} />
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/configuration/forms/${row.id}`}
                      className="text-[var(--brand)] hover:underline"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void clone(row.id)}
                      className="text-[var(--ink-soft)] hover:underline disabled:opacity-50"
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
      )}
    </PageScaffold>
  );
}
