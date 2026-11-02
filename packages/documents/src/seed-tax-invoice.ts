import type { DocumentDefinition, PlacedItem } from "./types";

/** Single accent — table header, title, thin rules. */
const ACCENT = "#173f5f";
const CARD_BG = "#f5f7fa";
const LINE_SOFT = "#dbe2ea";
const MUTED = "#64748b";

function field(
  id: string,
  path: string,
  x: number,
  y: number,
  width: number,
  opts?: Partial<PlacedItem>
): PlacedItem {
  const placement = {
    x,
    y,
    width,
    height: opts?.placement?.height ?? 14,
    ...(opts?.placement?.area != null ? { area: opts.placement.area } : {}),
    ...(opts?.placement?.align != null ? { align: opts.placement.align } : {}),
  };
  const binding = {
    path: opts?.binding?.path ?? path,
    ...(opts?.binding?.formatter != null ? { formatter: opts.binding.formatter } : {}),
    fallback: opts?.binding?.fallback ?? "",
  };
  return {
    ...opts,
    id,
    name: opts?.name ?? id,
    type: "Field",
    placement,
    binding,
    rotation: opts?.rotation ?? 0,
    locked: opts?.locked ?? false,
    visible: opts?.visible ?? true,
    zIndex: opts?.zIndex ?? 0,
    opacity: opts?.opacity ?? 1,
    ...(opts?.style != null ? { style: opts.style } : {}),
  };
}

function text(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  content: string,
  style?: PlacedItem["style"],
  height = 14
): PlacedItem {
  return {
    id,
    name: label,
    type: "Text",
    placement: { x, y, width, height },
    properties: { text: content },
    style,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

function box(id: string, x: number, y: number, width: number, height: number): PlacedItem {
  return {
    id,
    name: id,
    type: "Box",
    placement: { x, y, width, height },
    style: { background: CARD_BG, border: `1px solid ${LINE_SOFT}` },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

function widget(
  id: string,
  widgetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Record<string, unknown> = {}
): PlacedItem {
  return {
    id,
    name: id,
    type: "Widget",
    widgetId,
    widgetConfig: config,
    placement: { x, y, width, height },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

/**
 * Modern Indian B2B tax invoice — brand-first header, soft party cards,
 * accent table header, quiet totals, notes + words, declaration + signatory.
 * Commercial / BOS clones reuse this chrome (title swap only).
 */
export const TAX_INVOICE_SEED: DocumentDefinition = {
  id: "tax-invoice",
  key: "tax-invoice",
  name: "Tax Invoice",
  documentType: "INVOICE",
  page: {
    size: "A4",
    orientation: "portrait",
    margin: { top: 36, right: 40, bottom: 36, left: 40 },
  },
  items: [
    // ── Header ~90px ──────────────────────────────────────────────
    {
      id: "header",
      name: "Header",
      type: "Container",
      placement: { area: "header", x: 0, y: 0, width: 515, height: 90 },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      opacity: 1,
      children: [
        {
          id: "logo",
          name: "Logo",
          type: "Logo",
          placement: { x: 0, y: 0, width: 52, height: 52 },
          binding: { path: "seller.logoUrl", fallback: "" },
          rotation: 0,
          locked: false,
          visible: true,
          zIndex: 0,
          opacity: 1,
        },
        field("sellerNameHeader", "seller.name", 60, 2, 220, {
          name: "Seller name",
          style: { fontSize: 13, fontWeight: 700 },
          placement: { x: 60, y: 2, width: 220, height: 16 },
        }),
        field("sellerGstinHeader", "seller.gstinMeta", 60, 22, 220, {
          name: "Seller GSTIN meta",
          binding: { path: "seller.gstinMeta", fallback: "" },
          style: { fontSize: 9, color: MUTED },
          placement: { x: 60, y: 22, width: 220, height: 12 },
        }),
        field("sellerCityHeader", "seller.cityState", 60, 36, 220, {
          name: "Seller city",
          binding: { path: "seller.cityState", fallback: "" },
          style: { fontSize: 9, color: MUTED },
          placement: { x: 60, y: 36, width: 220, height: 12 },
        }),
        text("title", "Title", 300, 0, 215, "TAX INVOICE", {
          fontSize: 16,
          fontWeight: 700,
          color: ACCENT,
          textAlign: "right",
        }),
        field("invoiceNumber", "invoice.number", 300, 22, 215, {
          name: "Invoice Number",
          placement: { x: 300, y: 22, width: 215, height: 16, align: "right" },
          style: { textAlign: "right", fontSize: 13, fontWeight: 700 },
        }),
        field("invoiceDate", "invoice.date", 300, 42, 215, {
          name: "Invoice Date",
          placement: { x: 300, y: 42, width: 215, height: 12, align: "right" },
          binding: { path: "invoice.date", formatter: "date", fallback: "" },
          style: { textAlign: "right", fontSize: 10, color: MUTED },
        }),
        field("placeOfSupply", "invoice.placeOfSupplyLabel", 300, 56, 215, {
          name: "Place of Supply",
          placement: { x: 300, y: 56, width: 215, height: 12, align: "right" },
          binding: { path: "invoice.placeOfSupplyLabel", fallback: "" },
          style: { textAlign: "right", fontSize: 9, color: MUTED },
        }),
      ],
    },
    {
      id: "headerRule",
      name: "Header rule",
      type: "Line",
      placement: { x: 0, y: 92, width: 515, height: 1 },
      style: { background: ACCENT },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      opacity: 1,
    },

    // ── Parties ~110px ────────────────────────────────────────────
    box("sellerCard", 0, 104, 248, 100),
    box("buyerCard", 267, 104, 248, 100),
    {
      id: "seller",
      name: "Bill From",
      type: "Container",
      placement: { area: "body", x: 0, y: 104, width: 248, height: 100 },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 1,
      opacity: 1,
      children: [
        text("sellerLabel", "Bill From label", 10, 8, 228, "BILL FROM", {
          fontSize: 8,
          fontWeight: 700,
          color: MUTED,
        }),
        field("sellerName", "seller.name", 10, 24, 228, {
          name: "Seller Name",
          style: { fontSize: 11, fontWeight: 700 },
        }),
        field("sellerAddress", "seller.address", 10, 40, 228, {
          name: "Seller Address",
          style: { fontSize: 9, color: MUTED },
          placement: { x: 10, y: 40, width: 228, height: 24 },
        }),
        field("sellerGstin", "seller.gstinLine", 10, 66, 228, {
          name: "Seller GSTIN",
          binding: { path: "seller.gstinLine", fallback: "" },
          style: { fontSize: 9, color: MUTED },
        }),
        field("sellerState", "seller.stateLine", 10, 80, 228, {
          name: "Seller State",
          binding: { path: "seller.stateLine", fallback: "" },
          style: { fontSize: 9, color: MUTED },
        }),
      ],
    },
    {
      id: "buyer",
      name: "Bill To",
      type: "Container",
      placement: { area: "body", x: 267, y: 104, width: 248, height: 100 },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 1,
      opacity: 1,
      children: [
        text("buyerLabel", "Bill To label", 10, 8, 228, "BILL TO", {
          fontSize: 8,
          fontWeight: 700,
          color: MUTED,
        }),
        field("buyerName", "buyer.name", 10, 24, 228, {
          name: "Buyer Name",
          style: { fontSize: 11, fontWeight: 700 },
        }),
        field("buyerAddress", "buyer.address", 10, 40, 228, {
          name: "Buyer Address",
          style: { fontSize: 9, color: MUTED },
          placement: { x: 10, y: 40, width: 228, height: 24 },
        }),
        field("buyerGstin", "buyer.gstinLine", 10, 66, 228, {
          name: "Buyer GSTIN",
          binding: { path: "buyer.gstinLine", fallback: "" },
          style: { fontSize: 9, color: MUTED },
        }),
        field("buyerState", "buyer.stateLine", 10, 80, 228, {
          name: "Buyer State",
          binding: { path: "buyer.stateLine", fallback: "" },
          style: { fontSize: 9, color: MUTED },
        }),
      ],
    },

    // ── Lines (flexible) ──────────────────────────────────────────
    {
      id: "lines",
      name: "Line items",
      type: "Table",
      placement: { area: "body", x: 0, y: 220, width: 515, height: 72 },
      binding: { path: "lines" },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      opacity: 1,
      properties: {
        headerBackground: ACCENT,
        columns: [
          { key: "sku", label: "SKU", width: 64 },
          { key: "description", label: "Description", width: 176 },
          { key: "qty", label: "Qty", width: 40 },
          { key: "rate", label: "Rate", width: 72, formatter: "currency" },
          { key: "taxRate", label: "Tax", width: 48 },
          { key: "amount", label: "Amount", width: 95, formatter: "currency" },
        ],
      },
    },

    // ── Totals ~80px (right stack, no card) ───────────────────────
    {
      id: "totals",
      name: "Totals",
      type: "Container",
      placement: { area: "body", x: 300, y: 360, width: 215, height: 78 },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      opacity: 1,
      children: [
        text("subtotalLabel", "Subtotal label", 0, 4, 100, "Subtotal", {
          fontSize: 10,
          color: MUTED,
        }),
        field("subtotal", "totals.subtotal", 100, 4, 115, {
          name: "Subtotal",
          binding: { path: "totals.subtotal", formatter: "currency", fallback: "0" },
          style: { textAlign: "right", fontSize: 10 },
          placement: { x: 100, y: 4, width: 115, height: 14, align: "right" },
        }),
        text("taxLabel", "Tax label", 0, 22, 100, "Tax", { fontSize: 10, color: MUTED }),
        field("taxTotal", "totals.tax", 100, 22, 115, {
          name: "Tax",
          binding: { path: "totals.tax", formatter: "currency", fallback: "0" },
          style: { textAlign: "right", fontSize: 10 },
          placement: { x: 100, y: 22, width: 115, height: 14, align: "right" },
        }),
        {
          id: "totalsRule",
          name: "Totals rule",
          type: "Line",
          placement: { x: 0, y: 42, width: 215, height: 1 },
          style: { background: "#17212b" },
          rotation: 0,
          locked: false,
          visible: true,
          zIndex: 0,
          opacity: 1,
        },
        text("grandTotalLabel", "Total label", 0, 50, 100, "TOTAL", {
          fontSize: 12,
          fontWeight: 700,
        }),
        field("grandTotal", "totals.total", 100, 48, 115, {
          name: "Total",
          binding: { path: "totals.total", formatter: "currency", fallback: "0" },
          style: { textAlign: "right", fontWeight: 700, fontSize: 13 },
          placement: { x: 100, y: 48, width: 115, height: 16, align: "right" },
        }),
      ],
    },

    // ── Notes + UPI QR + amount in words ~70px ────────────────────
    box("notesCard", 0, 450, 216, 68),
    widget("payQr", "doc.qr", 224, 448, 72, 88, {
      path: "payment.upiUri",
      caption: "Pay by UPI",
    }),
    box("wordsCard", 312, 450, 203, 68),
    text("notesTitle", "Notes title", 10, 458, 196, "NOTES", {
      fontSize: 8,
      fontWeight: 700,
      color: MUTED,
    }),
    field("invoiceNotes", "invoice.notes", 10, 474, 196, {
      name: "Notes",
      binding: { path: "invoice.notes", fallback: "" },
      style: { fontSize: 9, color: MUTED },
      placement: { x: 10, y: 474, width: 196, height: 36 },
    }),
    text("wordsTitle", "Words title", 322, 458, 183, "AMOUNT IN WORDS", {
      fontSize: 8,
      fontWeight: 700,
      color: MUTED,
    }),
    field("amountInWords", "totals.total", 322, 474, 183, {
      name: "Amount in words",
      binding: { path: "totals.total", formatter: "words", fallback: "" },
      style: { fontSize: 9 },
      placement: { x: 322, y: 474, width: 183, height: 36 },
    }),

    // ── Footer ~60px ──────────────────────────────────────────────
    {
      id: "footer",
      name: "Footer",
      type: "Container",
      placement: { area: "footer", x: 0, y: 540, width: 515, height: 70 },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      opacity: 1,
      children: [
        {
          id: "footerRule",
          name: "Footer rule",
          type: "Line",
          placement: { x: 0, y: 0, width: 515, height: 1 },
          style: { background: LINE_SOFT },
          rotation: 0,
          locked: false,
          visible: true,
          zIndex: 0,
          opacity: 1,
        },
        {
          id: "declaration",
          name: "Declaration",
          type: "Text",
          placement: { x: 0, y: 10, width: 320, height: 40 },
          properties: {
            text: "Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
          },
          style: { fontSize: 8, color: MUTED },
          rotation: 0,
          locked: false,
          visible: true,
          zIndex: 0,
          opacity: 1,
        },
        field("signatoryFor", "seller.signatoryFor", 330, 18, 185, {
          name: "Signatory for",
          binding: { path: "seller.signatoryFor", fallback: "" },
          style: { textAlign: "right", fontSize: 9, fontWeight: 600 },
          placement: { x: 330, y: 18, width: 185, height: 14, align: "right" },
        }),
        text("signatoryLabel", "Signatory", 330, 36, 185, "Authorized Signatory", {
          fontSize: 9,
          color: MUTED,
          textAlign: "right",
        }),
      ],
    },
  ],
};
