"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Container, SectionHeader, Skeleton } from "@erp/ui";
import { api } from "@/lib/api-client";
import { displayRequestStatus, omsLabel, sreqLabel } from "@/lib/oms-status";

interface SalesRequestRow {
  id: string;
  requestNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items?: { productName?: string }[];
  salesOrder?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--amber-soft)]/40 text-[var(--ink)]",
  CONVERTED: "bg-[var(--mist)] text-[var(--forest)]",
  REJECTED: "bg-red-50 text-[var(--danger)]",
  CANCELLED: "bg-red-50 text-[var(--danger)]",
  DRAFT: "bg-[var(--mist)] text-[var(--ink-soft)]",
  CONFIRMED: "bg-[var(--mist)] text-[var(--forest)]",
  FULFILLING: "bg-[var(--mist)] text-[var(--forest-mid)]",
  READY_FOR_DISPATCH: "bg-[var(--mist)] text-[var(--forest)]",
  DISPATCHED: "bg-[var(--mist)] text-[var(--forest)]",
  DELIVERED: "bg-[var(--mist)] text-[var(--success)]",
  INVOICED: "bg-[var(--mist)] text-[var(--forest)]",
  PAID: "bg-[var(--mist)] text-[var(--success)]",
  CLOSED: "bg-[var(--mist)] text-[var(--success)]",
};

export default function OrdersPage() {
  const [rows, setRows] = useState<SalesRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: SalesRequestRow[] }>("sales", "/api/sales-requests?limit=30").then((r) => {
      if (!r.error) setRows(r.data?.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Tracking</p>
      <SectionHeader title="My requests" className="mb-2" />
      <p className="mb-6 -mt-2 max-w-lg text-sm text-[var(--ink-soft)]">
        Sales requests convert to sales orders. Once converted, you see live order status here.
      </p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-white px-6 py-12 text-center shadow-[var(--shadow-sm)]">
          <p className="font-display text-xl text-[var(--ink)]">No requests yet</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Place your first site order from the shop.</p>
          <Link href="/products" className="mt-5 inline-block">
            <Button variant="primary">Browse catalog</Button>
          </Link>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((o) => {
            const shown = displayRequestStatus(o);
            const style = STATUS_STYLE[shown] ?? STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT;
            const firstItem = o.items?.[0]?.productName;
            const title = o.salesOrder?.orderNumber
              ? `${o.requestNumber} → ${o.salesOrder.orderNumber}`
              : o.requestNumber;
            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}?type=sreq`}
                className="block rounded-[var(--radius)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)] transition hover:border-[var(--forest-mid)]"
              >
                <div className="flex items-stretch">
                  <div className="w-1.5 shrink-0 bg-[var(--amber)]" aria-hidden />
                  <div className="flex min-h-[var(--touch-min)] flex-1 items-center gap-3 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--mist)] font-display text-sm font-bold text-[var(--forest)]">
                      {o.requestNumber.replace(/\D/g, "").slice(-3) || "SR"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--ink)]">{title}</span>
                        <span
                          className={`inline-flex rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
                        >
                          {o.status === "OPEN" ? sreqLabel(o.status) : omsLabel(shown)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {firstItem ? ` · ${firstItem}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-semibold text-[var(--ink)]">
                        ₹{Number(o.total).toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--amber)]">
                        View
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </Container>
  );
}
