import type { FormDefinition, WorkflowDefinition } from "../types/definition";
import { withFormId } from "../metadata/asset-ref";

/**
 * Starter revision 1 — frozen snapshot of pre–BL-032 layouts (hash eligibility).
 * Do not edit; add new layouts to SO_STANDARD_FORMS (latest) instead.
 */
export const SO_STANDARD_FORMS_REV1: FormDefinition[] = [
  withFormId({
    key: "sales_review_form",
    id: "sales-review",
    title: "Sales review",
    description: "Add or remove products, confirm qty.",
    themeId: "oms-default",
    confirmLabel: "Complete this step →",
    layout: [
      { widget: "FormFields", props: {} },
      { widget: "ProductList", props: { editable: true, showPrice: true, allowAdd: true, allowRemove: true } },
      { widget: "CatalogSearch", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "remarks", label: "Remarks", type: "text", scope: "order" },
      { key: "deliveryDate", label: "Delivery date", type: "text", scope: "order" },
    ],
  }),
  withFormId({
    key: "inventory_form",
    id: "inventory",
    title: "Verify inventory",
    description: "Enter available qty. Shortage unlocks procurement.",
    themeId: "oms-default",
    layout: [
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "availableQty",
        label: "Available qty",
        type: "number",
        scope: "per-item",
        source: "quantity",
        required: true,
      },
    ],
  }),
  withFormId({
    key: "procurement_form",
    id: "procurement",
    title: "Procurement",
    theme: "amber",
    themeId: "oms-attention",
    description: "Raise vendor request for missing quantity.",
    confirmLabel: "Send to vendor →",
    layout: [
      { widget: "ProductList", props: { editable: false } },
      { widget: "ActionButtons", props: { label: "Send to vendor →" } },
    ],
  }),
  withFormId({
    key: "pricing_form",
    id: "pricing",
    title: "Pricing",
    themeId: "oms-default",
    layout: [
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "purchasePrice", label: "Purchase price", type: "number", scope: "per-item", required: true },
      {
        key: "unitPrice",
        label: "Sell price",
        type: "readonly",
        scope: "per-item",
        source: "unitPrice",
      },
    ],
  }),
  withFormId({
    key: "warehouse_form",
    id: "warehouse",
    title: "Warehouse pick & pack",
    description: "Confirm items are picked and packed.",
    themeId: "oms-default",
    layout: [
      { widget: "ProductList", props: { editable: false } },
      { widget: "ActionButtons", props: {} },
    ],
  }),
  withFormId({
    key: "dispatch_form",
    id: "dispatch",
    title: "Dispatch",
    description: "Own fleet or book Porter. Opening Porter does not dispatch the order.",
    themeId: "oms-default",
    layout: [
      { widget: "DispatchFulfillment", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "fulfillmentMode",
        label: "Fulfillment",
        type: "select",
        scope: "order",
        options: [
          { value: "own_fleet", label: "Own fleet" },
          { value: "porter", label: "Porter" },
        ],
      },
      { key: "vehicleInfo", label: "Vehicle no.", type: "text", scope: "order" },
      { key: "assignedDriverId", label: "Driver name / ID", type: "text", scope: "order" },
      { key: "porterBookingStatus", label: "Porter booking", type: "text", scope: "order" },
      { key: "trackingNumber", label: "Tracking / booking ID", type: "text", scope: "order" },
      { key: "trackingUrl", label: "Tracking URL", type: "url", scope: "order" },
    ],
  }),
  withFormId({
    key: "delivery_form",
    id: "delivery",
    title: "Delivery confirmation",
    description: "Confirm delivery to customer.",
    themeId: "oms-default",
    layout: [
      { widget: "ProductList", props: { editable: false } },
      { widget: "ActionButtons", props: {} },
    ],
  }),
  withFormId({
    key: "invoice_form",
    id: "invoice",
    title: "Invoice",
    themeId: "oms-default",
    layout: [
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      {
        widget: "InvoiceGenerate",
        props: {
          documentType: "INVOICE",
          command: "accounting.generateInvoice",
          documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
        },
      },
      { widget: "ActionButtons", props: { label: "Confirm & complete →" } },
    ],
  }),
  withFormId({
    key: "payment_form",
    id: "payment",
    title: "Collect payment",
    themeId: "oms-default",
    layout: [
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "ActionButtons", props: {} },
    ],
  }),
];

/**
 * Starter revision 2 — BL-032 layouts (frozen for upgrade hashes).
 * Do not edit; add new layouts to SO_STANDARD_FORMS (latest) instead.
 */
export const SO_STANDARD_FORMS_REV2: FormDefinition[] = [
  withFormId({
    key: "sales_review_form",
    id: "sales-review",
    title: "Sales review",
    description: "Add or remove products, confirm qty.",
    themeId: "oms-default",
    confirmLabel: "Complete this step →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "ProductList", props: { editable: true, showPrice: true, allowAdd: true, allowRemove: true } },
      { widget: "CatalogSearch", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "remarks", label: "Remarks", type: "text", scope: "order" },
      { key: "deliveryDate", label: "Delivery date", type: "date", scope: "order" },
    ],
  }),
  withFormId({
    key: "inventory_form",
    id: "inventory",
    title: "Verify inventory",
    description: "Enter available qty. Shortage unlocks procurement.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "InventoryView", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "availableQty",
        label: "Available qty",
        type: "number",
        scope: "per-item",
        source: "quantity",
        required: true,
      },
    ],
  }),
  withFormId({
    key: "procurement_form",
    id: "procurement",
    title: "Procurement",
    theme: "amber",
    themeId: "oms-attention",
    description: "Raise vendor request for missing quantity.",
    confirmLabel: "Send to vendor →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "Comments", props: {} },
      { widget: "ActionButtons", props: { label: "Send to vendor →" } },
    ],
  }),
  withFormId({
    key: "pricing_form",
    id: "pricing",
    title: "Pricing",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "FormFields", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "purchasePrice", label: "Purchase price", type: "number", scope: "per-item", required: true },
      {
        key: "unitPrice",
        label: "Sell price",
        type: "readonly",
        scope: "per-item",
        source: "unitPrice",
      },
    ],
  }),
  withFormId({
    key: "warehouse_form",
    id: "warehouse",
    title: "Warehouse pick & pack",
    description: "Confirm items are picked and packed.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "WarehousePicker", props: { fieldKey: "warehouseId", required: false } },
      { widget: "ProductList", props: { editable: false } },
      { widget: "InventoryView", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "warehouseId", label: "Warehouse", type: "text", scope: "order" },
    ],
  }),
  withFormId({
    key: "dispatch_form",
    id: "dispatch",
    title: "Dispatch",
    description: "Own fleet or book Porter. Opening Porter does not dispatch the order.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "DispatchFulfillment", props: {} },
      { widget: "DriverPicker", props: { fieldKey: "assignedDriverId", required: false } },
      {
        widget: "ExternalLink",
        props: {
          label: "Open carrier booking",
          urlFromVariable: "porterBookUrl",
          openInNewTab: true,
        },
      },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "fulfillmentMode",
        label: "Fulfillment",
        type: "select",
        scope: "order",
        options: [
          { value: "own_fleet", label: "Own fleet" },
          { value: "porter", label: "Porter" },
        ],
      },
      { key: "vehicleInfo", label: "Vehicle no.", type: "text", scope: "order" },
      { key: "assignedDriverId", label: "Driver name / ID", type: "text", scope: "order" },
      { key: "porterBookingStatus", label: "Porter booking", type: "text", scope: "order" },
      { key: "trackingNumber", label: "Tracking / booking ID", type: "text", scope: "order" },
      { key: "trackingUrl", label: "Tracking URL", type: "url", scope: "order" },
    ],
  }),
  withFormId({
    key: "delivery_form",
    id: "delivery",
    title: "Delivery confirmation",
    description: "Confirm delivery to customer.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "FileUpload", props: {} },
      { widget: "Comments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
  }),
  withFormId({
    key: "invoice_form",
    id: "invoice",
    title: "Invoice",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      {
        widget: "InvoiceGenerate",
        props: {
          documentType: "INVOICE",
          command: "accounting.generateInvoice",
          documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
        },
      },
      { widget: "ActionButtons", props: { label: "Confirm & complete →" } },
    ],
  }),
  withFormId({
    key: "payment_form",
    id: "payment",
    title: "Collect payment",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "paymentAmount", label: "Amount collected", type: "currency", scope: "order", required: false },
      {
        key: "paymentMethod",
        label: "Method",
        type: "select",
        scope: "order",
        options: [
          { value: "CASH", label: "Cash" },
          { value: "UPI", label: "UPI" },
          { value: "BANK_TRANSFER", label: "Bank transfer" },
          { value: "OTHER", label: "Other" },
        ],
      },
      { key: "paymentReference", label: "Reference / UTR", type: "text", scope: "order" },
    ],
  }),
];

/**
 * Starter revision 3 — Trustwood/market dealer copy + Porter ExternalLink (frozen for upgrade hashes).
 * Do not edit; recommended chrome lives in SO_STANDARD_FORMS (rev 4).
 */
export const SO_STANDARD_FORMS_REV3: FormDefinition[] = [
  withFormId({
    key: "sales_review_form",
    id: "sales-review",
    title: "Confirm dealer order",
    description: "Adjust lines and promised delivery date before fulfilment starts.",
    themeId: "oms-default",
    confirmLabel: "Confirm order →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: true, showPrice: true, allowAdd: true, allowRemove: true } },
      { widget: "CatalogSearch", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "Comments", props: {} },
      { widget: "FileUpload", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "remarks", label: "Dealer / site notes", type: "text", scope: "order" },
      { key: "deliveryDate", label: "Promised delivery", type: "date", scope: "order" },
    ],
  }),
  withFormId({
    key: "inventory_form",
    id: "inventory",
    title: "Check godown availability",
    description: "Enter available qty. If available is below ordered, Procurement opens for shortage lines.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "InventoryView", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "availableQty",
        label: "Available in godown",
        type: "number",
        scope: "per-item",
        source: "quantity",
        required: true,
      },
    ],
  }),
  withFormId({
    key: "procurement_form",
    id: "procurement",
    title: "Raise shortage indent",
    theme: "amber",
    themeId: "oms-attention",
    description: "Send an indent for short plywood / laminate lines to mill or stockist.",
    confirmLabel: "Send indent →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "Comments", props: {} },
      { widget: "FileUpload", props: {} },
      { widget: "ActionButtons", props: { label: "Send indent →" } },
    ],
  }),
  withFormId({
    key: "pricing_form",
    id: "pricing",
    title: "Confirm trade margin",
    description: "Enter purchase cost; sell price comes from the order (list price).",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "FormFields", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "purchasePrice", label: "Purchase / landed cost", type: "number", scope: "per-item", required: true },
      {
        key: "unitPrice",
        label: "Dealer sell price",
        type: "readonly",
        scope: "per-item",
        source: "unitPrice",
      },
    ],
  }),
  withFormId({
    key: "warehouse_form",
    id: "warehouse",
    title: "Pick & pack",
    description: "Select godown / yard, then confirm items are packed for loading.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "WarehousePicker", props: { fieldKey: "warehouseId", required: false } },
      { widget: "ProductList", props: { editable: false } },
      { widget: "InventoryView", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "warehouseId", label: "Godown", type: "text", scope: "order" },
    ],
  }),
  withFormId({
    key: "dispatch_form",
    id: "dispatch",
    title: "Dispatch from yard",
    description:
      "Own tempo/truck or Porter. Use Open Porter booking to book on the portal — opening the link does not dispatch the order.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "DispatchFulfillment", props: {} },
      { widget: "DriverPicker", props: { fieldKey: "assignedDriverId", required: false } },
      {
        widget: "ExternalLink",
        props: {
          label: "Open Porter booking",
          description:
            "Book on Porter. Opening the link does not dispatch the order — complete this step after booking.",
          urlFromVariable: "porterBookUrl",
          openInNewTab: true,
        },
      },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "fulfillmentMode",
        label: "Fulfillment",
        type: "select",
        scope: "order",
        options: [
          { value: "own_fleet", label: "Own fleet" },
          { value: "porter", label: "Porter" },
        ],
      },
      { key: "vehicleInfo", label: "Vehicle no.", type: "text", scope: "order" },
      { key: "assignedDriverId", label: "Driver name / ID", type: "text", scope: "order" },
      { key: "porterBookingStatus", label: "Porter booking", type: "text", scope: "order" },
      { key: "trackingNumber", label: "Tracking / booking ID", type: "text", scope: "order" },
      { key: "trackingUrl", label: "Tracking URL", type: "url", scope: "order" },
    ],
  }),
  withFormId({
    key: "delivery_form",
    id: "delivery",
    title: "Confirm site delivery",
    description: "Attach proof of delivery (photo / signed challan), then confirm.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "FileUpload", props: {} },
      { widget: "Comments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
  }),
  withFormId({
    key: "invoice_form",
    id: "invoice",
    title: "Issue tax invoice",
    description: "Generate the GST tax invoice PDF, review it, then Confirm & complete.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      {
        widget: "InvoiceGenerate",
        props: {
          documentType: "INVOICE",
          command: "accounting.generateInvoice",
          documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
        },
      },
      { widget: "ActionButtons", props: { label: "Confirm & complete →" } },
    ],
  }),
  withFormId({
    key: "payment_form",
    id: "payment",
    title: "Record dealer payment",
    description: "Enter amount, method, and UTR / reference against the tax invoice.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "paymentAmount", label: "Amount collected", type: "currency", scope: "order", required: false },
      {
        key: "paymentMethod",
        label: "Method",
        type: "select",
        scope: "order",
        options: [
          { value: "CASH", label: "Cash" },
          { value: "UPI", label: "UPI" },
          { value: "BANK_TRANSFER", label: "NEFT / bank transfer" },
          { value: "OTHER", label: "Other" },
        ],
      },
      { key: "paymentReference", label: "UTR / reference", type: "text", scope: "order" },
    ],
  }),
];

/**
 * Starter revision 4 — frozen. CustomerInfo + Notes/Attachments chrome on all HUMAN tasks.
 * Do not edit; Bill & Collect invoice UX lives in SO_STANDARD_FORMS (rev 5).
 */
export const SO_STANDARD_FORMS_REV4: FormDefinition[] = [
  withFormId({
    key: "sales_review_form",
    id: "sales-review",
    title: "Confirm dealer order",
    description: "Adjust lines and promised delivery date before fulfilment starts.",
    themeId: "oms-default",
    confirmLabel: "Confirm order →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: true, showPrice: true, allowAdd: true, allowRemove: true } },
      { widget: "CatalogSearch", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "remarks", label: "Dealer / site notes", type: "text", scope: "order" },
      { key: "deliveryDate", label: "Promised delivery", type: "date", scope: "order" },
    ],
  }),
  withFormId({
    key: "inventory_form",
    id: "inventory",
    title: "Check godown availability",
    description: "Enter available qty. If available is below ordered, Procurement opens for shortage lines.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "InventoryView", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "FormFields", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "availableQty",
        label: "Available in godown",
        type: "number",
        scope: "per-item",
        source: "quantity",
        required: true,
      },
    ],
  }),
  withFormId({
    key: "procurement_form",
    id: "procurement",
    title: "Raise shortage indent",
    theme: "amber",
    themeId: "oms-attention",
    description: "Send an indent for short plywood / laminate lines to mill or stockist.",
    confirmLabel: "Send indent →",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: { label: "Send indent →" } },
    ],
  }),
  withFormId({
    key: "pricing_form",
    id: "pricing",
    title: "Confirm trade margin",
    description: "Enter purchase cost; sell price comes from the order (list price).",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "FormFields", props: {} },
      { widget: "PriceSummary", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "purchasePrice", label: "Purchase / landed cost", type: "number", scope: "per-item", required: true },
      {
        key: "unitPrice",
        label: "Dealer sell price",
        type: "readonly",
        scope: "per-item",
        source: "unitPrice",
      },
    ],
  }),
  withFormId({
    key: "warehouse_form",
    id: "warehouse",
    title: "Pick & pack",
    description: "Select godown / yard, then confirm items are packed for loading.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "WarehousePicker", props: { fieldKey: "warehouseId", required: false } },
      { widget: "ProductList", props: { editable: false } },
      { widget: "InventoryView", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "warehouseId", label: "Godown", type: "text", scope: "order" },
    ],
  }),
  withFormId({
    key: "dispatch_form",
    id: "dispatch",
    title: "Dispatch from yard",
    description:
      "Own tempo/truck or Porter. Use Open Porter booking to book on the portal — opening the link does not dispatch the order.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "DispatchFulfillment", props: {} },
      { widget: "DriverPicker", props: { fieldKey: "assignedDriverId", required: false } },
      {
        widget: "ExternalLink",
        props: {
          label: "Open Porter booking",
          description:
            "Book on Porter. Opening the link does not dispatch the order — complete this step after booking.",
          urlFromVariable: "porterBookUrl",
          openInNewTab: true,
        },
      },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      {
        key: "fulfillmentMode",
        label: "Fulfillment",
        type: "select",
        scope: "order",
        options: [
          { value: "own_fleet", label: "Own fleet" },
          { value: "porter", label: "Porter" },
        ],
      },
      { key: "vehicleInfo", label: "Vehicle no.", type: "text", scope: "order" },
      { key: "assignedDriverId", label: "Driver name / ID", type: "text", scope: "order" },
      { key: "porterBookingStatus", label: "Porter booking", type: "text", scope: "order" },
      { key: "trackingNumber", label: "Tracking / booking ID", type: "text", scope: "order" },
      { key: "trackingUrl", label: "Tracking URL", type: "url", scope: "order" },
    ],
  }),
  withFormId({
    key: "delivery_form",
    id: "delivery",
    title: "Confirm site delivery",
    description: "Attach proof of delivery (photo / signed challan), then confirm.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: false } },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
  }),
  withFormId({
    key: "invoice_form",
    id: "invoice",
    title: "Issue tax invoice",
    description: "Generate the GST tax invoice PDF, review it, then Confirm & complete.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      {
        widget: "InvoiceGenerate",
        props: {
          documentType: "INVOICE",
          command: "accounting.generateInvoice",
          documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
        },
      },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: { label: "Confirm & complete →" } },
    ],
  }),
  withFormId({
    key: "payment_form",
    id: "payment",
    title: "Record dealer payment",
    description: "Enter amount, method, and UTR / reference against the tax invoice.",
    themeId: "oms-default",
    layout: [
      { widget: "StatusBanner", props: {} },
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: { editable: false, showPrice: true } },
      { widget: "PriceSummary", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ],
    fields: [
      { key: "paymentAmount", label: "Amount collected", type: "currency", scope: "order", required: false },
      {
        key: "paymentMethod",
        label: "Method",
        type: "select",
        scope: "order",
        options: [
          { value: "CASH", label: "Cash" },
          { value: "UPI", label: "UPI" },
          { value: "BANK_TRANSFER", label: "NEFT / bank transfer" },
          { value: "OTHER", label: "Other" },
        ],
      },
      { key: "paymentReference", label: "UTR / reference", type: "text", scope: "order" },
    ],
  }),
];

/**
 * Starter revision 5 (latest) — Bill & Collect: editable invoice lines + optional advance on issue form.
 */
export const SO_STANDARD_FORMS: FormDefinition[] = SO_STANDARD_FORMS_REV4.map((form) => {
  const formId = form.id ?? form.key;
  if (formId === "invoice") {
    return withFormId({
      key: "invoice_form",
      id: "invoice",
      title: "Issue tax invoice",
      description:
        "Adjust qty/price if needed, generate & download the GST tax invoice, optionally record an advance, then Confirm. Sending the PDF to the customer comes later.",
      themeId: "oms-default",
      layout: [
        { widget: "StatusBanner", props: {} },
        { widget: "CustomerInfo", props: {} },
        { widget: "ProductList", props: { editable: true, showPrice: true, allowRemove: false } },
        { widget: "PriceSummary", props: {} },
        {
          widget: "InvoiceGenerate",
          props: {
            documentType: "INVOICE",
            command: "accounting.generateInvoice",
            documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
          },
        },
        { widget: "FormFields", props: {} },
        { widget: "Notes", props: {} },
        { widget: "Attachments", props: {} },
        { widget: "ActionButtons", props: { label: "Confirm & complete →" } },
      ],
      fields: [
        {
          key: "paymentAmount",
          label: "Advance / amount collected (optional)",
          type: "currency",
          scope: "order",
          required: false,
        },
        {
          key: "paymentMethod",
          label: "Payment method",
          type: "select",
          scope: "order",
          options: [
            { value: "CASH", label: "Cash" },
            { value: "UPI", label: "UPI" },
            { value: "BANK_TRANSFER", label: "NEFT / bank transfer" },
            { value: "OTHER", label: "Other" },
          ],
        },
        { key: "paymentReference", label: "UTR / reference", type: "text", scope: "order" },
      ],
    });
  }
  if (formId === "payment") {
    return withFormId({
      ...form,
      description:
        "Enter advance or full amount, method, and UTR. Leave blank and skip if collecting later — remaining balance stays on AR.",
    });
  }
  return form;
});

/** Latest starter form revision shipped in this module. */
export const STARTER_FORM_LATEST_REVISION = 5;


function formRef(formId: string, version = 1) {
  return { type: "FORM" as const, id: formId, version };
}

/**
 * Built-in sequential SO_STANDARD — filename kept as so-standard-v5.ts.
 * Definition version 9 embeds starter revision 5 layouts (Bill & Collect invoice UX).
 */
export const SO_STANDARD_V5: WorkflowDefinition = {
  template: "SO_STANDARD",
  version: 9,
  name: "Sales Order Standard",
  description:
    "Sequential: Sales → Inventory → Procurement? → Pricing → Warehouse → Dispatch → Delivery → Invoice → Payment → Close",
  entityTypes: ["SALES_ORDER"],
  variableDefaults: { shortage: false },
  forms: SO_STANDARD_FORMS,
  activities: [
    {
      key: "sales_review",
      type: "SALES_REVIEW",
      kind: "HUMAN",
      label: "Sales review",
      assetRef: formRef("sales-review"),
      roleHint: "SALES_EXECUTIVE",
      permissions: { claim: ["SALES_EXECUTIVE"], complete: ["SALES_EXECUTIVE"] },
      projectionStatus: "CONFIRMED",
    },
    {
      key: "inventory",
      type: "INVENTORY_CHECK",
      kind: "HUMAN",
      label: "Inventory check",
      assetRef: formRef("inventory"),
      roleHint: "SALES_EXECUTIVE",
      permissions: { claim: ["SALES_EXECUTIVE"], complete: ["SALES_EXECUTIVE"] },
      projectionStatus: "FULFILLING",
    },
    {
      key: "procurement",
      type: "PROCUREMENT_REQUEST",
      kind: "HUMAN",
      label: "Procurement",
      optional: true,
      condition: "shortage",
      assetRef: formRef("procurement"),
      roleHint: "SALES_EXECUTIVE",
      permissions: { claim: ["SALES_EXECUTIVE"], complete: ["SALES_EXECUTIVE"] },
    },
    {
      key: "pricing",
      type: "PRICING_REVIEW",
      kind: "HUMAN",
      label: "Pricing review",
      assetRef: formRef("pricing"),
      roleHint: "PRICING_EXECUTIVE",
      permissions: {
        claim: ["PRICING_EXECUTIVE"],
        complete: ["PRICING_EXECUTIVE"],
        reassign: ["PRICING_MANAGER", "ADMIN"],
      },
      projectionStatus: "FULFILLING",
    },
    {
      key: "warehouse",
      type: "WAREHOUSE_PICK",
      kind: "HUMAN",
      label: "Warehouse pick",
      assetRef: formRef("warehouse"),
      roleHint: "DISPATCH_EXECUTIVE",
      permissions: { claim: ["DISPATCH_EXECUTIVE"], complete: ["DISPATCH_EXECUTIVE"] },
      projectionStatus: "READY_FOR_DISPATCH",
    },
    {
      key: "dispatch",
      type: "DISPATCH",
      kind: "HUMAN",
      label: "Dispatch",
      assetRef: formRef("dispatch"),
      roleHint: "DISPATCH_EXECUTIVE",
      permissions: { claim: ["DISPATCH_EXECUTIVE"], complete: ["DISPATCH_EXECUTIVE"] },
      projectionStatus: "DISPATCHED",
    },
    {
      key: "deliver",
      type: "DELIVERY_CONFIRM",
      kind: "HUMAN",
      label: "Delivery confirmation",
      assetRef: formRef("delivery"),
      roleHint: "DELIVERY_EXECUTIVE",
      permissions: { claim: ["DELIVERY_EXECUTIVE"], complete: ["DELIVERY_EXECUTIVE"] },
      projectionStatus: "DELIVERED",
    },
    {
      key: "invoice",
      type: "INVOICE_GENERATE",
      kind: "HUMAN",
      label: "Invoice",
      assetRef: formRef("invoice"),
      roleHint: "ACCOUNTANT",
      permissions: { claim: ["ACCOUNTANT"], complete: ["ACCOUNTANT"] },
      retryPolicy: { maxAttempts: 3, backoffMs: 2000, backoffMultiplier: 2, timeoutMs: 600_000 },
      projectionStatus: "INVOICED",
    },
    {
      key: "payment",
      type: "PAYMENT_COLLECTION",
      kind: "HUMAN",
      label: "Collect payment",
      assetRef: formRef("payment"),
      roleHint: "ACCOUNTANT",
      permissions: { claim: ["ACCOUNTANT"], complete: ["ACCOUNTANT"] },
      projectionStatus: "PAID",
    },
    {
      key: "close",
      type: "ORDER_CLOSE",
      kind: "SYSTEM",
      label: "Close order",
      autoComplete: true,
      projectionStatus: "CLOSED",
    },
  ],
  edges: [
    { from: "sales_review", to: "inventory" },
    { from: "inventory", to: "procurement" },
    { from: "inventory", to: "pricing" },
    { from: "procurement", to: "pricing" },
    { from: "pricing", to: "warehouse" },
    { from: "warehouse", to: "dispatch" },
    { from: "dispatch", to: "deliver" },
    { from: "deliver", to: "invoice" },
    { from: "invoice", to: "payment" },
    { from: "payment", to: "close" },
  ],
  layout: {
    sales_review: { x: 0, y: 0 },
    inventory: { x: 0, y: 100 },
    procurement: { x: 200, y: 200 },
    pricing: { x: 0, y: 300 },
    warehouse: { x: 0, y: 400 },
    dispatch: { x: 0, y: 500 },
    deliver: { x: 0, y: 600 },
    invoice: { x: 0, y: 700 },
    payment: { x: 0, y: 800 },
    close: { x: 0, y: 900 },
  },
};

export const SO_TASK_TYPES: { type: string; label: string; kind: "HUMAN" | "SYSTEM" }[] = [
  { type: "SALES_REVIEW", label: "Sales review", kind: "HUMAN" },
  { type: "INVENTORY_CHECK", label: "Inventory check", kind: "HUMAN" },
  { type: "PROCUREMENT_REQUEST", label: "Procurement request", kind: "HUMAN" },
  { type: "PRICING_REVIEW", label: "Pricing review", kind: "HUMAN" },
  { type: "WAREHOUSE_PICK", label: "Warehouse pick", kind: "HUMAN" },
  { type: "DISPATCH", label: "Dispatch", kind: "HUMAN" },
  { type: "DELIVERY_CONFIRM", label: "Delivery confirmation", kind: "HUMAN" },
  { type: "INVOICE_GENERATE", label: "Invoice generate", kind: "HUMAN" },
  { type: "PAYMENT_COLLECTION", label: "Payment collection", kind: "HUMAN" },
  { type: "ORDER_CLOSE", label: "Order close", kind: "SYSTEM" },
];
