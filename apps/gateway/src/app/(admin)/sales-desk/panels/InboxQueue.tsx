"use client";

import { Button, EmptyState, StatusBadge, cn } from "@erp/ui";
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
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    n ?? 0
  );
}

function initial(name: string | null | undefined) {
  const v = (name ?? "?").trim();
  return v.charAt(0).toUpperCase() || "?";
}

/** Inbox queue — informational rows; actions live in WorkspaceBottomBar. */
export function InboxQueue({
  sreqs,
  selectedId,
  loading,
  onSelect,
  onRefresh,
}: {
  sreqs: SreqRow[];
  selectedId?: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
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
                "relative w-full px-4 py-3.5 text-left transition-colors hover:bg-[var(--mist)]",
                selected && "bg-[color-mix(in_srgb,var(--brand)_8%,var(--mist))]"
              )}
              style={{ minHeight: "var(--row-h)" }}
            >
              {selected ? (
                <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--brand)]" aria-hidden />
              ) : null}
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mist)] text-xs font-bold text-[var(--brand)]"
                  aria-hidden
                >
                  {initial(sreq.customer?.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{sreq.requestNumber}</div>
                      <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
                        {sreq.customer?.name ?? "Walk-in customer"}
                      </div>
                    </div>
                    <StatusBadge status={sreq.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-soft)]">
                    <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(sreq.total)}</span>
                    {sreq.paymentMethod ? <span>{sreq.paymentMethod}</span> : null}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
      {!loading && sreqs.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Inbox is empty"
          subtitle="Dealer checkouts appear here as sales requests."
          action={
            onRefresh ? (
              <Button type="button" size="sm" onClick={onRefresh}>
                Refresh inbox
              </Button>
            ) : null
          }
        />
      )}
    </ul>
  );
}
