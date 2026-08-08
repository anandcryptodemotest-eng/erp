"use client";

/**
 * Phase 2 OMS widgets (ADR 0009 Platform v1.1 UI Composition).
 * Widgets only use UIRuntime / UIContext — never REST.
 */

import { useEffect, useMemo, useState } from "react";
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
    <div className="space-y-2 rounded-lg border border-dashed border-[var(--line)] p-3">
      <p className="text-xs font-medium text-[var(--ink-soft)]">Attachments</p>
      {canEdit && (
        <input
          type="file"
          multiple
          disabled={busy}
          className="block w-full text-xs text-[var(--ink-soft)]"
          onChange={(e) => void onPick(e.target.files)}
        />
      )}
      {busy && <p className="text-[11px] text-[var(--ink-soft)]">Uploading…</p>}
      <ul className="space-y-1">
        {all.map((a) => (
          <li key={a.id} className="text-xs text-[var(--ink-soft)]">
            {a.url ? (
              <a href={a.url} className="text-[var(--brand)] underline" target="_blank" rel="noreferrer">
                {a.name}
              </a>
            ) : (
              a.name
            )}
          </li>
        ))}
        {all.length === 0 && <li className="text-[11px] text-[var(--ink-soft)]">No files yet</li>}
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
        <p className="text-xs font-medium text-[var(--ink-soft)]">Activity</p>
        {events.length === 0 ? (
          <p className="text-[11px] text-[var(--ink-soft)]">No events yet</p>
        ) : (
          <ol className="relative space-y-3 border-l border-[var(--line)] pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="text-xs">
                <span className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                <p className="font-medium text-[var(--ink)]">{ev.title}</p>
                <p className="text-[var(--ink-soft)]">
                  {new Date(ev.at).toLocaleString()}
                  {ev.actor ? ` · ${ev.actor}` : ""}
                </p>
                {ev.remarks && <p className="text-[var(--ink-soft)] mt-0.5">{ev.remarks}</p>}
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
      <p className="text-xs font-medium text-[var(--ink-soft)]">Comments</p>
      <ul className="max-h-40 space-y-2 overflow-y-auto">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-[var(--line)] bg-[var(--mist)]/80 p-2 text-xs">
            <p className="text-[var(--ink)]">{c.body}</p>
            <p className="mt-0.5 text-[var(--ink-soft)]">
              {c.author ?? "User"} · {new Date(c.at).toLocaleString()}
            </p>
          </li>
        ))}
        {comments.length === 0 && <li className="text-[11px] text-[var(--ink-soft)]">No comments yet</li>}
      </ul>
      {canEdit && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-[var(--line)] px-2 py-1.5 text-sm"
            placeholder="Add a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
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
        <p className="text-xs font-medium text-[var(--ink-soft)]">Inventory</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--mist)] text-[var(--ink-soft)]">
              <tr>
                <th className="px-2 py-1.5 font-medium">Product</th>
                <th className="px-2 py-1.5 font-medium">Ordered</th>
                <th className="px-2 py-1.5 font-medium">Available</th>
                <th className="px-2 py-1.5 font-medium">Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.productId ?? i} className="border-t border-[var(--line)]">
                  <td className="px-2 py-1.5 text-[var(--ink)]">{r.productName}</td>
                  <td className="px-2 py-1.5">{r.orderedQty}</td>
                  <td className="px-2 py-1.5">{r.availableQty ?? "—"}</td>
                  <td
                    className={`px-2 py-1.5 ${
                      (r.shortageQty ?? 0) > 0 ? "font-semibold text-amber-700" : "text-[var(--ink-soft)]"
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
      <div className="space-y-1 rounded-lg border border-[var(--line)] bg-[var(--mist)]/50 p-3 text-xs" key="PriceSummary">
        <p className="font-medium text-[var(--ink-soft)] mb-2">Price summary</p>
        {rows.map(([label, val]) =>
          val === 0 && label !== "Subtotal" ? null : (
            <div key={label} className="flex justify-between text-[var(--ink-soft)]">
              <span>{label}</span>
              <span>{val.toFixed(2)}</span>
            </div>
          )
        )}
        <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 font-semibold text-[var(--ink)]">
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
        className="rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-xs text-[var(--brand)]"
      >
        <span className="font-semibold uppercase tracking-wide">Status</span>
        <span className="ml-2 font-medium">{status}</span>
        {step ? <span className="ml-2 text-[var(--brand)]/80">· Step: {String(step)}</span> : null}
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
    <label className="block text-xs text-[var(--ink-soft)]">
      {label}
      {required ? " *" : ""}
      <select
        className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
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

function resolveInvoicePdf(runtime: UIRuntime, localPdfUrl: string | null): {
  pdfUrl: string | null;
  invoiceId?: string;
  invoiceNumber?: string;
} {
  const fv = runtime.context.fieldValues;
  const doc = runtime.context.documents?.invoice;
  if (localPdfUrl) {
    return {
      pdfUrl: localPdfUrl,
      invoiceId: fv.invoiceId || doc?.id,
      invoiceNumber: fv.invoiceNumber || doc?.number,
    };
  }
  if (typeof fv.invoicePdfUrl === "string" && fv.invoicePdfUrl) {
    return {
      pdfUrl: fv.invoicePdfUrl,
      invoiceId: fv.invoiceId || doc?.id,
      invoiceNumber: fv.invoiceNumber || doc?.number,
    };
  }
  if (doc?.pdfUrl) {
    return { pdfUrl: doc.pdfUrl, invoiceId: doc.id, invoiceNumber: doc.number };
  }
  const id = fv.invoiceId || doc?.id;
  if (id) {
    return {
      pdfUrl: `/api/invoices/${id}/pdf`,
      invoiceId: id,
      invoiceNumber: fv.invoiceNumber || doc?.number,
    };
  }
  return { pdfUrl: null };
}

function DocumentGenerateInner({
  runtime,
  props,
}: {
  runtime: UIRuntime;
  props: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);

  const documentType = String(props.documentType ?? "INVOICE");
  const command = String(props.command ?? "accounting.generateInvoice");
  const payloadBuilder = String(props.payloadBuilder ?? "accounting.invoice");
  const documentRef = (props.documentRef as { type: string; id: string; version: number }) ?? {
    type: "DOCUMENT",
    id: "tax-invoice",
    version: 1,
  };
  const payloadOverrides = props.payloadOverrides as
    | { fieldKey: string; path: string }[]
    | undefined;
  const canComplete = runtime.context.permissions.canComplete;

  const resolved = useMemo(
    () => resolveInvoicePdf(runtime, localPdfUrl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fieldValues/documents are mutated by host
    [
      localPdfUrl,
      runtime.context.fieldValues.invoicePdfUrl,
      runtime.context.fieldValues.invoiceId,
      runtime.context.documents?.invoice?.pdfUrl,
      runtime.context.documents?.invoice?.id,
    ]
  );

  useEffect(() => {
    setLocalPdfUrl(null);
  }, [runtime.context.entity.id]);

  const phase: "none" | "generating" | "available" = busy
    ? "generating"
    : resolved.pdfUrl
      ? "available"
      : "none";

  async function onGenerate(force: boolean) {
    const invoke = runtime.context.hostApis?.invokeDomainCommand;
    if (!invoke) {
      setStatus("Host command bridge not wired — complete the step to generate.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await invoke({
        command,
        documentType,
        documentRef,
        payloadBuilder,
        payloadOverrides,
        force,
      });
      if (!res.ok) {
        setStatus(res.error ?? "Generate failed");
        runtime.toast.error(res.error ?? "Generate failed");
        return;
      }
      if (res.pdfUrl) {
        setLocalPdfUrl(res.pdfUrl);
        runtime.context.setFieldValue("invoicePdfUrl", res.pdfUrl);
      }
      if (res.invoiceNumber) {
        runtime.context.setFieldValue("invoiceNumber", res.invoiceNumber);
      }
      if (res.invoiceId) {
        runtime.context.setFieldValue("invoiceId", res.invoiceId);
      }
      setStatus(`Generated ${res.invoiceNumber ?? "invoice"}`);
      runtime.toast.success(`Invoice ${res.invoiceNumber ?? ""} ready`);
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    const url = resolved.pdfUrl;
    if (!url) return;
    const open = runtime.context.hostApis?.openDocument;
    if (open) {
      void open(url, `${resolved.invoiceNumber ?? "invoice"}.pdf`).catch((e) =>
        runtime.toast.error(e instanceof Error ? e.message : "Could not open PDF")
      );
    } else {
      runtime.toast.error("Download requires host openDocument bridge");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" key="DocumentGenerate">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        {documentType === "INVOICE" ? "Invoice" : "Document"}
      </p>
      <p className="text-xs text-[var(--ink-soft)]">
        Template{" "}
        <code className="rounded bg-white px-1">
          {documentRef.type}:{documentRef.id}@v{documentRef.version}
        </code>
        {payloadBuilder ? (
          <>
            {" "}
            · builder <code className="rounded bg-white px-1">{payloadBuilder}</code>
          </>
        ) : null}
      </p>
      {phase === "none" && (
        <p className="text-[11px] text-[var(--ink-soft)]">No invoice PDF yet for this order.</p>
      )}
      {status && <p className="text-xs text-emerald-900">{status}</p>}
      {phase === "available" && resolved.invoiceNumber && (
        <p className="text-xs text-emerald-900">{resolved.invoiceNumber}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {phase === "available" && (
          <button
            type="button"
            className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
            onClick={onDownload}
          >
            Download PDF
          </button>
        )}
        {canComplete && phase === "none" && (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            onClick={() => void onGenerate(false)}
          >
            Generate invoice PDF
          </button>
        )}
        {canComplete && phase === "generating" && (
          <button
            type="button"
            disabled
            className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white opacity-50"
          >
            Generating…
          </button>
        )}
        {canComplete && phase === "available" && (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            onClick={() => void onGenerate(true)}
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

const DocumentGenerateWidget: Widget = {
  render(runtime, props) {
    return <DocumentGenerateInner runtime={runtime} props={props} />;
  },
  validate: () => ({ ok: true }),
  collectPayload(_runtime, props) {
    const documentRef = (props.documentRef as { type: string; id: string; version: number }) ?? {
      type: "DOCUMENT",
      id: "tax-invoice",
      version: 1,
    };
    return {
      documentRef,
      documentType: props.documentType ?? "INVOICE",
      command: props.command ?? "accounting.generateInvoice",
      payloadBuilder: props.payloadBuilder ?? "accounting.invoice",
      payloadOverrides: props.payloadOverrides,
    };
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
  registerWidget({
    manifest: {
      id: "DocumentGenerate",
      category: "Business",
      displayName: "Document Generate",
      icon: "file",
      supportsValidation: false,
      supportsPayload: true,
      defaultProps: {
        documentType: "INVOICE",
        command: "accounting.generateInvoice",
        payloadBuilder: "accounting.invoice",
        documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
      },
    },
    factory: () => DocumentGenerateWidget,
  });
  registerWidget({
    manifest: {
      id: "InvoiceGenerate",
      category: "Business",
      displayName: "Invoice Generate",
      icon: "file-text",
      supportsValidation: false,
      supportsPayload: true,
      defaultProps: {
        documentType: "INVOICE",
        command: "accounting.generateInvoice",
        payloadBuilder: "accounting.invoice",
        documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
      },
    },
    factory: () => DocumentGenerateWidget,
  });
}
