"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";

interface OrderItem { id: string; name: string; sku: string; qty: number; unitPrice: number; total: number }
interface Order {
  id: string; orderNumber: string; status: string; total: number; subtotal: number;
  deliveryFee: number; couponDiscount: number; paymentMethod: string; paymentStatus: string;
  createdAt: string; deliveryAddress?: { line1: string; city: string; state: string; pincode: string };
  items: OrderItem[];
}

const STEPS = [
  { status: "DRAFT",            label: "Order Placed",      icon: "📋" },
  { status: "CONFIRMED",        label: "Confirmed",         icon: "✅" },
  { status: "AWAITING_PICKUP",  label: "Preparing",         icon: "📦" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery",  icon: "🚚" },
  { status: "DELIVERED",        label: "Delivered",         icon: "🎉" },
];

function stepIndex(status: string) {
  const i = STEPS.findIndex((s) => s.status === status);
  return i === -1 ? (status === "INVOICED" ? 4 : 0) : i;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const justPlaced = searchParams.get("placed") === "1";

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  useEffect(() => {
    if (!id) return;
    api<{ data: Order }>("sales", `/api/orders/${id}`).then((r) => {
      if (!r.error) setOrder(r.data.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;
  if (!order) return <div className="flex items-center justify-center py-16 text-gray-400">Order not found</div>;

  const current = stepIndex(order.status);
  const cancelled = order.status === "CANCELLED";

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-green-600 px-4 py-5 text-white">
        {justPlaced && <div className="mb-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium w-fit">🎉 Order placed successfully!</div>}
        <div className="text-xs opacity-80">Order</div>
        <div className="text-xl font-bold">{order.orderNumber}</div>
        <div className="text-xs opacity-70 mt-0.5">{new Date(order.createdAt).toLocaleString("en-IN")}</div>
      </div>

      {/* Progress tracker */}
      {!cancelled && (
        <div className="px-4 py-5">
          <div className="flex items-start">
            {STEPS.map((step, i) => (
              <div key={step.status} className="flex flex-1 flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-base
                  ${i <= current ? "bg-green-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {i <= current ? step.icon : "○"}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`absolute mt-4 h-0.5 w-full ${i < current ? "bg-green-600" : "bg-gray-200"}`} style={{ display: "none" }} />
                )}
                <div className={`mt-1 text-center text-[10px] leading-tight ${i <= current ? "text-green-700 font-medium" : "text-gray-400"}`}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="relative mt-2 mx-4">
            <div className="h-1 rounded-full bg-gray-200" />
            <div className="absolute top-0 left-0 h-1 rounded-full bg-green-600 transition-all"
              style={{ width: `${(current / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {cancelled && (
        <div className="mx-4 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">✕ This order was cancelled</div>
      )}

      {/* Delivery address */}
      {order.deliveryAddress && (
        <div className="mx-4 mt-1 rounded-xl bg-gray-50 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivering to</div>
          <div className="text-sm text-gray-800">
            {order.deliveryAddress.line1}, {order.deliveryAddress.city}, {order.deliveryAddress.state} – {order.deliveryAddress.pincode}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="px-4 mt-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</div>
        <div className="divide-y divide-gray-100 rounded-xl bg-white border border-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-gray-800">{item.name}</div>
                <div className="text-xs text-gray-400">Qty: {item.qty} × ₹{Number(item.unitPrice).toLocaleString("en-IN")}</div>
              </div>
              <div className="font-semibold text-gray-900">₹{Number(item.total).toLocaleString("en-IN")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bill summary */}
      <div className="mx-4 mt-4 rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(order.subtotal).toLocaleString("en-IN")}</span></div>
        {order.couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Coupon discount</span><span>−₹{Number(order.couponDiscount).toLocaleString("en-IN")}</span></div>}
        <div className="flex justify-between text-gray-600"><span>Delivery</span><span>{Number(order.deliveryFee) === 0 ? <span className="text-green-600">FREE</span> : `₹${order.deliveryFee}`}</span></div>
        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
          <span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Payment: {order.paymentMethod}</span>
          <span className={order.paymentStatus === "PAID" ? "text-green-600 font-medium" : ""}>{order.paymentStatus}</span>
        </div>
      </div>
    </div>
  );
}
