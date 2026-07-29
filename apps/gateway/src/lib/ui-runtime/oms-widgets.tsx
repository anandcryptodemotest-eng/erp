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

    return (
      <div className="space-y-3" key="FormFields">
        {orderFields.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {orderFields.map((f) => (
              <label key={f.key} className="block text-xs text-slate-500">
                {f.label}
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  type={f.key.toLowerCase().includes("date") ? "date" : f.type === "number" ? "number" : "text"}
                  value={runtime.context.fieldValues[f.key] ?? ""}
                  onChange={(e) => runtime.context.setFieldValue(f.key, e.target.value)}
                />
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
                      <input
                        className="mt-0.5 block w-32 rounded border border-slate-200 px-2 py-1.5 text-sm"
                        type={f.type === "number" ? "number" : "text"}
                        value={runtime.context.fieldValues[fieldKey(f.key, item.id)] ?? ""}
                        onChange={(e) =>
                          runtime.context.setFieldValue(f.key, e.target.value, item.id)
                        }
                      />
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
          if (v == null || v === "") errors.push(`${f.label} required for ${item.productName}`);
        }
      } else {
        const v = runtime.context.fieldValues[f.key];
        if (v == null || v === "") errors.push(`${f.label} is required`);
      }
    }
    return { ok: errors.length === 0, errors };
  },
  collectPayload(runtime) {
    const out: Record<string, unknown> = {};
    for (const f of runtime.context.screen.fields ?? []) {
      if (f.scope === "per-item") continue;
      const v = runtime.context.fieldValues[f.key];
      if (v != null && v !== "") out[f.key] = v;
    }
    return out;
  },
};

const ProductListWidget: Widget = {
  render(runtime, props) {
    const showPrice = Boolean(props.showPrice);
    const editable = Boolean(props.editable);
    const allowRemove = Boolean(props.allowRemove) && Boolean(runtime.context.lineEditor?.canRemove);
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
      defaultProps: { editable: false, showPrice: false, allowAdd: false, allowRemove: false },
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
}

export type { ReactNode, ValidationResult };
