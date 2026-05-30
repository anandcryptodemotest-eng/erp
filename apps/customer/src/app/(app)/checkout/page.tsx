"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { getCart, cartTotal, clearCart } from "@/lib/cart-store";

interface Address { id: string; label: string; line1: string; city: string; state: string; pincode: string; isDefault: boolean }
interface CustomerProfile { id: string; name: string; wallet: number; creditLimit: number }

export default function CheckoutPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "WALLET" | "UPI">("COD");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const items = getCart();
  const subtotal = cartTotal();
  const TAX_RATE = 0.05;
  const deliveryFee = subtotal >= 300 ? 0 : 30;
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const total = discountedSubtotal * (1 + TAX_RATE) + deliveryFee;

  useEffect(() => {
    // Load customer profile + addresses
    api<{ data: CustomerProfile[] }>("sales", "/api/customers?limit=1").then((r) => {
      if (!r.error && r.data.data.length > 0) {
        const cust = r.data.data[0];
        setProfile(cust);
        api<{ data: Address[] }>("sales", `/api/customers/${cust.id}/addresses`).then((a) => {
          if (!a.error) {
            setAddresses(a.data.data);
            const def = a.data.data.find((x) => x.isDefault);
            if (def) setSelectedAddr(def.id);
          }
        });
      }
    });
  }, []);

  async function applyCustomer() {
    if (!couponCode.trim()) return;
    setCouponMsg("");
    const res = await api<{ data: { discountAmount: number; message: string } }>(
      "gateway", "/api/coupons/validate",
      { method: "POST", body: JSON.stringify({ code: couponCode, orderAmount: subtotal }) }
    );
    if (res.error) { setCouponMsg(res.error); return; }
    setCouponDiscount(res.data.data.discountAmount);
    setCouponMsg(`✓ ${res.data.data.message}`);
  }

  async function placeOrder() {
    if (items.length === 0) return;
    if (!selectedAddr) { setError("Please select a delivery address"); return; }
    setPlacing(true); setError("");

    const body = {
      isOnlineOrder: true,
      deliveryAddressId: selectedAddr,
      deliveryFee,
      paymentMethod,
      couponCode: couponCode || undefined,
      couponDiscount,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        sku: i.sku,
        qty: i.qty,
        unitPrice: i.price,
      })),
    };

    const res = await api<{ data: { id: string; orderNumber: string } }>(
      "sales", "/api/orders",
      { method: "POST", body: JSON.stringify(body) }
    );
    setPlacing(false);
    if (res.error) { setError(res.error); return; }
    clearCart();
    router.push(`/orders/${res.data.data.id}?placed=1`);
  }

  if (items.length === 0) {
    router.replace("/cart");
    return null;
  }

  return (
    <div className="pb-32">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
      </div>

      {/* Delivery address */}
      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Delivery Address</h2>
        {addresses.length === 0 ? (
          <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-700">
            No saved addresses. Please add one in your profile.
          </div>
        ) : (
          <div className="space-y-2">
            {addresses.map((a) => (
              <button key={a.id} onClick={() => setSelectedAddr(a.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedAddr === a.id ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}>
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${selectedAddr === a.id ? "border-green-600 bg-green-600" : "border-gray-300"}`} />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{a.label}</span>
                    {a.isDefault && <span className="ml-2 text-xs text-green-600">Default</span>}
                    <div className="text-xs text-gray-500 mt-0.5">{a.line1}, {a.city} – {a.pincode}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Payment method */}
      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment</h2>
        <div className="space-y-2">
          {(["COD", "WALLET", "UPI"] as const).map((method) => (
            <button key={method} onClick={() => setPaymentMethod(method)}
              className={`w-full rounded-xl border p-3 text-left flex items-center gap-3 transition-colors ${paymentMethod === method ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}>
              <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${paymentMethod === method ? "border-green-600 bg-green-600" : "border-gray-300"}`} />
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {method === "COD" ? "💵 Cash on Delivery" : method === "WALLET" ? `👛 Wallet ${profile ? `(₹${Number(profile.wallet).toLocaleString("en-IN")})` : ""}` : "📱 UPI"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Coupon */}
      <section className="px-4 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Coupon</h2>
        <div className="flex gap-2">
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-green-500" />
          <button onClick={applyCustomer}
            className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
        </div>
        {couponMsg && <div className={`mt-1.5 text-xs ${couponMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{couponMsg}</div>}
      </section>

      {/* Order summary */}
      <div className="mx-4 rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Items ({items.length})</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
        {couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Coupon discount</span><span>−₹{couponDiscount.toLocaleString("en-IN")}</span></div>}
        <div className="flex justify-between text-gray-600"><span>Tax (5%)</span><span>₹{(discountedSubtotal * TAX_RATE).toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Delivery</span><span>{deliveryFee === 0 ? <span className="text-green-600">FREE</span> : `₹${deliveryFee}`}</span></div>
        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
          <span>Total</span><span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      {error && <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      {/* Place order */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-2 bg-white border-t border-gray-100">
        <button onClick={placeOrder} disabled={placing}
          className="mt-2 w-full rounded-full bg-green-600 py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {placing ? "Placing order…" : `Place Order  ₹${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
