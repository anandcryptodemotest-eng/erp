"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useFormContext } from "react-hook-form";
import { api } from "@/lib/admin-api";
import { useProductMeta, type AttrDef } from "./ProductMeta";
import type { CreateProductForm } from "./schema";
import { btnGhost, btnOutlineBrand, btnPrimary, btnSecondary, fieldClass, optionList } from "./utils";

/** Shared open state so the header button and body panel stay in sync. */
let attributeCreateOpen = false;
const attributeCreateListeners = new Set<() => void>();

function subscribeAttributeCreate(cb: () => void) {
  attributeCreateListeners.add(cb);
  return () => attributeCreateListeners.delete(cb);
}

function getAttributeCreateOpen() {
  return attributeCreateOpen;
}

function setAttributeCreateOpen(next: boolean) {
  attributeCreateOpen = next;
  attributeCreateListeners.forEach((l) => l());
}

export function useAttributeCreateOpen() {
  const open = useSyncExternalStore(subscribeAttributeCreate, getAttributeCreateOpen, getAttributeCreateOpen);
  return [open, setAttributeCreateOpen] as const;
}

function slugifyKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

async function createAttributeWithRetry(base: {
  label: string;
  dataType: string;
  unit?: string;
  options?: string[];
  isRequired: boolean;
  categoryIds?: string[];
}): Promise<AttrDef> {
  const key = slugifyKey(base.label);
  try {
    const existingRes = await api("/api/attribute-definitions?includeInactive=true");
    const existing = (existingRes.data as AttrDef[] | undefined)?.find((d) => d.key === key);
    if (existing) {
      const categoryId = base.categoryIds?.[0];
      if (categoryId) {
        const patched = await api(`/api/attribute-definitions/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            isActive: true,
            categoryOptions: [{ categoryId, options: base.options ?? null }],
          }),
        });
        return { ...(patched.data as AttrDef), options: base.options ?? (patched.data as AttrDef).options };
      }
      return existing;
    }
  } catch {
    /* fall through */
  }

  let attemptKey = key;
  let attempt = 0;
  while (attempt < 6) {
    try {
      const res = await api("/api/attribute-definitions", {
        method: "POST",
        body: JSON.stringify({
          key: attemptKey,
          label: base.label,
          dataType: base.dataType,
          unit: base.unit || undefined,
          options: base.options,
          isRequired: base.isRequired,
          categoryIds: base.categoryIds,
        }),
      });
      return res.data as AttrDef;
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (message.includes("already exists") && attempt < 5) {
        attempt += 1;
        attemptKey = `${key}_${attempt + 1}`;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not create attribute");
}

function QuickCreatePanel({
  title,
  description,
  children,
  onCancel,
  onSubmit,
  submitLabel,
  busy,
  error,
  footerLeft,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
  error?: string;
  footerLeft?: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--brand)_22%,var(--line))] bg-[var(--surface-raised)] shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--brand)_7%,var(--mist))] px-4 py-3">
        <div className="min-w-0">
          <h4 id={titleId} className="text-sm font-semibold text-[var(--ink)]">
            {title}
          </h4>
          {description ? <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{description}</p> : null}
        </div>
        <button type="button" onClick={onCancel} className={btnGhost + " !px-2 !py-1 text-xs"} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="space-y-4 p-4">
        {children}
        {error ? (
          <p className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          {footerLeft}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={onSubmit} disabled={busy} className={btnPrimary}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline Category / Brand on Identity — explicit Add / Cancel panels. */
export function InlineCatalogCreates() {
  const { setValue } = useFormContext<CreateProductForm>();
  const { refreshCatalog } = useProductMeta();
  const [mode, setMode] = useState<"idle" | "category" | "brand">("idle");
  const [catName, setCatName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setMode("idle");
    setCatName("");
    setBrandName("");
    setError("");
  }

  async function addCategory() {
    const name = catName.trim();
    if (!name) return setError("Category name is required");
    setBusy(true);
    setError("");
    try {
      const res = await api("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
      await refreshCatalog();
      setValue("categoryId", res.data.id, { shouldDirty: true });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addBrand() {
    const name = brandName.trim();
    if (!name) return setError("Brand name is required");
    setBusy(true);
    setError("");
    try {
      const res = await api("/api/brands", { method: "POST", body: JSON.stringify({ name }) });
      await refreshCatalog();
      setValue("brandId", res.data.id, { shouldDirty: true });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnOutlineBrand}
            onClick={() => {
              setMode("category");
              setError("");
            }}
          >
            <span aria-hidden>+</span> New category
          </button>
          <button
            type="button"
            className={btnOutlineBrand}
            onClick={() => {
              setMode("brand");
              setError("");
            }}
          >
            <span aria-hidden>+</span> New brand
          </button>
        </div>
      ) : null}

      {mode === "category" && (
        <QuickCreatePanel
          title="Add category"
          description="Creates a catalog category and selects it for this product."
          onCancel={close}
          onSubmit={() => void addCategory()}
          submitLabel="Add category"
          busy={busy}
          error={error}
        >
          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">Category name</label>
            <input
              autoFocus
              className={fieldClass}
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addCategory();
                }
              }}
              placeholder="e.g. Plywood"
            />
          </div>
        </QuickCreatePanel>
      )}

      {mode === "brand" && (
        <QuickCreatePanel
          title="Add brand"
          description="Creates a brand and selects it for this product."
          onCancel={close}
          onSubmit={() => void addBrand()}
          submitLabel="Add brand"
          busy={busy}
          error={error}
        >
          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">Brand name</label>
            <input
              autoFocus
              className={fieldClass}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addBrand();
                }
              }}
              placeholder="e.g. Greenply"
            />
          </div>
        </QuickCreatePanel>
      )}
    </div>
  );
}

/** Edit existing attribute (label, unit, values) for current category. */
export function AttributeEditPanel({
  attr,
  categoryId,
  onClose,
  onSaved,
}: {
  attr: AttrDef;
  categoryId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(attr.label);
  const [unit, setUnit] = useState(attr.unit ?? "");
  const [optionsText, setOptionsText] = useState(optionList(attr.options).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEditValues =
    attr.dataType === "SELECT" || attr.dataType === "MULTI_SELECT" || attr.dataType === "NUMBER";

  async function save() {
    const name = label.trim();
    if (!name) return setError("Name is required");
    const opts = optionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (canEditValues && opts.length === 0) {
      return setError("Add at least one value (comma-separated)");
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/attribute-definitions/${attr.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: name,
          ...(attr.dataType === "NUMBER" ? { unit: unit.trim() || null } : {}),
          ...(canEditValues
            ? {
                options: opts,
                categoryOptions: [{ categoryId, options: opts }],
              }
            : {}),
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete attribute "${attr.label}"? It will be hidden from Configuration and Custom Fields (soft delete).`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/attribute-definitions/${attr.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuickCreatePanel
      title={`Edit ${attr.label}`}
      description={`Key ${attr.key} · ${attr.dataType}${attr.unit ? ` (${attr.unit})` : ""} — values apply to this category.`}
      onCancel={onClose}
      onSubmit={() => void save()}
      submitLabel="Save changes"
      busy={busy}
      error={error}
      footerLeft={
        <button
          type="button"
          disabled={busy}
          className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-40"
          onClick={() => void remove()}
        >
          Delete
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={canEditValues && attr.dataType !== "NUMBER" ? "sm:col-span-2" : ""}>
          <label className="block text-sm font-medium text-[var(--ink)]">Display name</label>
          <input
            autoFocus
            className={fieldClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        {attr.dataType === "NUMBER" && (
          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">Unit</label>
            <input className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mm" />
          </div>
        )}
        {canEditValues && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--ink)]">
              Allowed values (comma-separated)
            </label>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="6, 12, 18, 19"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
              These become selectable chips in Configuration for this category.
            </p>
          </div>
        )}
      </div>
    </QuickCreatePanel>
  );
}

/** Compact trigger for the Configuration card header. */
export function ConfigurationHeaderActions() {
  const { watch } = useFormContext<CreateProductForm>();
  const categoryId = watch("categoryId");
  const [open, setOpen] = useAttributeCreateOpen();
  if (!categoryId) return null;
  return (
    <NewAttributeButton
      open={open}
      onOpen={() => setOpen(true)}
      className="self-center"
    />
  );
}

/** Compact trigger for the Configuration card header / attributes row. */
export function NewAttributeButton({
  open,
  onOpen,
  className,
}: {
  open: boolean;
  onOpen: () => void;
  className?: string;
}) {
  if (open) return null;
  return (
    <button type="button" className={`${btnOutlineBrand} !py-1.5 !text-xs shrink-0 ${className ?? ""}`} onClick={onOpen}>
      <span aria-hidden>+</span> New attribute
    </button>
  );
}

/** Create-attribute panel (edit existing via Edit on each field). */
export function InlineAttributeCreates() {
  const { watch } = useFormContext<CreateProductForm>();
  const { refreshAttrs } = useProductMeta();
  const categoryId = watch("categoryId");
  const [open, setOpen] = useAttributeCreateOpen();
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState("SELECT");
  const [unit, setUnit] = useState("");
  const [options, setOptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!categoryId || !open) return null;

  function closeCreate() {
    setOpen(false);
    setLabel("");
    setOptions("");
    setUnit("");
    setError("");
  }

  async function createField() {
    const name = label.trim();
    if (!name) return setError("Field name is required");
    const needsOptions = dataType === "SELECT" || dataType === "MULTI_SELECT" || dataType === "NUMBER";
    const opts = options
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (needsOptions && opts.length === 0) {
      return setError("Add at least one value (comma-separated), e.g. 6, 12, 18");
    }
    setBusy(true);
    setError("");
    try {
      await createAttributeWithRetry({
        label: name,
        dataType,
        unit: unit || undefined,
        options: needsOptions ? opts : undefined,
        isRequired: false,
        categoryIds: [categoryId],
      });
      await refreshAttrs(categoryId);
      closeCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuickCreatePanel
      title="Add attribute"
      description="Linked to the selected category. Use NUMBER + values for Thickness-style fields."
      onCancel={closeCreate}
      onSubmit={() => void createField()}
      submitLabel="Create attribute"
      busy={busy}
      error={error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--ink)]">Name</label>
          <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Thickness" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--ink)]">Type</label>
          <select className={fieldClass} value={dataType} onChange={(e) => setDataType(e.target.value)}>
            <option value="SELECT">SELECT (list)</option>
            <option value="NUMBER">NUMBER (with allowed values)</option>
            <option value="MULTI_SELECT">MULTI_SELECT</option>
            <option value="TEXT">TEXT</option>
          </select>
        </div>
        {dataType === "NUMBER" && (
          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">Unit</label>
            <input className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mm" />
          </div>
        )}
        {(dataType === "SELECT" || dataType === "MULTI_SELECT" || dataType === "NUMBER") && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--ink)]">Values (comma-separated)</label>
            <input
              className={fieldClass}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="6, 12, 18, 19"
            />
          </div>
        )}
      </div>
    </QuickCreatePanel>
  );
}
