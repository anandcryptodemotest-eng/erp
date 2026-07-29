"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import type { FormDefinition, FormFieldDefinition, FormFieldType } from "@erp/workflow";
import { ensurePlatformExtensionsBootstrapped, listWidgetManifests } from "@/lib/ui-runtime/TaskScreenRuntime";

type FormRow = {
  id: string;
  formId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  definition: FormDefinition;
};

type Dep = {
  consumerType: string;
  consumerId: string;
  consumerVersion: number;
  assetVersion: number;
};

const FIELD_TYPES: FormFieldType[] = ["text", "number", "readonly", "textarea", "select"];

export default function FormDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<FormRow | null>(null);
  const [def, setDef] = useState<FormDefinition | null>(null);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api(`/api/workflow-forms/${id}`);
      setRow(r.data);
      setDef(r.data.definition);
      setDeps(r.meta?.referencedBy ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load form");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    ensurePlatformExtensionsBootstrapped();
  }, []);

  const widgetManifests = typeof window !== "undefined" ? listWidgetManifests() : [];

  async function save() {
    if (!def || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/workflow-forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: def.title, definition: def }),
      });
      setMessage("Draft saved");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (readOnly) return;
    setBusy(true);
    setError(null);
    try {
      await save();
      await api(`/api/workflow-forms/${id}/publish`, { method: "POST", body: "{}" });
      setMessage("Published — workflows can reference this version");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function cloneDraft() {
    setBusy(true);
    try {
      const r = await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId: id }),
      });
      if (r.data?.id) router.push(`/configuration/forms/${r.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(false);
    }
  }

  function updateField(index: number, patch: Partial<FormFieldDefinition>) {
    if (!def) return;
    const fields = [...(def.fields ?? [])];
    fields[index] = { ...fields[index], ...patch };
    setDef({ ...def, fields });
  }

  function addField() {
    if (!def) return;
    const fields = [
      ...(def.fields ?? []),
      {
        key: `field_${(def.fields?.length ?? 0) + 1}`,
        label: "New field",
        type: "text" as FormFieldType,
        scope: "order" as const,
        required: false,
      },
    ];
    setDef({ ...def, fields });
  }

  function removeField(index: number) {
    if (!def) return;
    setDef({ ...def, fields: (def.fields ?? []).filter((_, i) => i !== index) });
  }

  if (!row || !def) {
    return (
      <div className="p-6 text-sm text-slate-500">{error ?? "Loading form…"}</div>
    );
  }

  const readOnly = row.lifecycle !== "DRAFT";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-slate-500">
            <Link href="/configuration" className="hover:underline">
              Configuration
            </Link>
            <span className="mx-1">/</span>
            <Link href="/configuration/forms" className="hover:underline">
              Forms
            </Link>
            <span className="mx-1">/</span>
            {row.formId}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {def.title ?? row.formId}{" "}
            <span className="text-sm font-normal text-slate-400">
              v{row.version} · {row.lifecycle}
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            AssetRef:{" "}
            <code className="rounded bg-slate-100 px-1">
              FORM:{row.formId}@{row.version}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readOnly ? (
            <button
              type="button"
              onClick={() => void cloneDraft()}
              disabled={busy}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Clone to draft
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {deps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Referenced by</p>
          <ul className="mt-1 space-y-0.5 text-amber-950">
            {deps.map((d, i) => (
              <li key={i}>
                {d.consumerType} {d.consumerId} v{d.consumerVersion} → form v{d.assetVersion}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Properties</h2>
          {readOnly && (
            <p className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
              View only — clone to draft to edit.
            </p>
          )}
          <label className="block text-xs text-slate-500">
            Title
            <input
              disabled={readOnly}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
              value={def.title ?? ""}
              onChange={(e) => setDef({ ...def, title: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Description
            <textarea
              disabled={readOnly}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
              rows={2}
              value={def.description ?? ""}
              onChange={(e) => setDef({ ...def, description: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Confirm label
            <input
              disabled={readOnly}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
              value={def.confirmLabel ?? ""}
              onChange={(e) => setDef({ ...def, confirmLabel: e.target.value || undefined })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Theme
            <select
              disabled={readOnly}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
              value={def.themeId ?? (def.theme === "amber" ? "oms-attention" : "oms-default")}
              onChange={(e) =>
                setDef({
                  ...def,
                  themeId: e.target.value,
                  theme: e.target.value === "oms-attention" ? "amber" : "emerald",
                })
              }
            >
              <option value="oms-default">OMS Default</option>
              <option value="oms-attention">OMS Attention</option>
            </select>
          </label>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Layout (widgets)
              </h3>
              {!readOnly && widgetManifests.length > 0 && (
                <select
                  className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    e.target.value = "";
                    if (!id || !def) return;
                    const m = widgetManifests.find((w) => w.id === id);
                    setDef({
                      ...def,
                      layout: [
                        ...(def.layout ?? []),
                        { widget: id, props: { ...(m?.defaultProps ?? {}) } },
                      ],
                    });
                  }}
                >
                  <option value="">+ Add widget</option>
                  {widgetManifests
                    .filter((m) => ["FormFields", "ProductList", "CatalogSearch", "ActionButtons"].includes(m.id) || m.category !== "legacy")
                    .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.category})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {(def.layout ?? []).length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No layout yet — add widgets (FormFields, ProductList, CatalogSearch, ActionButtons).
              </p>
            ) : (
              <ul className="space-y-1">
                {(def.layout ?? []).map((w, i) => (
                  <li
                    key={`${w.widget}-${i}`}
                    className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium text-slate-800">{w.widget}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() =>
                          setDef({
                            ...def,
                            layout: (def.layout ?? []).filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="block text-xs text-slate-500">
            Default layout preset
            <select
              disabled={readOnly}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
              value="layout"
              onChange={(e) => {
                if (e.target.value === "fields") {
                  setDef({
                    ...def,
                    renderer: "generic",
                    component: undefined,
                    layout: [
                      { widget: "FormFields", props: {} },
                      { widget: "ActionButtons", props: {} },
                    ],
                  });
                } else if (e.target.value === "review") {
                  setDef({
                    ...def,
                    renderer: "generic",
                    component: undefined,
                    layout: [
                      { widget: "ProductList", props: { editable: true } },
                      { widget: "CatalogSearch", props: {} },
                      { widget: "FormFields", props: {} },
                      { widget: "ActionButtons", props: {} },
                    ],
                  });
                }
                e.target.value = "layout";
              }}
            >
              <option value="layout">Apply preset…</option>
              <option value="fields">FormFields + ActionButtons</option>
              <option value="review">ProductList + CatalogSearch + FormFields</option>
            </select>
          </label>
          <div className="flex gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={Boolean(def.showTotal)}
                onChange={(e) => setDef({ ...def, showTotal: e.target.checked })}
              />
              Show total
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live preview
            </h2>
            <span className="text-[10px] text-slate-400">Desktop</span>
          </div>
          <div
            className={`rounded-xl border-2 p-4 space-y-3 ${
              def.theme === "amber" ? "border-amber-500 bg-amber-50" : "border-emerald-600 bg-white"
            }`}
          >
            <div>
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  def.theme === "amber" ? "text-amber-800" : "text-emerald-700"
                }`}
              >
                Step preview
              </p>
              <h3 className="text-base font-semibold text-slate-900">{def.title ?? row.formId}</h3>
              {def.description && <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>}
            </div>
            {(def.layout ?? []).length > 0 ? (
              <ul className="space-y-1 text-xs text-slate-600">
                {(def.layout ?? []).map((w, i) => (
                  <li key={`${w.widget}-${i}`}>{w.widget}</li>
                ))}
              </ul>
            ) : (
              <>
                {(def.fields ?? [])
                  .filter((f) => f.scope === "order")
                  .map((f) => (
                    <div key={f.key} className="text-sm">
                      <label className="block text-xs text-slate-500">{f.label}</label>
                      <input
                        disabled
                        className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                        placeholder={f.type}
                      />
                    </div>
                  ))}
                {(def.fields ?? []).some((f) => f.scope === "per-item") && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm space-y-2">
                    <p className="font-medium text-slate-800">Sample line item</p>
                    {(def.fields ?? [])
                      .filter((f) => f.scope === "per-item")
                      .map((f) => (
                        <div key={f.key} className="text-xs text-slate-500">
                          {f.label} ({f.type})
                        </div>
                      ))}
                  </div>
                )}
                {def.showTotal && (
                  <p className="text-xs text-slate-400">Order total will show at runtime</p>
                )}
              </>
            )}
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white opacity-80"
            >
              {def.confirmLabel ?? "Complete this step →"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fields</h2>
            {!readOnly && (
              <button
                type="button"
                onClick={addField}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                + Add field
              </button>
            )}
          </div>
          {(def.fields ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No fields — confirm-only step, or switch to custom renderer.</p>
          ) : (
            <div className="space-y-2">
              {(def.fields ?? []).map((f, i) => (
                <div
                  key={`${f.key}-${i}`}
                  className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-6"
                >
                  <input
                    disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-xs sm:col-span-1"
                    value={f.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                    placeholder="key"
                  />
                  <input
                    disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-xs sm:col-span-1"
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="label"
                  />
                  <select
                    disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                    value={f.type}
                    onChange={(e) => updateField(i, { type: e.target.value as FormFieldType })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                    value={f.scope ?? "order"}
                    onChange={(e) =>
                      updateField(i, { scope: e.target.value as "order" | "per-item" })
                    }
                  >
                    <option value="order">order</option>
                    <option value="per-item">per-item</option>
                  </select>
                  <input
                    disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                    value={f.binding ?? f.source ?? ""}
                    onChange={(e) =>
                      updateField(i, { binding: e.target.value || undefined, source: e.target.value || undefined })
                    }
                    placeholder="binding"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={Boolean(f.required)}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                      req
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
