/** Shared OMS status labels + tracker steps for the customer portal */

export const OMS_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_SALES_REVIEW: "With Sales",
  REVIEWED: "Reviewed",
  STOCK_VERIFIED: "Stock checked",
  VENDOR_REQUESTED: "Sourcing",
  PRICING_PENDING: "Pricing",
  PRICING_COMPLETED: "Priced",
  READY_FOR_DISPATCH: "Ready to ship",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  CONFIRMED: "Confirmed",
  AWAITING_PICKUP: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  INVOICED: "Invoiced",
};

export const OMS_TRACKER_STEPS = [
  { status: "PENDING_SALES_REVIEW", label: "Submitted", match: ["DRAFT", "PENDING_SALES_REVIEW"] },
  { status: "REVIEWED", label: "Sales review", match: ["REVIEWED", "STOCK_VERIFIED", "VENDOR_REQUESTED"] },
  { status: "PRICING_PENDING", label: "Pricing", match: ["PRICING_PENDING", "PRICING_COMPLETED"] },
  { status: "DISPATCHED", label: "Dispatch", match: ["READY_FOR_DISPATCH", "DISPATCHED"] },
  { status: "DELIVERED", label: "Delivered", match: ["DELIVERED", "CLOSED", "INVOICED"] },
] as const;

export function omsLabel(status: string): string {
  return OMS_STATUS_LABEL[status] ?? status;
}

export function omsTrackerIndex(status: string): number {
  if (status === "CANCELLED") return -1;
  for (let i = OMS_TRACKER_STEPS.length - 1; i >= 0; i--) {
    if ((OMS_TRACKER_STEPS[i].match as readonly string[]).includes(status)) return i;
  }
  return 0;
}

export function customerCanCancel(status: string): boolean {
  return status === "DRAFT" || status === "PENDING_SALES_REVIEW";
}
