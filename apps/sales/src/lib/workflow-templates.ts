/**
 * Platform order-lifecycle templates.
 * Never add a one-off customer status in code — add/adjust a template here,
 * then tenants apply it via POST /api/order-workflows/templates.
 *
 * Trading OMS: SREQ converts to SO, then parallel PREP tasks drive work.
 * SO status stays coarse (CONFIRMED → FULFILLING → READY_FOR_DISPATCH → … → CLOSED).
 */

export type StepField = {
  key: string;
  label: string;
  type: "number" | "text" | "readonly";
  scope: "per-item" | "order";
  /** Pre-fill from this OrderItem field name (e.g. "quantity") */
  source?: string;
};

export type StepUi = {
  description?: string;
  fields?: StepField[];
  confirmLabel?: string;
  theme?: "emerald" | "amber";
  /** Show a line-item summary (product + qty) when fields is empty */
  showItems?: boolean;
  /** Show the order total in the panel */
  showTotal?: boolean;
};

export type WorkflowStepTemplate = {
  key: string;
  label: string;
  action: string;
  fromStatuses: string[];
  toStatus: string | null;
  resolverKey?: string | null;
  sortOrder: number;
  roleHint?: string;
  uiPanel?: "none" | "stock" | "pricing" | "dispatch" | "document";
  phase?: "PREP" | "FULFILL" | "CLOSE";
  /** Step keys that must be COMPLETED before this action is offered */
  dependsOn?: string[];
  /** If false, task is only opened when activated (e.g. shortage → procurement) */
  required?: boolean;
  isTerminal?: boolean;
  allowCancel?: boolean;
  /** UI rendering metadata — drives the generic StepPanel component */
  ui?: StepUi;
};

export type WorkflowTemplate = {
  templateId: string;
  code: string;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStepTemplate[];
  /** Statuses treated as "in this workflow" for UI filtering */
  trackedStatuses: string[];
};

/**
 * Trading / plywood OMS after SREQ→SO convert.
 * Prep tasks run in parallel; fulfillment is sequential.
 */
export const OMS_TRADING_TEMPLATE: WorkflowTemplate = {
  templateId: "workflow.oms_trading",
  code: "OMS_TRADING",
  name: "OMS Trading",
  description:
    "SO confirmed → SE review + inventory + vendor RFQ (if shortage) in parallel with pricing/warehouse → dispatch → deliver → invoice → payment → close",
  version: 4,
  trackedStatuses: [
    "DRAFT",
    "CONFIRMED",
    "FULFILLING",
    "READY_FOR_DISPATCH",
    "DISPATCHED",
    "DELIVERED",
    "INVOICED",
    "PAID",
    "CLOSED",
    "CANCELLED",
  ],
  steps: [
    {
      key: "activate",
      label: "Activate order",
      action: "activate",
      fromStatuses: ["DRAFT"],
      toStatus: "CONFIRMED",
      sortOrder: 10,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
    },
    {
      key: "sales_review",
      label: "Sales review",
      action: "review",
      fromStatuses: ["CONFIRMED", "FULFILLING"],
      toStatus: null,
      resolverKey: "prep_gate",
      sortOrder: 20,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "none",
      phase: "PREP",
      dependsOn: [],
      required: true,
      ui: {
        description: "Add or remove products, confirm qty. Pricing is set by the pricing team.",
      },
    },
    {
      key: "inventory",
      label: "Verify inventory",
      action: "verify-stock",
      fromStatuses: ["CONFIRMED", "FULFILLING"],
      toStatus: null,
      resolverKey: "prep_gate",
      sortOrder: 21,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "stock",
      phase: "PREP",
      dependsOn: [],
      required: true,
      ui: {
        description: "Enter what you physically have. Shortage unlocks vendor procurement.",
        fields: [
          { key: "availableQty", label: "Available qty", type: "number", scope: "per-item", source: "quantity" },
        ],
      },
    },
    {
      key: "pricing",
      label: "Complete pricing",
      action: "complete-pricing",
      fromStatuses: ["CONFIRMED", "FULFILLING"],
      toStatus: null,
      resolverKey: "prep_gate",
      sortOrder: 22,
      roleHint: "PRICING_EXECUTIVE",
      uiPanel: "pricing",
      phase: "PREP",
      dependsOn: [],
      required: true,
      ui: {
        description: "Set the purchase cost for each line. Sell price is shown for reference.",
        fields: [
          { key: "purchasePrice", label: "Purchase price", type: "number", scope: "per-item" },
          { key: "unitPrice", label: "Sell price", type: "readonly", scope: "per-item", source: "unitPrice" },
        ],
      },
    },
    {
      key: "warehouse",
      label: "Warehouse ready",
      action: "warehouse-ready",
      fromStatuses: ["CONFIRMED", "FULFILLING"],
      toStatus: null,
      resolverKey: "prep_gate",
      sortOrder: 23,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "none",
      phase: "PREP",
      dependsOn: [],
      required: true,
      ui: {
        description: "Confirm items are picked, packed and ready for dispatch.",
        showItems: true,
      },
    },
    {
      key: "procurement",
      label: "Send procurement to vendor",
      action: "request-vendors",
      fromStatuses: ["CONFIRMED", "FULFILLING"],
      toStatus: null,
      resolverKey: "prep_gate",
      sortOrder: 24,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "none",
      phase: "PREP",
      dependsOn: ["inventory"],
      required: false,
      ui: {
        description: "Raise a vendor request for the missing quantity.",
        theme: "amber",
      },
    },
    {
      key: "dispatch",
      label: "Dispatch",
      action: "dispatch",
      fromStatuses: ["READY_FOR_DISPATCH"],
      toStatus: "DISPATCHED",
      sortOrder: 70,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "dispatch",
      phase: "FULFILL",
      dependsOn: [],
      required: true,
      ui: {
        description: "Assign vehicle and driver, then dispatch.",
        fields: [
          { key: "vehicleInfo", label: "Vehicle no.", type: "text", scope: "order" },
          { key: "assignedDriverId", label: "Driver name / ID", type: "text", scope: "order" },
        ],
      },
    },
    {
      key: "deliver",
      label: "Mark delivered",
      action: "deliver-oms",
      fromStatuses: ["DISPATCHED"],
      toStatus: "DELIVERED",
      sortOrder: 80,
      roleHint: "DELIVERY_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
      dependsOn: [],
      required: true,
      ui: {
        description: "Confirm the order has been delivered to the customer.",
        showItems: true,
      },
    },
    {
      key: "invoice",
      label: "Create invoice",
      action: "invoice",
      fromStatuses: ["DELIVERED"],
      toStatus: "INVOICED",
      sortOrder: 90,
      roleHint: "ACCOUNTANT",
      uiPanel: "document",
      phase: "CLOSE",
      dependsOn: [],
      required: true,
      ui: {
        description: "Generate and issue the invoice for this order.",
        showItems: true,
        showTotal: true,
      },
    },
    {
      key: "collect_payment",
      label: "Collect payment",
      action: "collect-payment",
      fromStatuses: ["INVOICED"],
      toStatus: "PAID",
      sortOrder: 100,
      roleHint: "ACCOUNTANT",
      uiPanel: "document",
      phase: "CLOSE",
      dependsOn: [],
      required: true,
      ui: {
        description: "Record that payment has been received from the customer.",
        showTotal: true,
      },
    },
    {
      key: "close",
      label: "Close order",
      action: "close",
      fromStatuses: ["PAID"],
      toStatus: "CLOSED",
      sortOrder: 110,
      roleHint: "ADMIN",
      uiPanel: "document",
      phase: "CLOSE",
      dependsOn: [],
      required: true,
      isTerminal: true,
      ui: {
        description: "Close the order — no further changes allowed.",
      },
    },
  ],
};

/** Online / grocery delivery path (existing sales confirm → delivery) */
export const GROCERY_DELIVERY_TEMPLATE: WorkflowTemplate = {
  templateId: "workflow.grocery_delivery",
  code: "GROCERY_DELIVERY",
  name: "Grocery Delivery",
  description: "Confirm → awaiting pickup → out for delivery → delivered → invoice",
  version: 1,
  trackedStatuses: [
    "DRAFT",
    "CONFIRMED",
    "AWAITING_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "INVOICED",
    "CANCELLED",
    "PARTIALLY_SHIPPED",
    "SHIPPED",
  ],
  steps: [
    {
      key: "confirm",
      label: "Confirm & reserve stock",
      action: "confirm",
      fromStatuses: ["DRAFT"],
      toStatus: "CONFIRMED",
      sortOrder: 10,
      roleHint: "MANAGER",
      uiPanel: "none",
      phase: "FULFILL",
    },
    {
      key: "awaiting_pickup",
      label: "Ready for pickup",
      action: "awaiting_pickup",
      fromStatuses: ["CONFIRMED"],
      toStatus: "AWAITING_PICKUP",
      sortOrder: 20,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
    },
    {
      key: "out_for_delivery",
      label: "Out for delivery",
      action: "out_for_delivery",
      fromStatuses: ["AWAITING_PICKUP"],
      toStatus: "OUT_FOR_DELIVERY",
      sortOrder: 30,
      roleHint: "DELIVERY_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
    },
    {
      key: "delivered",
      label: "Mark delivered",
      action: "delivered",
      fromStatuses: ["OUT_FOR_DELIVERY"],
      toStatus: "DELIVERED",
      sortOrder: 40,
      roleHint: "DELIVERY_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
    },
    {
      key: "invoice",
      label: "Create invoice",
      action: "invoice",
      fromStatuses: ["DELIVERED", "SHIPPED"],
      toStatus: "INVOICED",
      sortOrder: 50,
      roleHint: "ACCOUNTANT",
      uiPanel: "document",
      phase: "CLOSE",
      isTerminal: true,
    },
    {
      key: "ship",
      label: "Ship (B2B partial/full)",
      action: "ship",
      fromStatuses: ["CONFIRMED", "PARTIALLY_SHIPPED"],
      toStatus: null,
      resolverKey: "ship",
      sortOrder: 25,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "none",
      phase: "FULFILL",
    },
  ],
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  OMS_TRADING_TEMPLATE,
  GROCERY_DELIVERY_TEMPLATE,
];

export function getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.templateId === templateId);
}

/** One-time map from legacy trading mid-statuses → coarse SO status */
export const LEGACY_TRADING_STATUS_MAP: Record<string, string> = {
  PENDING_SALES_REVIEW: "CONFIRMED",
  SUBMITTED: "CONFIRMED",
  REVIEWED: "FULFILLING",
  STOCK_VERIFIED: "FULFILLING",
  VENDOR_REQUESTED: "FULFILLING",
  PRICING_PENDING: "FULFILLING",
  PRICING_COMPLETED: "FULFILLING",
  OUT_FOR_DELIVERY: "DISPATCHED",
};
