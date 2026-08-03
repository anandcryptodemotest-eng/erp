"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FormDefinition, FormFieldDefinition, FormFieldType } from "@erp/workflow";
import { validateFormDefinition } from "@erp/workflow";
import {
  Button,
  ConfirmModal,
  FooterActions,
  FooterStat,
  FormField,
  StatusBadge,
  Tabs,
  useAuthoringState,
  useLayoutTier,
  usePublishConfirm,
} from "@erp/ui";
import "./form-designer.css";
import { moveItem } from "./reorder";

export type FormDesignerApi = (
  path: string,
  options?: RequestInit
) => Promise<{ data?: unknown; meta?: { referencedBy?: FormDep[] }; [k: string]: unknown }>;

export type FormDep = {
  consumerType: string;
  consumerId: string;
  consumerVersion: number;
  assetVersion: number;
};

export type WidgetCatalogOption = {
  id: string;
  label: string;
  entry?: {
    name: string;
    category: string;
    description?: string;
    defaultProps?: Record<string, unknown>;
    editableProps?: { key: string; label: string; type: "boolean" | "string" }[];
  };
};

export type FormDesignerProps = {
  formRowId: string;
  api: FormDesignerApi;
  formsHref: string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
  onOpenForm?: (id: string) => void;
  layoutWidgetOptions?: WidgetCatalogOption[];
  previewSlot?: (args: {
    definition: FormDefinition;
    readOnly: boolean;
    onApplyRecommendedLayout?: () => void;
  }) => ReactNode;
};

type FormRow = {
  id: string;
  formId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  definition: FormDefinition;
};

const FIELD_TYPES: FormFieldType[] = [
  "text",
  "number",
  "readonly",
  "textarea",
  "select",
  "date",
  "datetime",
  "checkbox",
  "radio",
  "email",
  "phone",
  "currency",
  "percentage",
  "url",
  "rating",
];

const AUDIENCES = ["ADMIN", "CUSTOMER", "WAREHOUSE", "DRIVER", "VENDOR"] as const;

const DEFAULT_WIDGETS: WidgetCatalogOption[] = [
  { id: "FormFields", label: "Form Fields (Input)", entry: { name: "Form Fields", category: "Input" } },
  { id: "ActionButtons", label: "Action Buttons (Input)", entry: { name: "Action Buttons", category: "Input" } },
  { id: "ProductList", label: "Product List (Business)", entry: { name: "Product List", category: "Business", defaultProps: { editable: true, showPrice: true, allowRemove: true }, editableProps: [{ key: "editable", label: "Edit qty/price", type: "boolean" }, { key: "allowRemove", label: "Allow remove", type: "boolean" }, { key: "showPrice", label: "Show price", type: "boolean" }] } },
  { id: "CatalogSearch", label: "Catalog Search (Business)", entry: { name: "Catalog Search", category: "Business" } },
  { id: "StatusBanner", label: "Status Banner (Workflow)", entry: { name: "Status Banner", category: "Workflow" } },
  { id: "DriverPicker", label: "Driver Picker (Business)", entry: { name: "Driver Picker", category: "Business", editableProps: [{ key: "required", label: "Required", type: "boolean" }] } },
  { id: "InventoryView", label: "Inventory View (Business)", entry: { name: "Inventory View", category: "Business" } },
  { id: "PriceSummary", label: "Price Summary (Business)", entry: { name: "Price Summary", category: "Business" } },
];

type SectionId = "properties" | "layout" | "fields";

export function FormDesigner({
  formRowId,
  api,
  formsHref,
  LinkComponent,
  onOpenForm,
  layoutWidgetOptions,
  previewSlot,
}: FormDesignerProps) {
  const [row, setRow] = useState<FormRow | null>(null);
  const [def, setDef] = useState<FormDefinition | null>(null);
  const [initialDef, setInitialDef] = useState<FormDefinition | null>(null);
  const [deps, setDeps] = useState<FormDep[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<SectionId>("properties");
  const [expandedField, setExpandedField] = useState<number | null>(0);
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const [removeFieldIdx, setRemoveFieldIdx] = useState<number | null>(null);
  const publishConfirm = usePublishConfirm();
  const tier = useLayoutTier();

  const widgets = layoutWidgetOptions?.length ? layoutWidgetOptions : DEFAULT_WIDGETS;
  const widgetById = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);

  const validate = useCallback((value: FormDefinition) => {
    const r = validateFormDefinition(value, "publish");
    const save = validateFormDefinition(value, "save");
    return {
      errors: r.errors.map((e) => ({ message: e.message, path: e.path })),
      warnings: r.warnings.map((w) => ({ message: w.message, path: w.path })),
      canSave: save.canSave,
      canPublish: r.canPublish,
    };
  }, []);

  const authoring = useAuthoringState({
    initial: initialDef,
    current: def,
    validate,
  });
  const resetSaved = authoring.resetSaved;

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api(`/api/workflow-forms/${formRowId}`);
      const data = r.data as FormRow;
      setRow(data);
      setDef(data.definition);
      setInitialDef(data.definition);
      resetSaved(data.definition);
      setDeps(r.meta?.referencedBy ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load form");
    }
  }, [api, formRowId, resetSaved]);

  useEffect(() => {
    void load();
  }, [formRowId]); // reload when navigating to another form

  const readOnly = row?.lifecycle !== "DRAFT";

  async function save() {
    if (!def || readOnly || !authoring.validation.canSave) return;
    setBusy(true);
    authoring.markSaving();
    setError(null);
    setMessage(null);
    try {
      await api(`/api/workflow-forms/${formRowId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: def.title, definition: def }),
      });
      authoring.markSaved(def);
      setInitialDef(def);
      setMessage("Draft saved");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      authoring.markSaveError(msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!def || readOnly || !authoring.validation.canPublish) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/workflow-forms/${formRowId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: def.title, definition: def }),
      });
      await api(`/api/workflow-forms/${formRowId}/publish`, { method: "POST", body: "{}" });
      setMessage("Published — this version is immutable. Clone to draft to edit again.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function cloneDraft() {
    setBusy(true);
    setError(null);
    try {
      const r = await api("/api/workflow-forms", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId: formRowId }),
      });
      const newId = (r.data as { id?: string } | undefined)?.id;
      if (newId) onOpenForm?.(newId);
      else setMessage("Draft cloned");
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
    const nextLen = (def.fields?.length ?? 0) + 1;
    setDef({
      ...def,
      fields: [
        ...(def.fields ?? []),
        {
          key: `field_${nextLen}`,
          label: "New field",
          type: "text",
          scope: "order",
          required: false,
        },
      ],
    });
    setExpandedField(nextLen - 1);
    setSection("fields");
  }

  function removeField(index: number) {
    if (!def) return;
    setDef({ ...def, fields: (def.fields ?? []).filter((_, i) => i !== index) });
    setExpandedField(null);
    setRemoveFieldIdx(null);
  }

  function moveField(index: number, dir: -1 | 1) {
    if (!def) return;
    const fields = moveItem(def.fields ?? [], index, dir);
    if (fields === def.fields) return;
    setDef({ ...def, fields });
    setExpandedField(index + dir);
  }

  function moveLayout(index: number, dir: -1 | 1) {
    if (!def) return;
    const layout = moveItem(def.layout ?? [], index, dir);
    if (layout === def.layout) return;
    setDef({ ...def, layout });
  }

  function applyRecommendedLayout() {
    if (!def || readOnly) return;
    setDef({
      ...def,
      renderer: "generic",
      component: undefined,
      layout: [
        { widget: "FormFields", props: {} },
        { widget: "ActionButtons", props: {} },
      ],
    });
    setSection("layout");
  }

  if (!row || !def) {
    return <div className="form-studio__empty">{error ?? "Loading form…"}</div>;
  }

  const themeValue = def.themeId ?? (def.theme === "amber" ? "oms-attention" : "oms-default");
  const isMobile = tier === "compact";
  const isTablet = tier === "medium";

  const header = (
    <div className="form-studio__header">
      <div>
        <p className="form-studio__eyebrow">
          <LinkComponent href={formsHref}>Forms</LinkComponent>
          <span aria-hidden> / </span>
          {row.formId}
        </p>
        <div className="form-studio__title-row">
          <h1 className="form-studio__title">{def.title ?? row.name ?? row.formId}</h1>
          <StatusBadge status={row.lifecycle} />
        </div>
        <p className="form-studio__meta">
          FORM:{row.formId}@{row.version}
          {authoring.dirty ? " · Unsaved changes" : ""}
        </p>
      </div>
      {!isMobile && (
        <div className="form-studio__actions">
          {readOnly ? (
            <Button type="button" disabled={busy} onClick={() => void cloneDraft()}>
              Clone to draft
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !authoring.dirty || !authoring.validation.canSave}
                onClick={() => void save()}
              >
                Save draft
              </Button>
              <Button
                type="button"
                disabled={busy || !authoring.validation.canPublish}
                onClick={() => publishConfirm.ask()}
              >
                Publish
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const rail = (
    <nav className="form-studio__rail" aria-label="Form sections">
      {(
        [
          ["properties", "Properties"],
          ["layout", "Layout"],
          ["fields", "Fields"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`form-studio__rail-item${section === id ? " is-active" : ""}`}
          onClick={() => {
            setSection(id);
            setMobilePane("edit");
          }}
        >
          {label}
          {id === "fields" ? (
            <span className="form-studio__rail-count">{def.fields?.length ?? 0}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );

  const propertiesWorkspace = (
    <div className="form-studio__workspace-stack">
      {readOnly && (
        <div className="form-studio__banner form-studio__banner--warn" role="status">
          View only — clone to draft to edit this form.
        </div>
      )}
      <FormField label="Title">
        <input
          disabled={readOnly}
          className="form-studio__control"
          value={def.title ?? ""}
          onChange={(e) => setDef({ ...def, title: e.target.value })}
        />
      </FormField>
      <FormField label="Description">
        <textarea
          disabled={readOnly}
          className="form-studio__control"
          rows={2}
          value={def.description ?? ""}
          onChange={(e) => setDef({ ...def, description: e.target.value })}
        />
      </FormField>
      <FormField label="Confirm label">
        <input
          disabled={readOnly}
          className="form-studio__control"
          value={def.confirmLabel ?? ""}
          onChange={(e) => setDef({ ...def, confirmLabel: e.target.value || undefined })}
        />
      </FormField>
      <FormField label="Theme">
        <select
          disabled={readOnly}
          className="form-studio__control"
          value={themeValue}
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
      </FormField>
      <div>
        <p className="form-studio__label">Audiences</p>
        <div className="form-studio__chips">
          {AUDIENCES.map((aud) => {
            const selected = (def.audiences?.length ? def.audiences : ["ADMIN"]).includes(aud);
            return (
              <button
                key={aud}
                type="button"
                disabled={readOnly}
                aria-pressed={selected}
                className={`form-studio__chip${selected ? " is-on" : ""}`}
                onClick={() => {
                  const base = def.audiences?.length ? [...def.audiences] : ["ADMIN"];
                  const next = selected
                    ? base.filter((a) => a !== aud)
                    : [...new Set([...base, aud])];
                  setDef({ ...def, audiences: next.length ? next : undefined });
                }}
              >
                {aud}
              </button>
            );
          })}
        </div>
      </div>
      <label className="form-studio__chip">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={Boolean(def.showTotal)}
          onChange={(e) => setDef({ ...def, showTotal: e.target.checked })}
        />
        Show total
      </label>
    </div>
  );

  const layoutWorkspace = (
    <div className="form-studio__workspace-stack">
      <div className="form-studio__row-between">
        <p className="form-studio__hint">Widgets compose the live task screen. Authors see names; ids stay in metadata.</p>
        {!readOnly && (
          <select
            className="form-studio__control form-studio__control--sm"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = "";
              if (!id) return;
              const entry = widgetById.get(id)?.entry;
              setDef({
                ...def,
                layout: [
                  ...(def.layout ?? []),
                  { widget: id, props: { ...(entry?.defaultProps ?? {}) } },
                ],
              });
            }}
          >
            <option value="">+ Add widget</option>
            {widgets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.entry?.name ?? w.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {(def.layout ?? []).length === 0 ? (
        <div className="form-studio__empty-card">
          <p className="font-medium">No layout configured.</p>
          <p className="text-xs text-[var(--ink-soft)] mt-1">Recommended:</p>
          <ul className="text-xs mt-1 space-y-0.5">
            <li>✓ Form Fields</li>
            <li>✓ Action Buttons</li>
          </ul>
          {!readOnly && (
            <Button type="button" className="mt-3" onClick={applyRecommendedLayout}>
              Apply
            </Button>
          )}
        </div>
      ) : (
        <ul className="form-studio__layout-list">
          {(def.layout ?? []).map((w, i) => {
            const meta = widgetById.get(w.widget);
            const name = meta?.entry?.name ?? w.widget;
            return (
              <li key={`${w.widget}-${i}`} className="form-studio__layout-card">
                <div className="form-studio__row-between">
                  <div>
                    <p className="font-semibold text-sm text-[var(--ink)]">{name}</p>
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      {meta?.entry?.category ?? "Widget"}
                      {meta?.entry?.description ? ` · ${meta.entry.description}` : ""}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="form-studio__icon-row">
                      <button type="button" className="form-studio__icon-btn" aria-label="Move widget up" disabled={i === 0} onClick={() => moveLayout(i, -1)}>↑</button>
                      <button type="button" className="form-studio__icon-btn" aria-label="Move widget down" disabled={i === (def.layout?.length ?? 0) - 1} onClick={() => moveLayout(i, 1)}>↓</button>
                      <button
                        type="button"
                        className="form-studio__link-danger"
                        onClick={() =>
                          setDef({
                            ...def,
                            layout: (def.layout ?? []).filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                {!readOnly && meta?.entry?.editableProps?.length ? (
                  <div className="form-studio__prop-row">
                    {meta.entry.editableProps.map((p) =>
                      p.type === "boolean" ? (
                        <label key={p.key} className="form-studio__chip">
                          <input
                            type="checkbox"
                            checked={Boolean(w.props?.[p.key])}
                            onChange={(e) => {
                              const layout = [...(def.layout ?? [])];
                              layout[i] = {
                                ...w,
                                props: { ...(w.props ?? {}), [p.key]: e.target.checked },
                              };
                              setDef({ ...def, layout });
                            }}
                          />
                          {p.label}
                        </label>
                      ) : null
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const fieldsWorkspace = (
    <div className="form-studio__workspace-stack">
      <div className="form-studio__row-between">
        <p className="form-studio__hint">One field open at a time — expand to edit details.</p>
        {!readOnly && (
          <button type="button" className="form-studio__link" onClick={addField}>
            + Add field
          </button>
        )}
      </div>
      {(def.fields ?? []).length === 0 ? (
        <p className="form-studio__empty">No fields yet — add one to shape the task screen.</p>
      ) : (
        (def.fields ?? []).map((f, i) => {
          const open = expandedField === i;
          return (
            <div key={`${f.key}-${i}`} className="form-studio__field-card">
              <button
                type="button"
                className="form-studio__field-summary"
                aria-expanded={open}
                onClick={() => setExpandedField(open ? null : i)}
              >
                <span>
                  <span className="font-semibold text-sm text-[var(--ink)]">{f.label || f.key || "Untitled"}</span>
                  <span className="ml-2 text-[11px] text-[var(--ink-soft)]">
                    {f.type}
                    {f.required ? " · Required" : ""}
                  </span>
                </span>
                <span aria-hidden className="text-[var(--ink-soft)]">{open ? "▼" : "›"}</span>
              </button>
              {open ? (
            <div className="form-studio__field-grid">
              <FormField label="Key">
                <input disabled={readOnly} className="form-studio__control" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
              </FormField>
              <FormField label="Label">
                <input disabled={readOnly} className="form-studio__control" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
              </FormField>
              <FormField label="Type">
                <select disabled={readOnly} className="form-studio__control" value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FormFieldType })}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Scope" hint="order = once per task; per-item = each line">
                <select disabled={readOnly} className="form-studio__control" value={f.scope ?? "order"} onChange={(e) => updateField(i, { scope: e.target.value as "order" | "per-item" })}>
                  <option value="order">order</option>
                  <option value="per-item">per-item</option>
                </select>
              </FormField>
              <FormField label="Binding" hint="Path on the order entity, e.g. unitPrice">
                <input
                  disabled={readOnly}
                  className="form-studio__control"
                  value={f.binding ?? f.source ?? ""}
                  onChange={(e) =>
                    updateField(i, {
                      binding: e.target.value || undefined,
                      source: e.target.value || undefined,
                    })
                  }
                  placeholder="e.g. unitPrice"
                />
              </FormField>
              <label className="form-studio__chip self-end">
                <input type="checkbox" disabled={readOnly} checked={Boolean(f.required)} onChange={(e) => updateField(i, { required: e.target.checked })} />
                Required
              </label>
              {(f.type === "select" || f.type === "radio") && (
                <FormField label="Options" hint="One per line as value:label" className="sm:col-span-2">
                  <textarea
                    disabled={readOnly}
                    className="form-studio__control"
                    rows={3}
                    value={(f.options ?? []).map((o) => `${o.value}:${o.label}`).join("\n")}
                    onChange={(e) => {
                      const options = e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [value, ...rest] = line.split(":");
                          const label = rest.join(":").trim() || value;
                          return { value: value.trim(), label };
                        });
                      updateField(i, { options: options.length ? options : undefined });
                    }}
                    placeholder={"yes:Yes\nno:No"}
                  />
                </FormField>
              )}
              {!readOnly && (
                <div className="form-studio__icon-row sm:col-span-2">
                  <button type="button" className="form-studio__icon-btn" aria-label="Move field up" disabled={i === 0} onClick={() => moveField(i, -1)}>↑</button>
                  <button type="button" className="form-studio__icon-btn" aria-label="Move field down" disabled={i === (def.fields?.length ?? 0) - 1} onClick={() => moveField(i, 1)}>↓</button>
                  <button type="button" className="form-studio__link-danger" onClick={() => setRemoveFieldIdx(i)}>Remove</button>
                </div>
              )}
            </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );

  const workspace =
    section === "properties" ? propertiesWorkspace : section === "layout" ? layoutWorkspace : fieldsWorkspace;

  const review = (
    <div className="form-studio__review">
      {previewSlot ? (
        previewSlot({
          definition: def,
          readOnly,
          onApplyRecommendedLayout: readOnly ? undefined : applyRecommendedLayout,
        })
      ) : (
        <div className="form-studio__empty-card">
          <p className="font-medium">Task review unavailable</p>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Host must wire the Admin UI Host simulator for production-widget preview.
          </p>
        </div>
      )}
    </div>
  );

  const validationSummary =
    authoring.validation.errors.length > 0 || authoring.validation.warnings.length > 0 ? (
      <div className="form-studio__validation" role="status">
        {authoring.validation.errors.map((e, i) => (
          <p key={`e-${i}`} className="form-studio__err">{e.message}</p>
        ))}
        {authoring.validation.warnings.map((w, i) => (
          <p key={`w-${i}`} className="form-studio__warn">{w.message}</p>
        ))}
      </div>
    ) : null;

  const footer = (
    <FooterActions
      stats={
        <>
          <FooterStat label="Fields" value={def.fields?.length ?? 0} />
          <FooterStat label="Widgets" value={def.layout?.length ?? 0} />
          <FooterStat
            label="Status"
            value={authoring.dirty ? "Unsaved" : authoring.saveStatus === "saved" ? "Saved" : row.lifecycle}
          />
        </>
      }
      actions={
        isMobile ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setMobilePane(mobilePane === "edit" ? "preview" : "edit")}>
              {mobilePane === "edit" ? "Preview" : "Edit"}
            </Button>
            {readOnly ? (
              <Button type="button" disabled={busy} onClick={() => void cloneDraft()}>Clone</Button>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={busy || !authoring.dirty || !authoring.validation.canSave} onClick={() => void save()}>Save</Button>
                <Button type="button" disabled={busy || !authoring.validation.canPublish} onClick={() => publishConfirm.ask()}>Publish</Button>
              </>
            )}
          </>
        ) : (
          <span className="text-xs text-[var(--ink-soft)]">
            {authoring.validation.canPublish ? "Ready to publish" : "Fix validation to publish"}
          </span>
        )
      }
    />
  );

  return (
    <div className="form-studio">
      {message && <div className="form-studio__banner form-studio__banner--ok" role="status">{message}</div>}
      {error && <div className="form-studio__banner form-studio__banner--err" role="alert">{error}</div>}
      {deps.length > 0 && (
        <div className="form-studio__banner form-studio__banner--warn">
          Referenced by {deps.map((d) => `${d.consumerType} ${d.consumerId} v${d.consumerVersion}`).join(", ")}
        </div>
      )}
      {validationSummary}

      {isMobile ? (
        <div className="form-studio__mobile">
          {header}
          <Tabs
            tabs={[
              { key: "edit", label: "Edit" },
              { key: "preview", label: "Preview" },
            ]}
            active={mobilePane}
            onChange={(id) => setMobilePane(id as "edit" | "preview")}
          />
          {mobilePane === "edit" ? (
            <div className="form-studio__mobile-edit">
              {rail}
              <div className="form-studio__panel">{workspace}</div>
            </div>
          ) : (
            review
          )}
          <div className="form-studio__footer-sticky">{footer}</div>
        </div>
      ) : (
        <div className="form-studio__shell">
          <div className="form-studio__shell-header">{header}</div>
          <div className="form-studio__shell-body">
            <aside className="form-studio__shell-rail">{rail}</aside>
            <main className="form-studio__shell-workspace">
              <div className="form-studio__panel">{workspace}</div>
            </main>
            {!isTablet && (
              <aside className="form-studio__shell-review sticky top-0 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
                {review}
              </aside>
            )}
          </div>
          {isTablet && (
            <div className="form-studio__tablet-review px-4 pb-4">{review}</div>
          )}
          <div className="form-studio__shell-footer">{footer}</div>
        </div>
      )}

      <ConfirmModal
        open={publishConfirm.open}
        title="Publish this form?"
        description="Published versions are immutable. Workflows can reference this version; further edits require Clone to draft."
        confirmLabel="Publish"
        onClose={publishConfirm.cancel}
        onConfirm={() => void publishConfirm.confirm(() => publish())}
      />
      <ConfirmModal
        open={removeFieldIdx != null}
        title="Remove field?"
        description="This removes the field from the draft. Save to persist."
        confirmLabel="Remove"
        variant="danger"
        onClose={() => setRemoveFieldIdx(null)}
        onConfirm={() => {
          if (removeFieldIdx != null) removeField(removeFieldIdx);
        }}
      />
    </div>
  );
}
