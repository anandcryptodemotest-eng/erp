/**
 * Author-facing widget catalog for Admin Host (Forms Studio + Sales Desk).
 * Stable ids are persisted; display metadata is for authoring UX.
 */

export type WidgetCatalogEntry = {
  /** Stable registry / persistence id (hidden from authors where possible) */
  id: string;
  name: string;
  category: string;
  description: string;
  supportedContexts: string[];
  defaultProps?: Record<string, unknown>;
  /** Boolean/string prop keys authors may edit in Layout */
  editableProps?: { key: string; label: string; type: "boolean" | "string" }[];
  permissions?: string[];
  featureFlag?: string;
  /** Include in Form Designer layout picker */
  designerVisible?: boolean;
};

export const ADMIN_RUNTIME_VERSION = "1.0.0";

/** Full OMS Admin catalog — bootstrap registers these into ui-runtime. */
export const adminWidgetCatalog: Record<string, WidgetCatalogEntry> = {
  FormFields: {
    id: "FormFields",
    name: "Form Fields",
    category: "Input",
    description: "Renders the form’s field definitions as editable controls.",
    supportedContexts: ["ADMIN", "CUSTOMER", "WAREHOUSE", "DRIVER"],
    designerVisible: true,
  },
  ActionButtons: {
    id: "ActionButtons",
    name: "Action Buttons",
    category: "Input",
    description: "Primary complete action and optional cancel.",
    supportedContexts: ["ADMIN", "WAREHOUSE", "DRIVER"],
    designerVisible: true,
  },
  ProductList: {
    id: "ProductList",
    name: "Product List",
    category: "Business",
    description: "Line items with quantity and optional price editing.",
    supportedContexts: ["ADMIN"],
    defaultProps: { editable: true, showPrice: true, allowAdd: false, allowRemove: true },
    editableProps: [
      { key: "editable", label: "Edit qty/price", type: "boolean" },
      { key: "allowRemove", label: "Allow remove", type: "boolean" },
      { key: "showPrice", label: "Show price", type: "boolean" },
    ],
    designerVisible: true,
  },
  CatalogSearch: {
    id: "CatalogSearch",
    name: "Catalog Search",
    category: "Business",
    description: "Search and add products to the order.",
    supportedContexts: ["ADMIN"],
    designerVisible: true,
  },
  FileUpload: {
    id: "FileUpload",
    name: "File Upload",
    category: "Input",
    description: "Attach files to the task context.",
    supportedContexts: ["ADMIN", "CUSTOMER"],
    designerVisible: true,
  },
  Timeline: {
    id: "Timeline",
    name: "Timeline",
    category: "Visualization",
    description: "Workflow and order event history.",
    supportedContexts: ["ADMIN"],
    designerVisible: true,
  },
  Comments: {
    id: "Comments",
    name: "Comments",
    category: "Input",
    description: "Threaded comments for the task.",
    supportedContexts: ["ADMIN", "CUSTOMER"],
    designerVisible: true,
  },
  InventoryView: {
    id: "InventoryView",
    name: "Inventory View",
    category: "Business",
    description: "Availability and shortage against ordered lines.",
    supportedContexts: ["ADMIN", "WAREHOUSE"],
    designerVisible: true,
  },
  PriceSummary: {
    id: "PriceSummary",
    name: "Price Summary",
    category: "Business",
    description: "Order totals and currency.",
    supportedContexts: ["ADMIN"],
    designerVisible: true,
  },
  StatusBanner: {
    id: "StatusBanner",
    name: "Status Banner",
    category: "Workflow",
    description: "Highlights current order or task status.",
    supportedContexts: ["ADMIN", "WAREHOUSE", "DRIVER"],
    designerVisible: true,
  },
  WarehousePicker: {
    id: "WarehousePicker",
    name: "Warehouse Picker",
    category: "Business",
    description: "Select a fulfillment warehouse.",
    supportedContexts: ["ADMIN", "WAREHOUSE"],
    defaultProps: { fieldKey: "warehouseId", required: false },
    editableProps: [{ key: "required", label: "Required", type: "boolean" }],
    designerVisible: true,
  },
  DriverPicker: {
    id: "DriverPicker",
    name: "Driver Picker",
    category: "Business",
    description: "Assign a delivery driver.",
    supportedContexts: ["ADMIN", "DISPATCH"],
    defaultProps: { fieldKey: "assignedDriverId", required: false },
    editableProps: [{ key: "required", label: "Required", type: "boolean" }],
    designerVisible: true,
  },
};

export const DESIGNER_WIDGET_ALLOWLIST = new Set(
  Object.values(adminWidgetCatalog)
    .filter((w) => w.designerVisible !== false)
    .map((w) => w.id)
);

export function designerLayoutOptions(
  catalog: Record<string, WidgetCatalogEntry> = adminWidgetCatalog
): { id: string; label: string; entry: WidgetCatalogEntry }[] {
  return Object.values(catalog)
    .filter((w) => w.designerVisible !== false && DESIGNER_WIDGET_ALLOWLIST.has(w.id))
    .map((w) => ({
      id: w.id,
      label: `${w.name} (${w.category})`,
      entry: w,
    }));
}
