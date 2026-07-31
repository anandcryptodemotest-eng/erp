"use client";

import { useState, type ReactNode } from "react";
import {
  registerWidget,
  type UIRuntime,
  type ValidationResult,
  type Widget,
} from "@erp/ui-runtime";

function fieldKey(key: string, itemId?: string) {
  return itemId ? `${key}:${itemId}` : key;
}

const FormFieldsWidget: Widget = {
  render(runtime: UIRuntime) {
    const fields = runtime.context.screen.fields ?? [];
    const items = runtime.context.items ?? [];
    const perItem = fields.filter((f) => f.scope === "per-item");
    const orderFields = fields.filter((f) => f.scope !== "per-item");
    const canEdit = runtime.context.permissions.canEdit;

    function renderControl(
      f: (typeof fields)[number],
      value: string,
      onChange: (v: string) => void,
      opts?: { className?: string }
    ) {
      const cls =
        opts?.className ??
        "mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50";
      if (f.type === "readonly") {
        return <span className="mt-0.5 block text-sm text-slate-700">{value || "—"}</span>;
      }
      if (f.type === "textarea") {
        return (
          <textarea
            className={cls}
            disabled={!canEdit}
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }
      if (f.type === "checkbox") {
        return (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={!canEdit}
            checked={value === "true" || value === "1"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />
        );
      }
      if (f.type === "select" || f.type === "radio") {
        const options = f.options ?? [];
        if (f.type === "radio") {
          return (
            <div className="mt-1 flex flex-wrap gap-3">
              {options.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={f.key}
                    disabled={!canEdit}
                    checked={value === o.value}
                    onChange={() => onChange(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          );
        }
        return (
          <select
            className={cls}
            disabled={!canEdit}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      const inputType =
        f.type === "number" || f.type === "currency" || f.type === "percentage" || f.type === "rating"
          ? "number"
          : f.type === "date"
            ? "date"
            : f.type === "datetime"
              ? "datetime-local"
              : f.type === "email"
                ? "email"
                : f.type === "phone"
                  ? "tel"
                  : f.type === "url"
                    ? "url"
                    : "text";
      const step =
        f.type === "currency" || f.type === "percentage"
          ? "0.01"
          : f.type === "rating"
            ? "1"
            : undefined;
      const min = f.type === "rating" ? 1 : f.type === "percentage" || f.type === "currency" ? 0 : undefined;
      const max = f.type === "rating" ? 5 : f.type === "percentage" ? 100 : undefined;
      return (
        <input
          className={cls}
          type={inputType}
          disabled={!canEdit}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    return (
      <div className="space-y-3" key="FormFields">
        {orderFields.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {orderFields.map((f) => (
              <label key={f.key} className="block text-xs text-slate-500">
                {f.label}
                {f.required ? " *" : ""}
                {renderControl(f, runtime.context.fieldValues[f.key] ?? "", (v) =>
                  runtime.context.setFieldValue(f.key, v)
                )}
              </label>
            ))}
          </div>
        )}
        {perItem.length > 0 &&
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">{item.productName}</span>
                <span className="text-slate-500">
                  Ordered {item.quantity}
                  {item.unitPrice != null ? ` · ${item.unitPrice}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {perItem.map((f) =>
                  f.type === "readonly" ? (
                    <span key={f.key} className="text-xs text-slate-400 pb-2">
                      {f.label}{" "}
                      {String(
                        (item as Record<string, unknown>)[f.binding ?? f.source ?? f.key] ?? ""
                      )}
                    </span>
                  ) : (
                    <label key={f.key} className="block text-xs text-slate-500">
                      {f.label}
                      {f.required ? " *" : ""}
                      {renderControl(
                        f,
                        runtime.context.fieldValues[fieldKey(f.key, item.id)] ?? "",
                        (v) => runtime.context.setFieldValue(f.key, v, item.id),
                        {
                          className:
                            "mt-0.5 block w-32 rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50",
                        }
                      )}
                    </label>
                  )
                )}
              </div>
            </div>
          ))}
      </div>
    );
  },
  validate(runtime) {
    const errors: string[] = [];
    for (const f of runtime.context.screen.fields ?? []) {
      if (!f.required) continue;
      if (f.scope === "per-item") {
        for (const item of runtime.context.items ?? []) {
          const v = runtime.context.fieldValues[fieldKey(f.key, item.id)];
          if (v == null || v === "" || (f.type === "checkbox" && v === "false")) {
            errors.push(`${f.label} required for ${item.productName}`);
          }
        }
      } else {
        const v = runtime.context.fieldValues[f.key];
        if (v == null || v === "" || (f.type === "checkbox" && v === "false")) {
          errors.push(`${f.label} is required`);
        }
      }
    }
    return { ok: errors.length === 0, errors };
  },
  collectPayload(runtime) {
    const fields = runtime.context.screen.fields ?? [];
    const out: Record<string, unknown> = {};

    function coerce(f: (typeof fields)[number], v: string): unknown {
      if (f.type === "checkbox") return v === "true" || v === "1";
      if (
        f.type === "number" ||
        f.type === "currency" ||
        f.type === "percentage" ||
        f.type === "rating"
      ) {
        return Number(v);
      }
      return v;
    }

    for (const f of fields) {
      if (f.scope === "per-item") continue;
      const v = runtime.context.fieldValues[f.key];
      if (v == null || v === "") continue;
      out[f.key] = coerce(f, v);
    }

    const perItem = fields.filter((f) => f.scope === "per-item");
    if (perItem.length > 0) {
      out.items = (runtime.context.items ?? []).map((item) => {
        const row: Record<string, unknown> = {
          orderItemId: item.id,
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
        for (const f of perItem) {
          if (f.type === "readonly") {
            row[f.key] = (item as Record<string, unknown>)[f.source ?? f.key];
            continue;
          }
          const raw = runtime.context.fieldValues[fieldKey(f.key, item.id)];
          if (raw == null || raw === "") {
            // Fall back to item field / source so verify-stock still gets availableQty
            const fallback = (item as Record<string, unknown>)[f.source ?? f.key];
            if (fallback != null && fallback !== "") {
              row[f.key] =
                f.type === "number" || f.type === "currency"
                  ? Number(fallback)
                  : fallback;
            }
            continue;
          }
          row[f.key] = coerce(f, raw);
        }
        return row;
      });
    }
    return out;
  },
};

const ProductListWidget: Widget = {
  render(runtime, props) {
    const showPrice = Boolean(props.showPrice);
    const editable = Boolean(props.editable);
    // Editable product lists can remove lines unless explicitly disabled
    const allowRemove =
      (props.allowRemove === false
        ? false
        : Boolean(props.allowRemove) || editable) &&
      Boolean(runtime.context.lineEditor?.canRemove);
    const canEditPrice =
      Boolean(props.showPrice) && Boolean(runtime.context.lineEditor?.canEditPrice);
    const items = runtime.context.items ?? [];

    return (
      <div className="space-y-2" key="ProductList">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-slate-800">{item.productName}</span>
              {allowRemove && runtime.context.permissions.canEdit && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline shrink-0"
                  onClick={() => runtime.context.lineEditor?.removeLine(item.id)}
                >
                  Remove
                </button>
              )}
            </div>
            {editable && runtime.context.permissions.canEdit ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-xs text-slate-500">
                  Qty
                  <input
                    className="mt-0.5 block w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
                    type="number"
                    min={1}
                    value={
                      runtime.context.fieldValues[`quantity:${item.id}`] ?? String(item.quantity)
                    }
                    onChange={(e) =>
                      runtime.context.setFieldValue("quantity", e.target.value, item.id)
                    }
                  />
                </label>
                {canEditPrice ? (
                  <label className="block text-xs text-slate-500">
                    Unit price
                    <input
                      className="mt-0.5 block w-32 rounded border border-slate-200 px-2 py-1.5 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={
                        runtime.context.fieldValues[`unitPrice:${item.id}`] ??
                        String(item.unitPrice ?? 0)
                      }
                      onChange={(e) =>
                        runtime.context.setFieldValue("unitPrice", e.target.value, item.id)
                      }
                    />
                  </label>
                ) : showPrice && item.unitPrice != null ? (
                  <span className="text-xs text-slate-500 pb-2">Unit price {item.unitPrice}</span>
                ) : null}
              </div>
            ) : (
              <span className="text-slate-500">
                Qty {item.quantity}
                {showPrice && item.unitPrice != null ? ` · ${item.unitPrice}` : ""}
              </span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-amber-700">No products — add from catalog, or cancel the order.</p>
        )}
        {runtime.context.lineEditor?.cancelOrder && items.length === 0 && (
          <button
            type="button"
            className="text-xs text-red-600 underline"
            onClick={() => runtime.context.lineEditor?.cancelOrder?.()}
          >
            Cancel SO
          </button>
        )}
      </div>
    );
  },
  validate(runtime, props) {
    if (Boolean(props.editable) && (runtime.context.items?.length ?? 0) === 0) {
      return { ok: false, errors: ["Add at least one product"] };
    }
    return { ok: true };
  },
  collectPayload(runtime) {
    const items = (runtime.context.items ?? []).map((item) => ({
      id: item.id.startsWith("new-") ? undefined : item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Math.max(
        1,
        Math.round(Number(runtime.context.fieldValues[`quantity:${item.id}`] ?? item.quantity))
      ),
      unitPrice: Number(
        runtime.context.fieldValues[`unitPrice:${item.id}`] ?? item.unitPrice ?? 0
      ),
    }));
    return { items };
  },
};

function CatalogSearchInner({ runtime }: { runtime: UIRuntime }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<
    { id: string; name: string; sku?: string | null; sellPrice?: number | null }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const editor = runtime.context.lineEditor;
  if (!editor?.canAdd || !runtime.context.permissions.canEdit) return null;

  async function onSearch(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    try {
      const rows = await editor!.searchProducts(value.trim());
      setHits(rows);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-600">Add product</p>
      <input
        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        placeholder="Search catalog (min 2 letters)…"
        value={q}
        onChange={(e) => void onSearch(e.target.value)}
      />
      {busy && <p className="text-[11px] text-slate-400">Searching…</p>}
      {hits.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  editor!.addProduct(p);
                  setQ("");
                  setHits([]);
                  runtime.toast.success(`Added ${p.name}`);
                }}
              >
                <span className="font-medium text-slate-800">{p.name}</span>
                {p.sku && <span className="ml-2 text-xs text-slate-400">{p.sku}</span>}
                {p.sellPrice != null && (
                  <span className="block text-xs text-slate-500">{p.sellPrice}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CatalogSearchWidget: Widget = {
  render(runtime) {
    return <CatalogSearchInner key="CatalogSearch" runtime={runtime} />;
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

const ActionButtonsWidget: Widget = {
  render(runtime, props) {
    const label =
      (props.label as string) ||
      runtime.context.screen.confirmLabel ||
      "Complete this step →";
    const theme = runtime.theme;
    if (!runtime.context.permissions.canComplete) return null;
    return (
      <div className="space-y-2" key="ActionButtons">
        {runtime.context.lineEditor?.cancelOrder && (
          <button
            type="button"
            className="text-xs text-red-600 underline"
            onClick={() => runtime.context.lineEditor?.cancelOrder?.()}
          >
            Cancel SO
          </button>
        )}
        <button
          type="button"
          className={`w-full rounded-lg px-4 py-3 text-sm font-semibold ${theme.buttonBg} ${theme.buttonText} hover:opacity-90 disabled:opacity-50`}
          onClick={() =>
            runtime.context.variables.__requestComplete &&
            (runtime.context.variables.__requestComplete as () => void)()
          }
        >
          {label}
        </button>
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

import { ensurePhase2WidgetsRegistered } from "./phase2-widgets";

let registered = false;

export function ensureOmsWidgetsRegistered(): void {
  if (registered) return;
  registered = true;
  registerWidget({
    manifest: {
      id: "FormFields",
      category: "Input",
      displayName: "Form Fields",
      icon: "form",
      supportsValidation: true,
      supportsPayload: true,
    },
    factory: () => FormFieldsWidget,
  });
  registerWidget({
    manifest: {
      id: "ProductList",
      category: "Business",
      displayName: "Product List",
      icon: "shopping-cart",
      supportsValidation: true,
      supportsPayload: true,
      defaultProps: { editable: true, showPrice: true, allowAdd: false, allowRemove: true },
    },
    factory: () => ProductListWidget,
  });
  registerWidget({
    manifest: {
      id: "CatalogSearch",
      category: "Business",
      displayName: "Catalog Search",
      icon: "search",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => CatalogSearchWidget,
  });
  registerWidget({
    manifest: {
      id: "ActionButtons",
      category: "Input",
      displayName: "Action Buttons",
      icon: "check",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => ActionButtonsWidget,
  });
  ensurePhase2WidgetsRegistered();
}

export type { ReactNode, ValidationResult };
