"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { getCart, clearCart, saveCart, type CartItem } from "@/lib/cart-store";

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}
interface CustomerProfile {
  id: string;
  name: string;
  wallet: number;
  addresses?: Address[];
}

function validPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "WALLET" | "UPI">("COD");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const cart = getCart();
      if (cart.length === 0) {
        router.replace("/cart");
        return;
      }

      // Refresh prices from catalog (fixes carts saved with undefined/NaN sell price)
      const fixed: CartItem[] = [];
      for (const line of cart) {
        let price = line.price;
        if (!validPrice(price)) {
          const res = await api<{ data: { sellPrice?: number; name?: string } }>(
            "inventory",
            `/api/products/${line.productId}`
          );
          const sell = res.data?.data?.sellPrice;
          if (!validPrice(sell)) {
            if (!cancelled) {
              setError(`Could not load price for ${line.name || line.productId}. Remove it and re-add.`);
            }
            continue;
          }
          price = sell;
          if (res.data?.data?.name) line.name = res.data.data.name;
        }
        fixed.push({ ...line, price, variantId: line.variantId || undefined });
      }

      if (cancelled) return;
      if (fixed.length === 0) {
        clearCart();
        router.replace("/products");
        return;
      }
      saveCart(fixed);
      setItems(fixed);

      const profileRes = await api<{ data: CustomerProfile }>("sales", "/api/customers/me");
      if (cancelled) return;
      if (profileRes.error || !profileRes.data?.data) {
        setError(profileRes.error ?? "Could not load customer profile");
        setReady(true);
        return;
      }
      const cust = profileRes.data.data;
      setProfile(cust);
      const addrs = cust.addresses ?? [];
      setAddresses(addrs);
      const def = addrs.find((x) => x.isDefault) ?? addrs[0];
      if (def) setSelectedAddr(def.id);
      setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function placeOrder() {
    if (items.length === 0) return;
    if (!profile) {
      setError("Customer profile not loaded");
      return;
    }
    if (!selectedAddr && addresses.length > 0) {
      setError("Please select a delivery address");
      return;
    }

    const bad = items.find((i) => !validPrice(i.price) || !i.productId || !i.name || !i.qty);
    if (bad) {
      setError("Cart has invalid items — clear cart and add products again");
      return;
    }

    setPlacing(true);
    setError("");

    const body = {
      customerId: profile.id,
      date: new Date().toISOString(),
      isOnlineOrder: true,
      submitForReview: true,
      ...(selectedAddr ? { deliveryAddressId: selectedAddr } : {}),
      deliveryFee,
      paymentMethod,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        ...(i.variantId ? { variantId: i.variantId } : {}),
        quantity: i.qty,
        unitPrice: Number(i.price),
      })),
    };

    const res = await api<{ data: { id: string; orderNumber: string; status: string } }>(
      "sales",
      "/api/orders",
      { method: "POST", body: JSON.stringify(body) }
    );
    setPlacing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const order = res.data?.data;
    if (!order?.id) {
      setError("Order created but response was incomplete");
      return;
    }
    clearCart();
    router.push(`/orders/${order.id}?placed=1`);
  }

  if (!ready) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">Preparing checkout…</div>;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pb-32">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        {profile && <p className="text-sm text-gray-500 mt-1">Ordering as {profile.name}</p>}
      </div>

      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Items</h2>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-sm">
          {items.map((i) => (
            <div key={`${i.productId}-${i.variantId ?? ""}`} className="flex justify-between gap-2">
              <span className="text-gray-800">
                {i.name} × {i.qty}
              </span>
              <span className="font-medium text-gray-900">₹{(i.price * i.qty).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Delivery Address</h2>
        {addresses.length === 0 ? (
          <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-700">
            No saved addresses — order will still submit for sales review.
          </div>
        ) : (
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAddr(a.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedAddr === a.id ? "border-slate-900 bg-slate-50" : "border-gray-200 bg-white"
                }`}
              >
                <span className="text-sm font-medium text-gray-800">{a.label}</span>
                <div className="text-xs text-gray-500 mt-0.5">
                  {a.line1}, {a.city} – {a.pincode}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment</h2>
        <div className="space-y-2">
          {(["COD", "UPI"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`w-full rounded-xl border p-3 text-left ${
                paymentMethod === method ? "border-slate-900 bg-slate-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="text-sm font-medium text-gray-800">
                {method === "COD" ? "Cash on Delivery" : "UPI"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="mx-4 rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Items ({items.length})</span>
          <span>₹{subtotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
          <span>Total</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-500 pt-1">Order goes to Sales for review (OMS Trading).</p>
      </div>

      {error && <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-2 bg-white border-t border-gray-100">
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing || !profile}
          className="mt-2 w-full rounded-full bg-slate-900 py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {placing ? "Submitting…" : `Submit for review  ₹${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
