"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { omsLabel } from "@/lib/oms-status";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items?: { productName?: string; name?: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_SALES_REVIEW: "bg-amber-100 text-amber-900",
  REVIEWED: "bg-sky-100 text-sky-800",
  STOCK_VERIFIED: "bg-cyan-100 text-cyan-900",
  VENDOR_REQUESTED: "bg-orange-100 text-orange-900",
  PRICING_PENDING: "bg-violet-100 text-violet-900",
  PRICING_COMPLETED: "bg-indigo-100 text-indigo-900",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-900",
  DISPATCHED: "bg-blue-100 text-blue-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  CLOSED: "bg-emerald-200 text-emerald-950",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Order[] }>("sales", "/api/orders?limit=20").then((r) => {
      if (!r.error) setOrders(r.data.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="pb-6">
      <div
        className="relative overflow-hidden px-4 pb-10 pt-6 text-white md:px-8"
        style={{
          background:
            "linear-gradient(135deg, #121a16 0%, #1e3d32 55%, #3d4f2f 100%)",
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
          <h1 className="font-display mt-1 text-3xl font-semibold md:text-4xl">My orders</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Follow each order from sales review through pricing, dispatch and delivery.
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-5 px-4 md:px-8">
        {loading && (
          <div className="rounded-2xl bg-white py-16 text-center text-sm text-[var(--ink-soft)]/60 shadow-sm">
            Loading orders…
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-sm">
            <div
              className="h-36 bg-cover bg-center"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgba(18,26,22,0.7), transparent), url(https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80)",
              }}
            />
            <div className="px-6 py-8 text-center">
              <p className="font-display text-xl text-[var(--ink)]">No orders yet</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">Place your first site order from the shop.</p>
              <Link href="/products" className="btn-dark mt-5">
                Browse catalog
              </Link>
            </div>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((o) => {
              const style = STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-700";
              const firstItem = o.items?.[0]?.productName ?? o.items?.[0]?.name;
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="block overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-stretch">
                    <div className="w-1.5 bg-[var(--amber)]" />
                    <div className="flex flex-1 items-center gap-3 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--mist)] font-display text-sm font-bold text-[var(--forest)]">
                        {o.orderNumber.replace(/\D/g, "").slice(-3) || "SO"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[var(--ink)]">{o.orderNumber}</span>
                          <span className={`status-pill ${style}`}>{omsLabel(o.status)}</span>
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
