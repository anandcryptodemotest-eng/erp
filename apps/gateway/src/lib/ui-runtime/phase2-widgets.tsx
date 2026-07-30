"use client";

/**
 * Phase 2 OMS widgets (ADR 0009 Platform v1.1 UI Composition).
 * Widgets only use UIRuntime / UIContext — never REST.
 */

import { useState } from "react";
import {
  registerWidget,
  type UIRuntime,
  type Widget,
  type AttachmentItem,
} from "@erp/ui-runtime";

function FileUploadInner({ runtime }: { runtime: UIRuntime }) {
  const [busy, setBusy] = useState(false);
  const canEdit = runtime.context.permissions.canEdit;
  const existing = runtime.context.attachments ?? [];
  const draftKey = "attachmentsJson";
  let draft: AttachmentItem[] = [];
  try {
    draft = JSON.parse(runtime.context.fieldValues[draftKey] || "[]") as AttachmentItem[];
  } catch {
    draft = [];
  }
  const all = [...existing, ...draft.filter((d) => !existing.some((e) => e.id === d.id))];

  async function onPick(files: FileList | null) {
    if (!files?.length || !canEdit) return;
    const upload = runtime.context.hostApis?.uploadFile;
    setBusy(true);
    try {
      const next = [...draft];
      for (const file of Array.from(files)) {
        if (upload) {
          const item = await upload(file);
          next.push(item);
          runtime.events.publish({ type: "AttachmentUploaded", payload: item });
        } else {
          const item: AttachmentItem = {
            id: `local-${Date.now()}-${file.name}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
          };
          next.push(item);
          runtime.toast.info?.("File recorded locally — host upload API not wired");
        }
      }
      runtime.context.setFieldValue(draftKey, JSON.stringify(next));
      runtime.toast.success("Attachment added");
    } catch (e) {
      runtime.toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-600">Attachments</p>
      {canEdit && (
        <input
          type="file"
          multiple
          disabled={busy}
          className="block w-full text-xs text-slate-600"
          onChange={(e) => void onPick(e.target.files)}
        />
      )}
      {busy && <p className="text-[11px] text-slate-400">Uploading…</p>}
      <ul className="space-y-1">
        {all.map((a) => (
          <li key={a.id} className="text-xs text-slate-700">
            {a.url ? (
              <a href={a.url} className="text-indigo-600 underline" target="_blank" rel="noreferrer">
                {a.name}
              </a>
            ) : (
              a.name
            )}
          </li>
        ))}
        {all.length === 0 && <li className="text-[11px] text-slate-400">No files yet</li>}
      </ul>
    </div>
  );
}

const FileUploadWidget: Widget = {
  render(runtime) {
    return <FileUploadInner key="FileUpload" runtime={runtime} />;
  },
  validate: () => ({ ok: true }),
  collectPayload(runtime) {
    try {
      const draft = JSON.parse(runtime.context.fieldValues.attachmentsJson || "[]");
      return { attachments: draft };
    } catch {
      return {};
    }
  },
};

const TimelineWidget: Widget = {
  render(runtime) {
    const events = runtime.context.timeline ?? [];
    return (
      <div className="space-y-2" key="Timeline">
        <p className="text-xs font-medium text-slate-600">Activity</p>
        {events.length === 0 ? (
          <p className="text-[11px] text-slate-400">No events yet</p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="text-xs">
                <span className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                <p className="font-medium text-slate-800">{ev.title}</p>
                <p className="text-slate-500">
                  {new Date(ev.at).toLocaleString()}
                  {ev.actor ? ` · ${ev.actor}` : ""}
                </p>
                {ev.remarks && <p className="text-slate-600 mt-0.5">{ev.remarks}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

function CommentsInner({ runtime }: { runtime: UIRuntime }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const comments = runtime.context.comments ?? [];
  const canEdit = runtime.context.permissions.canEdit;

  async function submit() {
    const body = draft.trim();
    if (!body || !canEdit) return;
    setBusy(true);
    try {
      await runtime.context.hostApis?.addComment?.(body);
      const local = runtime.context.fieldValues.commentDraft ?? "";
      runtime.context.setFieldValue(
        "commentsAppend",
        [local, body].filter(Boolean).join("\n")
      );
      setDraft("");
      runtime.toast.success("Comment added");
      runtime.events.publish({ type: "FieldChanged", payload: { key: "comments" } });
    } catch (e) {
      runtime.toast.error(e instanceof Error ? e.message : "Failed to add comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" key="Comments">
      <p className="text-xs font-medium text-slate-600">Comments</p>
      <ul className="max-h-40 space-y-2 overflow-y-auto">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
            <p className="text-slate-800">{c.body}</p>
            <p className="mt-0.5 text-slate-400">
              {c.author ?? "User"} · {new Date(c.at).toLocaleString()}
            </p>
          </li>
        ))}
        {comments.length === 0 && <li className="text-[11px] text-slate-400">No comments yet</li>}
      </ul>
      {canEdit && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Add a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            onClick={() => void submit()}
          >
            Post
          </button>
        </div>
      )}
    </div>
  );
}

const CommentsWidget: Widget = {
  render(runtime) {
    return <CommentsInner key="Comments" runtime={runtime} />;
  },
  validate: () => ({ ok: true }),
  collectPayload(runtime) {
    const append = runtime.context.fieldValues.commentsAppend;
    return append ? { commentsAppend: append } : {};
  },
};

const InventoryViewWidget: Widget = {
  render(runtime) {
    const rows =
      runtime.context.inventory ??
      (runtime.context.items ?? []).map((i) => ({
        productId: i.productId,
        productName: i.productName,
        orderedQty: i.quantity,
        availableQty: i.availableQty,
        shortageQty:
          i.availableQty != null ? Math.max(0, i.quantity - Number(i.availableQty)) : null,
        warehouseName: null as string | null,
      }));
    return (
      <div className="space-y-2" key="InventoryView">
        <p className="text-xs font-medium text-slate-600">Inventory</p>
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-medium">Product</th>
                <th className="px-2 py-1.5 font-medium">Ordered</th>
                <th className="px-2 py-1.5 font-medium">Available</th>
                <th className="px-2 py-1.5 font-medium">Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.productId ?? i} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{r.productName}</td>
                  <td className="px-2 py-1.5">{r.orderedQty}</td>
                  <td className="px-2 py-1.5">{r.availableQty ?? "—"}</td>
                  <td
                    className={`px-2 py-1.5 ${
                      (r.shortageQty ?? 0) > 0 ? "font-semibold text-amber-700" : "text-slate-500"
                    }`}
                  >
                    {r.shortageQty ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

const PriceSummaryWidget: Widget = {
  render(runtime) {
    const order = runtime.context.order ?? {};
    const items = runtime.context.items ?? [];
    const subtotal =
      Number(order.subtotal) ||
      items.reduce((s, i) => s + i.quantity * Number(i.unitPrice ?? 0), 0);
    const tax = Number(order.tax ?? 0);
    const discount = Number(order.discountAmount ?? order.couponDiscount ?? 0);
    const transport = Number(order.transportationCharge ?? 0);
    const additional = Number(order.additionalCharges ?? 0);
    const delivery = Number(order.deliveryFee ?? 0);
    const total =
      Number(order.total) || subtotal - discount + tax + transport + additional + delivery;
    const rows: [string, number][] = [
      ["Subtotal", subtotal],
      ["Discount", -discount],
      ["Tax", tax],
      ["Transport", transport],
      ["Additional", additional],
      ["Delivery", delivery],
    ];
    return (
      <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs" key="PriceSummary">
        <p className="font-medium text-slate-600 mb-2">Price summary</p>
        {rows.map(([label, val]) =>
          val === 0 && label !== "Subtotal" ? null : (
            <div key={label} className="flex justify-between text-slate-600">
              <span>{label}</span>
              <span>{val.toFixed(2)}</span>
            </div>
          )
        )}
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </div>
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

const StatusBannerWidget: Widget = {
  render(runtime) {
    const status = String(runtime.context.order?.status ?? "—");
    const step = runtime.context.task?.action ?? runtime.context.workflow?.variables?.currentStep;
    return (
      <div
        key="StatusBanner"
        className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900"
      >
        <span className="font-semibold uppercase tracking-wide">Status</span>
        <span className="ml-2 font-medium">{status}</span>
        {step ? <span className="ml-2 text-indigo-700/80">· Step: {String(step)}</span> : null}
      </div>
    );
  },
  validate: () => ({ ok: true }),
  collectPayload: () => ({}),
};

function PickerWidget(opts: {
  fieldKey: string;
  label: string;
  options: { id: string; label: string; meta?: string | null }[];
  runtime: UIRuntime;
  required?: boolean;
}) {
  const { fieldKey, label, options, runtime, required } = opts;
  const canEdit = runtime.context.permissions.canEdit;
  const value = runtime.context.fieldValues[fieldKey] ?? "";
  return (
    <label className="block text-xs text-slate-500">
      {label}
      {required ? " *" : ""}
      <select
        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
        disabled={!canEdit || options.length === 0}
        value={value}
        onChange={(e) => {
          runtime.context.setFieldValue(fieldKey, e.target.value);
          runtime.events.publish({
            type: "FieldChanged",
            payload: { key: fieldKey, value: e.target.value },
          });
        }}
      >
        <option value="">{options.length ? "Select…" : "No options loaded"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.meta ? ` (${o.meta})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

const WarehousePickerWidget: Widget = {
  render(runtime, props) {
    const fieldKey = (props.fieldKey as string) || "warehouseId";
    const options = runtime.context.lookups?.warehouses ?? [];
    return (
      <div key="WarehousePicker">
        <PickerWidget
          fieldKey={fieldKey}
          label={(props.label as string) || "Warehouse"}
          options={options}
          runtime={runtime}
          required={Boolean(props.required)}
        />
      </div>
    );
  },
  validate(runtime, props) {
    if (!props.required) return { ok: true };
    const fieldKey = (props.fieldKey as string) || "warehouseId";
    const v = runtime.context.fieldValues[fieldKey];
    if (!v) return { ok: false, errors: ["Warehouse is required"] };
    return { ok: true };
  },
  collectPayload(runtime, props) {
    const fieldKey = (props.fieldKey as string) || "warehouseId";
    const v = runtime.context.fieldValues[fieldKey];
    return v ? { [fieldKey]: v } : {};
  },
};

const DriverPickerWidget: Widget = {
  render(runtime, props) {
    const fieldKey = (props.fieldKey as string) || "assignedDriverId";
    const options = runtime.context.lookups?.drivers ?? [];
    return (
      <div key="DriverPicker">
        <PickerWidget
          fieldKey={fieldKey}
          label={(props.label as string) || "Driver"}
          options={options}
          runtime={runtime}
          required={Boolean(props.required)}
        />
      </div>
    );
  },
  validate(runtime, props) {
    if (!props.required) return { ok: true };
    const fieldKey = (props.fieldKey as string) || "assignedDriverId";
    const v = runtime.context.fieldValues[fieldKey];
    if (!v) return { ok: false, errors: ["Driver is required"] };
    return { ok: true };
  },
  collectPayload(runtime, props) {
    const fieldKey = (props.fieldKey as string) || "assignedDriverId";
    const v = runtime.context.fieldValues[fieldKey];
    return v ? { [fieldKey]: v } : {};
  },
};

let phase2Registered = false;

export function ensurePhase2WidgetsRegistered(): void {
  if (phase2Registered) return;
  phase2Registered = true;

  registerWidget({
    manifest: {
      id: "FileUpload",
      category: "Input",
      displayName: "File Upload",
      icon: "paperclip",
      supportsValidation: false,
      supportsPayload: true,
    },
    factory: () => FileUploadWidget,
  });
  registerWidget({
    manifest: {
      id: "Timeline",
      category: "Visualization",
      displayName: "Timeline",
      icon: "clock",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => TimelineWidget,
  });
  registerWidget({
    manifest: {
      id: "Comments",
      category: "Input",
      displayName: "Comments",
      icon: "message",
      supportsValidation: false,
      supportsPayload: true,
    },
    factory: () => CommentsWidget,
  });
  registerWidget({
    manifest: {
      id: "InventoryView",
      category: "Business",
      displayName: "Inventory View",
      icon: "boxes",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => InventoryViewWidget,
  });
  registerWidget({
    manifest: {
      id: "PriceSummary",
      category: "Business",
      displayName: "Price Summary",
      icon: "receipt",
      supportsValidation: false,
      supportsPayload: false,
    },
    factory: () => PriceSummaryWidget,
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
      id: "WarehousePicker",
      category: "Business",
      displayName: "Warehouse Picker",
      icon: "warehouse",
      supportsValidation: true,
      supportsPayload: true,
      defaultProps: { fieldKey: "warehouseId", required: false },
    },
    factory: () => WarehousePickerWidget,
  });
  registerWidget({
    manifest: {
      id: "DriverPicker",
      category: "Business",
      displayName: "Driver Picker",
      icon: "user",
      supportsValidation: true,
      supportsPayload: true,
      defaultProps: { fieldKey: "assignedDriverId", required: false },
    },
    factory: () => DriverPickerWidget,
  });
}
