import type { AttachmentItem, CommentItem, LineItemLike } from "@erp/ui-runtime";

export const SAMPLE_ORDER: Record<string, unknown> = {
  id: "sim-order-001",
  orderNumber: "SO-SIM-1001",
  status: "IN_PROGRESS",
  totalAmount: 2450,
  currency: "INR",
  deliveryDate: "2026-08-05",
  notes: "Sample order for form designer preview",
};

export const SAMPLE_ITEMS: LineItemLike[] = [
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

export const SAMPLE_LOOKUPS = {
  warehouses: [
    { id: "wh-main", label: "Main yard", meta: "Vizag" },
    { id: "wh-south", label: "South depot", meta: "Guntur" },
  ],
  drivers: [
    { id: "drv-1", label: "Ravi Kumar", meta: "AP 31 XX 1234" },
    { id: "drv-2", label: "Suresh Naidu", meta: "AP 16 YY 5678" },
  ],
};

export const SAMPLE_INVENTORY = SAMPLE_ITEMS.map((it) => ({
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

export const SAMPLE_TIMELINE = [
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

export const SAMPLE_COMMENTS: CommentItem[] = [
  {
    id: "c-1",
    body: "Customer asked for morning delivery.",
    author: "Sales desk",
    at: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

export type { AttachmentItem };
