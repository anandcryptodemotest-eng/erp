"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { addToCart, clearCart } from "@/lib/cart-store";
import { OMS_TRACKER_STEPS, customerCanCancel, omsLabel, omsTrackerIndex } from "@/lib/oms-status";

interface OrderItem {
  id: string;
  productId: string;
  productName?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unitPrice: number;
  total: number;
  sku?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax?: number;
  deliveryFee: number;
  couponDiscount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string | null;
  createdAt: string;
  deliveryAddressText?: string | null;
  deliveryAddress?: { line1: string; city: string; state: string; pincode: string } | null;
  items: OrderItem[];
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const justPlaced = searchParams.get("placed") === "1";

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  function load(orderId: string) {
    setLoading(true);
    api<{ data: Order }>("sales", `/api/orders/${orderId}`).then((r) => {
      if (!r.error) setOrder(r.data.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function cancelOrder() {
    if (!order || !customerCanCancel(order.status)) return;
    if (!confirm("Cancel this order? Sales will stop processing it.")) return;
    setBusy(true);
    setMsg("");
    const res = await api("sales", `/api/orders/${order.id}?action=cancel`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    load(order.id);
  }

  function reorder() {
    if (!order?.items?.length) return;
    clearCart();
    for (const item of order.items) {
      const name = item.productName ?? item.name ?? "Item";
      const qty = item.quantity ?? item.qty ?? 1;
      try {
        addToCart({
          productId: item.productId,
          name,
          sku: item.sku ?? item.productId,
          price: Number(item.unitPrice),
          qty,
        });
      } catch {
        /* skip bad lines */
      }
    }
    router.push("/checkout");
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;
  if (!order) return <div className="flex items-center justify-center py-16 text-gray-400">Order not found</div>;

  const current = omsTrackerIndex(order.status);
  const cancelled = order.status === "CANCELLED";
  const canCancel = customerCanCancel(order.status);

  return (
    <div className="pb-28">
      <div className="bg-slate-900 px-4 py-5 text-white">
        {justPlaced && (
          <div className="mb-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium w-fit">
            Order submitted for sales review
          </div>
        )}
        <div className="text-xs opacity-80">Order</div>
        <div className="text-xl font-bold">{order.orderNumber}</div>
        <div className="mt-1 text-sm opacity-90">{omsLabel(order.status)}</div>
        <div className="text-xs opacity-70 mt-0.5">{new Date(order.createdAt).toLocaleString("en-IN")}</div>
      </div>

      {!cancelled && (
        <div className="px-4 py-5">
          <div className="flex items-start justify-between gap-1">
            {OMS_TRACKER_STEPS.map((step, i) => (
              <div key={step.status} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    i <= current ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`mt-1 text-center text-[10px] leading-tight ${
                    i <= current ? "text-slate-800 font-medium" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </div>
              </div>
            ))}
          </div>
          <div className="relative mt-3 mx-2">
            <div className="h-1 rounded-full bg-gray-200" />
            <div
              className="absolute top-0 left-0 h-1 rounded-full bg-slate-900 transition-all"
              style={{ width: `${(current / (OMS_TRACKER_STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {cancelled && (
        <div className="mx-4 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          This order was cancelled
        </div>
      )}

      {(order.deliveryAddress || order.deliveryAddressText) && (
        <div className="mx-4 mt-1 rounded-xl bg-gray-50 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivering to</div>
          <div className="text-sm text-gray-800">
            {order.deliveryAddress
              ? `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} – ${order.deliveryAddress.pincode}`
              : order.deliveryAddressText}
          </div>
        </div>
      )}

      {order.notes && (
        <div className="mx-4 mt-3 rounded-xl border border-gray-100 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      <div className="px-4 mt-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</div>
        <div className="divide-y divide-gray-100 rounded-xl bg-white border border-gray-100">
          {order.items.map((item) => {
            const name = item.productName ?? item.name ?? "Item";
            const qty = item.quantity ?? item.qty ?? 0;
            return (
              <div key={item.id} className="flex justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-gray-800">{name}</div>
                  <div className="text-xs text-gray-400">
                    Qty: {qty} × ₹{Number(item.unitPrice).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="font-semibold text-gray-900">₹{Number(item.total).toLocaleString("en-IN")}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-4 mt-4 rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>₹{Number(order.subtotal).toLocaleString("en-IN")}</span>
        </div>
        {order.couponDiscount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Coupon</span>
            <span>−₹{Number(order.couponDiscount).toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Delivery</span>
          <span>
            {Number(order.deliveryFee) === 0 ? (
              <span className="text-emerald-600">FREE</span>
            ) : (
              `₹${order.deliveryFee}`
            )}
          </span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
          <span>Total</span>
          <span>₹{Number(order.total).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {msg && <div className="mx-4 mt-3 text-sm text-red-600">{msg}</div>}

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-2 bg-white border-t border-gray-100 flex gap-2">
        <button
          type="button"
          onClick={reorder}
          className="mt-2 flex-1 rounded-full border border-slate-300 py-3 text-sm font-semibold text-slate-800"
        >
          Reorder
        </button>
        {canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={cancelOrder}
            className="mt-2 flex-1 rounded-full border border-red-200 py-3 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            {busy ? "Cancelling…" : "Cancel order"}
          </button>
        )}
      </div>
    </div>
  );
}
