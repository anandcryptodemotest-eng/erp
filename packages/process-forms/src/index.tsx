"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import "./form-designer.css";

export { FormDesigner } from "./FormDesigner";
export type { FormDesignerApi, FormDesignerProps, FormDep } from "./FormDesigner";

export type ProcessApi = (
  path: string,
  options?: RequestInit
) => Promise<{ data?: unknown; [k: string]: unknown }>;

type FormRow = {
  id: string;
  formId: string;
  version: number;
  lifecycle: string;
  name: string | null;
};

type Props = {
  api: ProcessApi;
  detailHref: (id: string) => string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
  /** After create/clone, host can navigate */
  onOpenForm?: (id: string) => void;
  /** Show create draft + restore starters (default true) */
  allowCreate?: boolean;
};

export function WorkflowFormsPanel({
  api,
  detailHref,
  LinkComponent,
  onOpenForm,
  allowCreate = true,
}: Props) {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newId, setNewId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/api/workflow-forms");
      setRows((r.data as FormRow[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createForm(idOverride?: string) {
    const formId = (idOverride ?? newId).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!formId) {
      setError("Enter a form id (e.g. sales-review)");
      return;
    }
    setBusy("create");
    setError(null);
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
      const id = (r.data as { id?: string } | undefined)?.id;
      if (id) onOpenForm?.(id);
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

  return (
    <div className="form-designer" style={{ maxWidth: 880 }}>
      <header className="form-designer__header">
        <div>
          <h1 className="form-designer__title">Forms</h1>
          <p className="form-designer__eyebrow" style={{ marginTop: "0.35rem" }}>
            Catalog of task screens for workflow activities
          </p>
        </div>
      </header>

      {error && <div className="form-designer__banner form-designer__banner--err">{error}</div>}

      {allowCreate && (
        <div className="form-designer__create">
          <label className="form-designer__label">
            New form id
            <input
              placeholder="my-custom-form"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createForm();
              }}
            />
          </label>
          <button
            type="button"
            className="form-designer__btn form-designer__btn--primary"
            disabled={busy === "create"}
            onClick={() => void createForm()}
          >
            Create draft
          </button>
          <button
            type="button"
            className="form-designer__btn form-designer__btn--ghost"
            disabled={busy === "seed"}
            onClick={() => void restoreStarters()}
          >
            Restore starters
          </button>
        </div>
      )}

      {loading ? (
        <p className="form-designer__empty">Loading…</p>
      ) : (
        <section className="form-designer__panel">
          <div className="form-designer__panel-head">
            <h2>Catalog</h2>
            <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
              {rows.length} form{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((row, idx) => (
              <li
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.9rem 1rem",
                  borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    <LinkComponent href={detailHref(row.id)} className="form-designer__linkish">
                      {row.name || row.formId}
                    </LinkComponent>
                  </div>
                  <p className="form-designer__meta" style={{ marginTop: "0.2rem" }}>
                    {row.formId} · v{row.version}
                    <span
                      className={`form-designer__badge form-designer__badge--${
                        row.lifecycle === "DRAFT" ? "draft" : "published"
                      }`}
                      style={{ marginLeft: "0.45rem" }}
                    >
                      {row.lifecycle}
                    </span>
                  </p>
                </div>
                <LinkComponent href={detailHref(row.id)} className="form-designer__btn form-designer__btn--ghost">
                  Open
                </LinkComponent>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="form-designer__empty" style={{ padding: "1.25rem 1rem" }}>
                No forms yet — create a draft above, or restore starter forms.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
