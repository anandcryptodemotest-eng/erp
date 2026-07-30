"use client";

/**
 * Customer Host widgets — shared contract with Admin (ADR 0010).
 * Widgets never import Host code or call REST.
 */

import {
  registerWidget,
  ensureDefaultThemes,
  type UIRuntime,
  type Widget,
} from "@erp/ui-runtime";

const FormFieldsWidget: Widget = {
  render(runtime: UIRuntime) {
    const fields = runtime.context.screen.fields ?? [];
    const orderFields = fields.filter((f) => f.scope !== "per-item");
    const canEdit = runtime.context.permissions.canEdit;
    const cls =
      "mt-0.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c8922a]/40 disabled:bg-[var(--mist)]";

    return (
      <div className="space-y-3" key="FormFields">
        {orderFields.map((f) => {
          const value = runtime.context.fieldValues[f.key] ?? "";
          const onChange = (v: string) => runtime.context.setFieldValue(f.key, v);
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--line)]"
                  disabled={!canEdit}
                  checked={value === "true" || value === "1"}
                  onChange={(e) => onChange(e.target.checked ? "true" : "false")}
                />
                {f.label}
                {f.required ? " *" : ""}
              </label>
            );
          }
          const inputType =
            f.type === "email"
              ? "email"
              : f.type === "phone"
                ? "tel"
                : f.type === "number" || f.type === "currency"
                  ? "number"
                  : "text";
          return (
            <label key={f.key} className="block text-xs text-[var(--ink-soft)]">
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "textarea" ? (
                <textarea
                  className={cls}
                  disabled={!canEdit}
                  rows={3}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                />
              ) : f.type === "radio" ? (
                <div className="mt-1 space-y-2">
                  {(f.options ?? []).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onChange(o.value)}
                      className={`w-full rounded-xl border p-3 text-left ${
                        value === o.value
                          ? "border-[#121a16] bg-[#f3efe6]"
                          : "border-[var(--line)] bg-white"
                      }`}
                    >
                      <div className="text-sm font-medium text-[var(--ink)]">{o.label}</div>
                    </button>
                  ))}
                </div>
              ) : f.type === "select" ? (
                <select
                  className={cls}
                  disabled={!canEdit}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                >
                  <option value="">Select…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={inputType}
                  className={cls}
                  disabled={!canEdit}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
    );
  },
  validate(runtime) {
    const errors: string[] = [];
    for (const f of runtime.context.screen.fields ?? []) {
      if (f.scope === "per-item" || !f.required) continue;
      const v = runtime.context.fieldValues[f.key];
      if (v == null || v === "" || (f.type === "checkbox" && v === "false")) {
        errors.push(`${f.label} is required`);
      }
    }
    return errors.length ? { ok: false, errors } : { ok: true };
  },
  collectPayload(runtime) {
    const out: Record<string, unknown> = {};
    for (const f of runtime.context.screen.fields ?? []) {
      if (f.scope === "per-item") continue;
      const v = runtime.context.fieldValues[f.key];
      if (f.type === "checkbox") {
        out[f.key] = v === "true" || v === "1";
        continue;
      }
      if (v !== undefined && v !== "") out[f.key] = v;
    }
    return out;
  },
};

const ProductListWidget: Widget = {
  render(runtime) {
    const showPrice = true;
    const items = runtime.context.items ?? [];
    return (
      <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-3" key="ProductList">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--ink)] line-clamp-2">{item.productName}</div>
              <div className="text-xs text-[var(--ink-soft)]">Qty {item.quantity}</div>
            </div>
            {showPrice && item.unitPrice != null && (
              <span className="font-semibold text-[var(--ink)]">
                ₹{(Number(item.unitPrice) * item.quantity).toLocaleString("en-IN")}
              </span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-[var(--ink-soft)]">No items</p>
        )}
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: (runtime) => ({
    items: (runtime.context.items ?? []).map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }),
};

const ActionButtonsWidget: Widget = {
  render(runtime) {
    const label = runtime.context.screen.confirmLabel ?? "Continue";
    const can = runtime.context.permissions.canComplete;
    return (
      <button
        key="ActionButtons"
        type="button"
        disabled={!can}
        className="btn-dark w-full py-3 text-sm disabled:opacity-60"
        onClick={() =>
          runtime.context.variables.__requestComplete &&
          (runtime.context.variables.__requestComplete as () => void)()
        }
      >
        {label}
      </button>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

const StatusBannerWidget: Widget = {
  render(runtime) {
    const status = String(runtime.context.order?.status ?? "—");
    const number = String(
      runtime.context.order?.requestNumber ?? runtime.context.order?.orderNumber ?? ""
    );
    return (
      <div
        key="StatusBanner"
        className="rounded-2xl border border-[var(--line)] bg-[#f3efe6] px-4 py-3 text-sm text-[var(--ink)]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Status</p>
        <p className="mt-1 font-display text-lg font-semibold">
          {status}
          {number ? <span className="ml-2 text-sm font-normal text-[var(--ink-soft)]">{number}</span> : null}
        </p>
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

const TimelineWidget: Widget = {
  render(runtime) {
    const events = runtime.context.timeline ?? [];
    return (
      <ol className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4" key="Timeline">
        {events.map((ev, i) => (
          <li key={ev.id} className="flex gap-3 text-sm">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                i === events.length - 1 ? "bg-[var(--forest-mid)]" : "bg-[var(--line)]"
              }`}
            />
            <div>
              <p className="font-medium text-[var(--ink)]">{ev.title}</p>
              <p className="text-xs text-[var(--ink-soft)]">
                {new Date(ev.at).toLocaleString()}
                {ev.remarks ? ` · ${ev.remarks}` : ""}
              </p>
            </div>
          </li>
        ))}
        {events.length === 0 && (
          <li className="text-xs text-[var(--ink-soft)]">No timeline events yet</li>
        )}
      </ol>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

let registered = false;

export function ensureCustomerWidgetsRegistered(): void {
  if (registered) return;
  registered = true;
  ensureDefaultThemes();
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
      icon: "cart",
      supportsValidation: false,
      supportsPayload: true,
    },
    factory: () => ProductListWidget,
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
  registerWidget({
    manifest: {
      id: "StatusBanner",
      category: "Workflow",
      displayName: "Status Banner",
      icon: "flag",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => StatusBannerWidget,
  });
  registerWidget({
    manifest: {
      id: "Timeline",
      category: "Workflow",
      displayName: "Timeline",
      icon: "clock",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => TimelineWidget,
  });
}
