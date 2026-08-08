/**
 * Event-driven buyer timeline — map SREQ + SO status into buyer-facing events.
 * Steps without evidence are omitted (industry workflows can differ).
 */

export type TimelineEvent = {
  id: string;
  title: string;
  at?: string;
  done: boolean;
  current?: boolean;
};

type RequestLike = {
  status: string;
  createdAt: string;
  updatedAt?: string;
  rejectReason?: string | null;
  salesOrder?: {
    status: string;
    orderNumber?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  soStatus?: string | null;
  soNumber?: string | null;
  events?: Array<{ type?: string; title?: string; at?: string; createdAt?: string }>;
};

const SO_PROGRESS: Array<{ match: string[]; title: string }> = [
  { match: ["CONFIRMED"], title: "Confirmed" },
  { match: ["FULFILLING"], title: "Allocated" },
  { match: ["READY_FOR_DISPATCH", "AWAITING_PICKUP"], title: "Ready" },
  { match: ["DISPATCHED", "OUT_FOR_DELIVERY", "SHIPPED", "PARTIALLY_SHIPPED"], title: "Shipped" },
  { match: ["DELIVERED", "INVOICED", "PAID", "CLOSED"], title: "Delivered" },
];

function soStageIndex(status: string): number {
  return SO_PROGRESS.findIndex((s) => s.match.includes(status));
}

export function buildBuyerTimeline(row: RequestLike): TimelineEvent[] {
  if (Array.isArray(row.events) && row.events.length > 0) {
    return row.events.map((e, i) => ({
      id: `evt-${i}`,
      title: e.title || e.type || "Update",
      at: e.at || e.createdAt,
      done: true,
      current: i === row.events!.length - 1,
    }));
  }

  const events: TimelineEvent[] = [
    {
      id: "created",
      title: "Request submitted",
      at: row.createdAt,
      done: true,
    },
  ];

  if (row.status === "REJECTED") {
    events.push({
      id: "rejected",
      title: "Rejected",
      at: row.updatedAt || row.createdAt,
      done: true,
      current: true,
    });
    return events;
  }

  if (row.status === "CANCELLED") {
    events.push({
      id: "cancelled",
      title: "Cancelled",
      at: row.updatedAt || row.createdAt,
      done: true,
      current: true,
    });
    return events;
  }

  const underReview = row.status === "OPEN";
  events.push({
    id: "reviewed",
    title: "Under review",
    at: underReview ? undefined : row.updatedAt || row.createdAt,
    done: !underReview,
    current: underReview,
  });

  const soStatus = row.salesOrder?.status ?? row.soStatus;
  if (!soStatus) {
    return events;
  }

  events.push({
    id: "confirmed-order",
    title: row.soNumber || row.salesOrder?.orderNumber
      ? `Order confirmed (${row.soNumber || row.salesOrder?.orderNumber})`
      : "Order confirmed",
    at: row.salesOrder?.createdAt || row.updatedAt || row.createdAt,
    done: true,
  });

  const idx = soStageIndex(soStatus);
  SO_PROGRESS.forEach((step, i) => {
    events.push({
      id: `so-${step.title}`,
      title: step.title,
      at: i <= idx ? row.salesOrder?.updatedAt || row.updatedAt || row.createdAt : undefined,
      done: i <= idx,
      current: i === idx,
    });
  });

  return events;
}
