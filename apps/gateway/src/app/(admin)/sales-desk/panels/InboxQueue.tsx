"use client";

import { EmptyState, StatusBadge, cn } from "@erp/ui";
import { ClipboardList } from "lucide-react";

type SreqRow = {
  id: string;
  requestNumber: string;
  status: string;
  total: number;
  paymentMethod?: string;
  customer: { name: string } | null;
};

function formatMoney(n: number) {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

/** Inbox queue — informational rows; actions live in WorkspaceBottomBar. */
export function InboxQueue({
  sreqs,
  selectedId,
  loading,
  onSelect,
}: {
  sreqs: SreqRow[];
  selectedId?: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="max-h-[72vh] divide-y divide-[var(--line)] overflow-y-auto">
      {sreqs.map((sreq) => {
        const selected = selectedId === sreq.id;
        return (
          <li key={sreq.id}>
            <button
              type="button"
              onClick={() => onSelect(sreq.id)}
              className={cn(
                "relative w-full px-4 py-3 text-left transition-colors hover:bg-[var(--mist)]",
                selected && "bg-[var(--mist)]"
              )}
              style={{ minHeight: "var(--row-h)" }}
            >
              {selected ? (
                <span
                  className="absolute inset-y-0 left-0 w-0.5 bg-[var(--brand)]"
                  aria-hidden
                />
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--ink)]">
                    {sreq.requestNumber}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--ink-soft)]">
                    {sreq.customer?.name ?? "—"}
                  </div>
                </div>
                <StatusBadge status={sreq.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-soft)]">
                <span className="tabular-nums">{formatMoney(sreq.total)}</span>
                {sreq.paymentMethod ? <span>{sreq.paymentMethod}</span> : null}
              </div>
            </button>
          </li>
        );
      })}
      {!loading && sreqs.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Inbox is empty"
          subtitle="Customer checkouts appear here as sales requests."
        />
      )}
    </ul>
  );
}
