import type { DocumentDefinition, DocumentPlacement, DocumentStyle, PlacedItem } from "./types";

export type PrintWidgetId = "doc.logo" | "doc.seller" | "doc.buyer" | "doc.lineItems" | "doc.totals";

export type PrintWidgetSlot = { path: string; label: string };

export type PrintWidgetCatalogEntry = {
  id: PrintWidgetId;
  label: string;
  slots: PrintWidgetSlot[];
  defaultPlacement: { width: number; height: number };
};

const LINE_COLUMNS: { key: string; label: string; width: number; formatter?: string }[] = [
  { key: "sku", label: "SKU", width: 70 },
  { key: "description", label: "Description", width: 180 },
  { key: "qty", label: "Qty", width: 40 },
  { key: "rate", label: "Rate", width: 70, formatter: "currency" },
  { key: "tax", label: "Tax", width: 55, formatter: "currency" },
  { key: "amount", label: "Amount", width: 80, formatter: "currency" },
];

export const PRINT_WIDGET_CATALOG: PrintWidgetCatalogEntry[] = [
  {
    id: "doc.logo",
    label: "Logo",
    slots: [{ path: "seller.logoUrl", label: "Logo URL" }],
    defaultPlacement: { width: 120, height: 48 },
  },
  {
    id: "doc.seller",
    label: "Seller",
    slots: [
      { path: "seller.name", label: "Name" },
      { path: "seller.address", label: "Address" },
      { path: "seller.gstin", label: "GSTIN" },
    ],
    defaultPlacement: { width: 250, height: 90 },
  },
  {
    id: "doc.buyer",
    label: "Buyer",
    slots: [
      { path: "buyer.name", label: "Name" },
      { path: "buyer.address", label: "Address" },
      { path: "buyer.gstin", label: "GSTIN" },
    ],
    defaultPlacement: { width: 250, height: 90 },
  },
  {
    id: "doc.lineItems",
    label: "Line items",
    slots: [{ path: "lines", label: "Line items (table)" }],
    defaultPlacement: { width: 515, height: 80 },
  },
  {
    id: "doc.totals",
    label: "Totals",
    slots: [
      { path: "totals.subtotal", label: "Subtotal" },
      { path: "totals.tax", label: "GST" },
      { path: "totals.total", label: "Grand Total" },
    ],
    defaultPlacement: { width: 215, height: 80 },
  },
];

const BY_ID = new Map(PRINT_WIDGET_CATALOG.map((w) => [w.id, w]));

export function isPrintWidgetId(id: string | undefined): id is PrintWidgetId {
  return Boolean(id && BY_ID.has(id as PrintWidgetId));
}

export function printWidgetById(id: string | undefined): PrintWidgetCatalogEntry | undefined {
  if (!id) return undefined;
  return BY_ID.get(id as PrintWidgetId);
}

function baseItem(
  id: string,
  type: PlacedItem["type"],
  placement: DocumentPlacement,
  extra?: Partial<PlacedItem>
): PlacedItem {
  return {
    id,
    type,
    placement,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
    ...extra,
  };
}

function stretchX(x: number, width: number, catalogW: number, destW: number): { x: number; width: number } {
  const sx = catalogW > 0 ? destW / catalogW : 1;
  return { x: x * sx, width: width * sx };
}

function textChild(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  catalogW: number,
  destW: number,
  content: string,
  style?: DocumentStyle
): PlacedItem {
  const s = stretchX(x, width, catalogW, destW);
  return baseItem(id, "Text", { x: s.x, y, width: s.width, height: 16 }, {
    name,
    properties: { text: content },
    style,
  });
}

function fieldChild(
  id: string,
  name: string,
  path: string,
  x: number,
  y: number,
  width: number,
  catalogW: number,
  destW: number,
  opts?: { formatter?: string; style?: DocumentStyle }
): PlacedItem {
  const s = stretchX(x, width, catalogW, destW);
  return baseItem(id, "Field", { x: s.x, y, width: s.width, height: 16 }, {
    name,
    binding: { path, formatter: opts?.formatter, fallback: "" },
    style: opts?.style,
  });
}

function expandOne(item: PlacedItem): PlacedItem {
  const widgetId = item.widgetId ?? "";
  const entry = printWidgetById(widgetId);
  const destW = item.placement.width ?? entry?.defaultPlacement.width ?? 120;
  const destH = item.placement.height ?? entry?.defaultPlacement.height ?? 48;
  const placement: DocumentPlacement = { ...item.placement, width: destW, height: destH };
  const catalogW = entry?.defaultPlacement.width ?? destW;

  if (widgetId === "doc.logo") {
    return baseItem(item.id, "Logo", placement, {
      name: item.name ?? "Logo",
      binding: { path: "seller.logoUrl", fallback: "" },
    });
  }

  if (widgetId === "doc.seller") {
    return baseItem(item.id, "Container", placement, {
      name: item.name ?? "Seller",
      children: [
        textChild(`${item.id}__label`, "Seller label", 0, 0, 250, catalogW, destW, "Seller", {
          fontWeight: 700,
          fontSize: 10,
        }),
        fieldChild(`${item.id}__name`, "Seller Name", "seller.name", 0, 18, 250, catalogW, destW),
        fieldChild(`${item.id}__address`, "Seller Address", "seller.address", 0, 36, 250, catalogW, destW),
        fieldChild(`${item.id}__gstin`, "Seller GSTIN", "seller.gstin", 0, 54, 250, catalogW, destW),
      ],
    });
  }

  if (widgetId === "doc.buyer") {
    return baseItem(item.id, "Container", placement, {
      name: item.name ?? "Buyer",
      children: [
        textChild(`${item.id}__label`, "Buyer label", 0, 0, 250, catalogW, destW, "Bill to", {
          fontWeight: 700,
          fontSize: 10,
        }),
        fieldChild(`${item.id}__name`, "Buyer Name", "buyer.name", 0, 18, 250, catalogW, destW),
        fieldChild(`${item.id}__address`, "Buyer Address", "buyer.address", 0, 36, 250, catalogW, destW),
        fieldChild(`${item.id}__gstin`, "Buyer GSTIN", "buyer.gstin", 0, 54, 250, catalogW, destW),
      ],
    });
  }

  if (widgetId === "doc.lineItems") {
    const sx = catalogW > 0 ? destW / catalogW : 1;
    return baseItem(item.id, "Table", placement, {
      name: item.name ?? "Line items",
      binding: { path: "lines" },
      properties: {
        columns: LINE_COLUMNS.map((c) => ({ ...c, width: Math.round(c.width * sx) })),
      },
    });
  }

  if (widgetId === "doc.totals") {
    return baseItem(item.id, "Container", placement, {
      name: item.name ?? "Totals",
      children: [
        textChild(`${item.id}__subtotalLbl`, "Subtotal label", 0, 0, 90, catalogW, destW, "Subtotal", {
          fontSize: 10,
        }),
        fieldChild(`${item.id}__subtotal`, "Subtotal", "totals.subtotal", 90, 0, 125, catalogW, destW, {
          formatter: "currency",
          style: { textAlign: "right" },
        }),
        textChild(`${item.id}__taxLbl`, "Tax label", 0, 22, 90, catalogW, destW, "GST", { fontSize: 10 }),
        fieldChild(`${item.id}__tax`, "Tax", "totals.tax", 90, 22, 125, catalogW, destW, {
          formatter: "currency",
          style: { textAlign: "right" },
        }),
        textChild(`${item.id}__totalLbl`, "Grand total label", 0, 46, 90, catalogW, destW, "Grand Total", {
          fontSize: 11,
          fontWeight: 700,
        }),
        fieldChild(`${item.id}__total`, "Grand Total", "totals.total", 90, 46, 125, catalogW, destW, {
          formatter: "currency",
          style: { textAlign: "right", fontWeight: 700, fontSize: 12 },
        }),
      ],
    });
  }

  return baseItem(item.id, "Box", placement, { name: item.name ?? "Unknown widget" });
}

/** Replace Widget refs with primitives. Does not mutate `items`. */
export function expandWidgets(items: PlacedItem[]): PlacedItem[] {
  return items.map((item) => {
    if (item.type === "Widget") return expandOne(item);
    if (item.children?.length) {
      return { ...item, children: expandWidgets(item.children) };
    }
    return item;
  });
}

export function expandDocumentDefinition(definition: DocumentDefinition): DocumentDefinition {
  return {
    ...definition,
    items: expandWidgets(definition.items),
    layers: definition.layers?.map((layer) => ({ ...layer, items: expandWidgets(layer.items) })),
  };
}
