/**
 * Customer portal status labels for SREQ + coarse SO lifecycle.
 * SO mid-funnel work is parallel tasks — not shown as a long status ladder.
 */

export const SREQ_STATUS_LABEL: Record<string, string> = {
  OPEN: "With Sales",
  CONVERTED: "Order created",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const OMS_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  FULFILLING: "In fulfillment",
  READY_FOR_DISPATCH: "Ready to ship",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  INVOICED: "Invoiced",
  PAID: "Paid",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  AWAITING_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  PARTIALLY_SHIPPED: "Partially shipped",
  SHIPPED: "Shipped",
};

/** Portal tracker for a Sales Request (before convert) */
export const SREQ_TRACKER_STEPS = [
  { status: "OPEN", label: "Submitted", match: ["OPEN"] },
  { status: "CONVERTED", label: "Order created", match: ["CONVERTED"] },
];

/** Portal tracker after SO exists — coarse stages only */
export const OMS_TRACKER_STEPS = [
  {
    status: "CONFIRMED",
    label: "Confirmed",
    match: ["CONFIRMED", "FULFILLING"],
  },
  {
    status: "READY_FOR_DISPATCH",
    label: "Ready",
    match: ["READY_FOR_DISPATCH"],
  },
  {
    status: "DISPATCHED",
    label: "Shipped",
    match: ["DISPATCHED"],
  },
  {
    status: "DELIVERED",
    label: "Delivered",
    match: ["DELIVERED", "INVOICED", "PAID"],
  },
  {
    status: "CLOSED",
    label: "Closed",
    match: ["CLOSED"],
  },
];

export function omsLabel(status: string): string {
  return OMS_STATUS_LABEL[status] ?? SREQ_STATUS_LABEL[status] ?? status;
}

export function sreqLabel(status: string): string {
  return SREQ_STATUS_LABEL[status] ?? status;
}

export function customerCanCancelRequest(status: string): boolean {
  return status === "OPEN";
}

/** @deprecated use customerCanCancelRequest — customers cancel SREQs, not SOs */
export function customerCanCancel(status: string): boolean {
  return customerCanCancelRequest(status);
}

export function omsTrackerIndex(status: string): number {
  const idx = OMS_TRACKER_STEPS.findIndex((s) => s.match.includes(status));
  return idx >= 0 ? idx : 0;
}

export function sreqTrackerIndex(status: string): number {
  const idx = SREQ_TRACKER_STEPS.findIndex((s) => s.match.includes(status));
  return idx >= 0 ? idx : 0;
}

/** Display status for a request row: SO status when converted, else SREQ status */
export function displayRequestStatus(row: {
  status: string;
  salesOrder?: { status: string } | null;
  soStatus?: string | null;
}): string {
  return row.salesOrder?.status ?? row.soStatus ?? row.status;
}
