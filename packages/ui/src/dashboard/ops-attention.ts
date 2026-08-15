/** Counts the ops-summary BFF already has — presentation widgets do not fetch their own. */
export type OpsAttentionCounts = {
  sreqsOpen: number;
  pendingFulfilment: number;
  deliveriesPending: number;
  overdueReceivables: number;
  openTasks: number;
};

export type OpsAttentionItem = {
  id: string;
  label: string;
  value: number;
  href: string;
  kind: "count" | "money";
  tone?: "neutral" | "warning" | "danger";
};

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(value: number): string {
  return INR.format(value);
}

/** Compact currency for phone TODAY strip (e.g. ₹1.64L). */
export function formatInrCompact(value: number): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 10_000_000) {
    return `₹${(n / 10_000_000).toFixed(2).replace(/\.?0+$/, "")}Cr`;
  }
  if (abs >= 100_000) {
    return `₹${(n / 100_000).toFixed(2).replace(/\.?0+$/, "")}L`;
  }
  if (abs >= 1_000) {
    return `₹${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatInr(n);
}

/**
 * Assemble TODAY rows. Zero-count items are omitted so a quiet tenant
 * is not a wall of empty modules.
 */
export function buildOpsAttention(c: OpsAttentionCounts): OpsAttentionItem[] {
  const items: OpsAttentionItem[] = [
    {
      id: "sreqs",
      label: "SREQs awaiting conversion",
      value: c.sreqsOpen,
      href: "/admin/sales-desk",
      kind: "count",
    },
    {
      id: "fulfil",
      label: "orders awaiting fulfilment",
      value: c.pendingFulfilment,
      href: "/admin/sales-desk",
      kind: "count",
    },
    {
      id: "deliveries",
      label: "deliveries pending",
      value: c.deliveriesPending,
      href: "/admin/sales-desk",
      kind: "count",
    },
    {
      id: "overdue",
      label: "overdue receivables",
      value: c.overdueReceivables,
      href: "/admin/ar",
      kind: "money",
      tone: "danger",
    },
    {
      id: "tasks",
      label: "workflow tasks",
      value: c.openTasks,
      href: "/admin/sales-desk",
      kind: "count",
    },
  ];
  return items.filter((item) => item.value > 0);
}

export function formatAttentionLine(item: OpsAttentionItem, formatMoney: (n: number) => string = formatInr): string {
  if (item.kind === "money") return `${formatMoney(item.value)} ${item.label}`;
  return `${item.value} ${item.label}`;
}
