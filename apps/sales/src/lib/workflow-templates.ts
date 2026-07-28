/**
 * Platform order-lifecycle templates.
 * Never add a one-off customer status in code — add/adjust a template here,
 * then tenants apply it via POST /api/order-workflows/templates.
 */

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
  isTerminal?: boolean;
  allowCancel?: boolean;
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

/** Trading / plywood-style OMS with sales review, stock, vendor, pricing, dispatch */
export const OMS_TRADING_TEMPLATE: WorkflowTemplate = {
  templateId: "workflow.oms_trading",
  code: "OMS_TRADING",
  name: "OMS Trading",
  description:
    "Sales review → stock verify → vendor RFQ (optional) → pricing → dispatch → deliver → close",
  version: 2,
  trackedStatuses: [
    "DRAFT",
    "PENDING_SALES_REVIEW",
    "REVIEWED",
    "STOCK_VERIFIED",
    "VENDOR_REQUESTED",
    "PRICING_PENDING",
    "PRICING_COMPLETED",
    "READY_FOR_DISPATCH",
    "DISPATCHED",
    "DELIVERED",
    "CLOSED",
    "CANCELLED",
  ],
  steps: [
    {
      key: "submit",
      label: "Submit for review",
      action: "submit",
      fromStatuses: ["DRAFT"],
      toStatus: "PENDING_SALES_REVIEW",
      sortOrder: 10,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "none",
    },
    {
      key: "sales_review",
      label: "Complete sales review",
      action: "review",
      fromStatuses: ["PENDING_SALES_REVIEW", "SUBMITTED", "DRAFT"],
      toStatus: "REVIEWED",
      sortOrder: 20,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "none",
    },
    {
      key: "stock_verify",
      label: "Verify stock",
      action: "verify-stock",
      fromStatuses: ["REVIEWED", "STOCK_VERIFIED"],
      toStatus: null,
      resolverKey: "stock_verify",
      sortOrder: 30,
      roleHint: "SALES_EXECUTIVE",
      uiPanel: "stock",
    },
    {
      key: "request_vendors",
      label: "Request vendors",
      action: "request-vendors",
      fromStatuses: ["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"],
      toStatus: "VENDOR_REQUESTED",
      sortOrder: 35,
      roleHint: "PROCUREMENT_OFFICER",
      uiPanel: "none",
    },
    {
      key: "start_pricing",
      label: "Start pricing",
      action: "start-pricing",
      fromStatuses: ["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"],
      toStatus: "PRICING_PENDING",
      sortOrder: 40,
      roleHint: "PRICING_EXECUTIVE",
      uiPanel: "none",
    },
    {
      key: "complete_pricing",
      label: "Complete pricing",
      action: "complete-pricing",
      fromStatuses: ["PRICING_PENDING", "PRICING_COMPLETED"],
      toStatus: "PRICING_COMPLETED",
      sortOrder: 50,
      roleHint: "PRICING_EXECUTIVE",
      uiPanel: "pricing",
    },
    {
      key: "ready_dispatch",
      label: "Ready for dispatch",
      action: "ready-dispatch",
      fromStatuses: ["PRICING_COMPLETED"],
      toStatus: "READY_FOR_DISPATCH",
      sortOrder: 60,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "none",
    },
    {
      key: "dispatch",
      label: "Dispatch",
      action: "dispatch",
      fromStatuses: ["READY_FOR_DISPATCH", "PRICING_COMPLETED"],
      toStatus: "DISPATCHED",
      sortOrder: 70,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "dispatch",
    },
    {
      key: "deliver",
      label: "Mark delivered",
      action: "deliver-oms",
      fromStatuses: ["DISPATCHED", "OUT_FOR_DELIVERY"],
      toStatus: "DELIVERED",
      sortOrder: 80,
      roleHint: "DELIVERY_EXECUTIVE",
      uiPanel: "none",
    },
    {
      key: "close",
      label: "Close order",
      action: "close",
      fromStatuses: ["DELIVERED", "INVOICED"],
      toStatus: "CLOSED",
      sortOrder: 90,
      roleHint: "DISPATCH_EXECUTIVE",
      uiPanel: "document",
      isTerminal: true,
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
