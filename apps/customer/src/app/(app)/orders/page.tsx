"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  OPEN: "bg-amber-100 text-amber-900",
  CONVERTED: "bg-sky-100 text-sky-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-sky-100 text-sky-800",
  FULFILLING: "bg-violet-100 text-violet-900",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-900",
  DISPATCHED: "bg-blue-100 text-blue-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  INVOICED: "bg-indigo-100 text-indigo-900",
  PAID: "bg-emerald-100 text-emerald-900",
  CLOSED: "bg-emerald-200 text-emerald-950",
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
    <div className="pb-6">
      <div
        className="relative overflow-hidden px-4 pb-10 pt-6 text-white md:px-8"
        style={{
          background: "linear-gradient(135deg, #121a16 0%, #1e3d32 55%, #3d4f2f 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1400&q=60)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            mixBlendMode: "overlay",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber-soft)]">
            Tracking
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold md:text-4xl">My requests</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Sales requests convert to sales orders. Once converted, you see live order status here.
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-5 px-4 md:px-8">
        {loading && (
          <div className="rounded-2xl bg-white py-16 text-center text-sm text-[var(--ink-soft)]/60 shadow-sm">
            Loading…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-sm">
            <div
              className="h-36 bg-cover bg-center"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgba(18,26,22,0.7), transparent), url(https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80)",
              }}
            />
            <div className="px-6 py-8 text-center">
              <p className="font-display text-xl text-[var(--ink)]">No requests yet</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">Place your first site order from the shop.</p>
              <Link href="/products" className="btn-dark mt-5">
                Browse catalog
              </Link>
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((o) => {
              const shown = displayRequestStatus(o);
              const style = STATUS_STYLE[shown] ?? STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-700";
              const firstItem = o.items?.[0]?.productName;
              const title = o.salesOrder?.orderNumber
                ? `${o.requestNumber} → ${o.salesOrder.orderNumber}`
                : o.requestNumber;
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}?type=sreq`}
                  className="block overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-stretch">
                    <div className="w-1.5 bg-[var(--amber)]" />
                    <div className="flex flex-1 items-center gap-3 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--mist)] font-display text-sm font-bold text-[var(--forest)]">
                        {o.requestNumber.replace(/\D/g, "").slice(-3) || "SR"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[var(--ink)]">{title}</span>
                          <span className={`status-pill ${style}`}>
                            {o.status === "OPEN" ? sreqLabel(o.status) : omsLabel(shown)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]/70">
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
        )}
      </div>
    </div>
  );
}
