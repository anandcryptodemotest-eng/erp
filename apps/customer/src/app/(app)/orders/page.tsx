"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface Order { id: string; orderNumber: string; status: string; total: number; createdAt: string; items?: { name: string }[] }

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT:             { label: "Pending",          color: "bg-gray-100 text-gray-600",    icon: "🕐" },
  CONFIRMED:         { label: "Confirmed",         color: "bg-blue-100 text-blue-700",    icon: "✅" },
  AWAITING_PICKUP:   { label: "Awaiting Pickup",   color: "bg-yellow-100 text-yellow-700",icon: "📦" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",  color: "bg-orange-100 text-orange-700",icon: "🚚" },
  DELIVERED:         { label: "Delivered",          color: "bg-green-100 text-green-700",  icon: "🎉" },
  INVOICED:          { label: "Invoiced",           color: "bg-purple-100 text-purple-700",icon: "🧾" },
  CANCELLED:         { label: "Cancelled",          color: "bg-red-100 text-red-600",      icon: "✕"  },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Order[] }>("sales", "/api/orders?isOnlineOrder=true&limit=20").then((r) => {
      if (!r.error) setOrders(r.data.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="pb-4">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <div className="text-5xl">📦</div>
          <div className="mt-3 text-base font-medium">No orders yet</div>
          <Link href="/products"
            className="mt-4 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white">
            Start Shopping
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="divide-y divide-gray-100 px-4">
          {orders.map((o) => {
            const st = STATUS_LABEL[o.status] ?? { label: o.status, color: "bg-gray-100 text-gray-600", icon: "📋" };
            return (
              <Link key={o.id} href={`/orders/${o.id}`}
                className="flex items-center gap-3 py-4 active:bg-gray-50">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl">{st.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{o.orderNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <div className="text-sm font-bold text-gray-900">₹{Number(o.total).toLocaleString("en-IN")}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
