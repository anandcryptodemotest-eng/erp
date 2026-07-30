"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FormDefinition } from "@erp/workflow";
import type {
  AttachmentItem,
  CommentItem,
  LineItemLike,
  ScreenDefinition,
} from "@erp/ui-runtime";
import { TaskScreenRuntime } from "./TaskScreenRuntime";

const SAMPLE_ORDER: Record<string, unknown> = {
  id: "sim-order-001",
  orderNumber: "SO-SIM-1001",
  status: "IN_PROGRESS",
  totalAmount: 2450,
  currency: "INR",
  deliveryDate: "2026-08-05",
  notes: "Sample order for form designer preview",
};

const SAMPLE_ITEMS: LineItemLike[] = [
  {
    id: "line-1",
    productId: "prod-teak",
    productName: "Teak plank 8ft",
    quantity: 12,
    unitPrice: 120,
    availableQty: 40,
  },
  {
    id: "line-2",
    productId: "prod-ply",
    productName: "Plywood 18mm",
    quantity: 6,
    unitPrice: 85,
    availableQty: 4,
  },
];

const SAMPLE_LOOKUPS = {
  warehouses: [
    { id: "wh-main", label: "Main yard", meta: "Vizag" },
    { id: "wh-south", label: "South depot", meta: "Guntur" },
  ],
  drivers: [
    { id: "drv-1", label: "Ravi Kumar", meta: "AP 31 XX 1234" },
    { id: "drv-2", label: "Suresh Naidu", meta: "AP 16 YY 5678" },
  ],
};

const SAMPLE_INVENTORY = SAMPLE_ITEMS.map((it) => ({
  productId: it.productId,
  productName: it.productName,
  orderedQty: it.quantity,
  availableQty: it.availableQty ?? null,
  shortageQty:
    it.availableQty != null && it.availableQty < it.quantity
      ? it.quantity - Number(it.availableQty)
      : 0,
  warehouseName: "Main yard",
}));

const SAMPLE_TIMELINE = [
  {
    id: "ev-1",
    type: "CREATED",
    title: "Sales request converted",
    at: new Date(Date.now() - 86_400_000).toISOString(),
    actor: "Sales",
    remarks: "Simulation event",
  },
  {
    id: "ev-2",
    type: "TASK",
    title: "Awaiting this step",
    at: new Date().toISOString(),
    actor: "You",
    remarks: null,
  },
];

/**
 * Interactive task-UI simulation for Form Designer.
 * Uses sample host context so widgets render like OMS after publish.
 */
export function FormTaskSimulator(props: {
  screen: FormDefinition;
  viewport?: "desktop" | "mobile";
}): ReactNode {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState<LineItemLike[]>(SAMPLE_ITEMS);
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: "c-1",
      body: "Customer asked for morning delivery.",
      author: "Sales desk",
      at: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">(props.viewport ?? "desktop");

  const screen = useMemo(() => props.screen as ScreenDefinition, [props.screen]);

  function setFieldValue(key: string, value: string, itemId?: string) {
    const bagKey = itemId ? `${itemId}:${key}` : key;
    setFieldValues((prev) => ({ ...prev, [bagKey]: value }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Task UI simulation
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-[10px]">
          {(["desktop", "mobile"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              className={`rounded-md px-2 py-1 capitalize ${
                viewport === v ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Sample order, inventory, drivers, and timeline — same widgets as the live task screen.
        Complete is local only (does not write to the database).
      </p>
      <div
        className={`mx-auto transition-[max-width] ${
          viewport === "mobile" ? "max-w-[390px]" : "max-w-none"
        }`}
      >
        <TaskScreenRuntime
          screen={screen}
          order={SAMPLE_ORDER}
          customer={{ id: "cust-sim", name: "Acme Builders (sample)" }}
          items={items}
          taskAction="SIMULATE"
          canComplete
          fieldValues={fieldValues}
          setFieldValue={setFieldValue}
          lookups={SAMPLE_LOOKUPS}
          inventory={SAMPLE_INVENTORY}
          timeline={SAMPLE_TIMELINE}
          comments={comments}
          attachments={attachments}
          hostApis={{
            uploadFile: async (file) => {
              const att: AttachmentItem = {
                id: `att-${Date.now()}`,
                name: file.name,
                mimeType: file.type,
                size: file.size,
              };
              setAttachments((prev) => [...prev, att]);
              return att;
            },
            addComment: (body) => {
              setComments((prev) => [
                ...prev,
                {
                  id: `c-${Date.now()}`,
                  body,
                  author: "Designer",
                  at: new Date().toISOString(),
                },
              ]);
            },
          }}
          lineEditor={{
            canAdd: true,
            canRemove: true,
            canEditPrice: true,
            searchProducts: async (q) => {
              const catalog = [
                { id: "prod-oak", name: "Oak beam", sku: "OAK-01", sellPrice: 200 },
                { id: "prod-nail", name: "Nail box 2kg", sku: "NL-2", sellPrice: 45 },
                { id: "prod-teak", name: "Teak plank 8ft", sku: "TK-8", sellPrice: 120 },
              ];
              const qq = q.trim().toLowerCase();
              return catalog.filter(
                (p) => !qq || p.name.toLowerCase().includes(qq) || (p.sku ?? "").toLowerCase().includes(qq)
              );
            },
            addProduct: (p) => {
              setItems((prev) => [
                ...prev,
                {
                  id: `line-${Date.now()}`,
                  productId: p.id,
                  productName: p.name,
                  quantity: 1,
                  unitPrice: p.sellPrice ?? 0,
                  availableQty: 20,
                },
              ]);
            },
            removeLine: (lineId) => {
              setItems((prev) => prev.filter((l) => l.id !== lineId));
            },
          }}
          onComplete={(payload) => setLastPayload(payload)}
        />
      </div>
      {lastPayload && (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Last complete payload (simulation)
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
