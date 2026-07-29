"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { getCart, clearCart, saveCart, type CartItem } from "@/lib/cart-store";
import { productImageUrl } from "@/lib/media";

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state?: string | null;
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

const emptyAddr = {
  label: "Site",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: true,
};

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "WALLET" | "UPI">("COD");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [savingAddr, setSavingAddr] = useState(false);

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
      else setShowNewAddr(true);
      setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveNewAddress(): Promise<string | null> {
    if (!profile) return null;
    if (!addrForm.line1.trim() || !addrForm.city.trim() || !addrForm.pincode.trim()) {
      setError("Enter street, city and pincode for the delivery address");
      return null;
    }
    setSavingAddr(true);
    setError("");
    const res = await api<{ data: Address }>("sales", `/api/customers/${profile.id}/addresses`, {
      method: "POST",
      body: JSON.stringify({
        ...addrForm,
        isDefault: addresses.length === 0 ? true : addrForm.isDefault,
      }),
    });
    setSavingAddr(false);
    if (res.error || !res.data?.data?.id) {
      setError(res.error ?? "Could not save address");
      return null;
    }
    const created = res.data.data;
    setAddresses((prev) => [created, ...prev]);
    setSelectedAddr(created.id);
    setShowNewAddr(false);
    setAddrForm(emptyAddr);
    return created.id;
  }

  async function placeOrder() {
    if (items.length === 0) return;
    if (!profile) {
      setError("Customer profile not loaded");
      return;
    }

    let addressId = selectedAddr;
    if (showNewAddr || (!addressId && addresses.length === 0)) {
      const createdId = await saveNewAddress();
      if (!createdId) return;
      addressId = createdId;
    }
    if (!addressId) {
      setError("Please select or add a delivery address");
      return;
    }

    const bad = items.find((i) => !validPrice(i.price) || !i.productId || !i.name || !i.qty);
    if (bad) {
      setError("Cart has invalid items — clear cart and add products again");
      return;
    }

    setPlacing(true);
    setError("");

    const attrNotes = items
      .filter((i) => i.selectedAttributes && Object.keys(i.selectedAttributes).length)
      .map((i) => `${i.name}: ${JSON.stringify(i.selectedAttributes)}`)
      .join("; ");
    const combinedNotes = [notes.trim(), attrNotes].filter(Boolean).join("\n");

    const body = {
      customerId: profile.id,
      isOnlineOrder: true,
      deliveryAddressId: addressId,
      deliveryFee,
      paymentMethod,
      ...(combinedNotes ? { notes: combinedNotes } : {}),
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        ...(i.variantId ? { variantId: i.variantId } : {}),
        quantity: i.qty,
        unitPrice: Number(i.price),
      })),
    };

    const res = await api<{ data: { id: string; requestNumber: string; status: string } }>(
      "sales",
      "/api/sales-requests",
      { method: "POST", body: JSON.stringify(body) }
    );
    setPlacing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const sreq = res.data?.data;
    if (!sreq?.id) {
      setError("Request created but response was incomplete");
      return;
    }
    clearCart();
    router.push(`/orders/${sreq.id}?placed=1&type=sreq`);
  }

  if (!ready) {
    return <div className="flex justify-center py-16 text-sm text-[var(--ink-soft)]">Preparing checkout…</div>;
  }

  if (items.length === 0) return null;

  return (
    <div className="pb-32">
      <div className="px-4 py-4 md:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Checkout</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Place order</h1>
        {profile && <p className="mt-1 text-sm text-[var(--ink-soft)]">Ordering as {profile.name}</p>}
      </div>

      <section className="px-4 mb-4 md:px-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Items</h2>
        <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-3">
          {items.map((i, idx) => (
            <div key={`${i.productId}-${i.variantId ?? ""}`} className="flex items-center gap-3 text-sm">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--mist)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl || productImageUrl({ id: i.productId, name: i.name }, idx)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[var(--ink)] line-clamp-2">{i.name}</div>
                <div className="text-xs text-[var(--ink-soft)]">Qty {i.qty}</div>
              </div>
              <span className="font-semibold text-[var(--ink)]">
                ₹{(i.price * i.qty).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mb-4 md:px-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Delivery address
          </h2>
          {!showNewAddr && (
            <button
              type="button"
              onClick={() => setShowNewAddr(true)}
              className="text-xs font-bold text-[var(--forest-mid)]"
            >
              + Add new
            </button>
          )}
        </div>

        {addresses.length > 0 && !showNewAddr && (
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAddr(a.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedAddr === a.id
                    ? "border-[#121a16] bg-[#f3efe6]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <span className="text-sm font-semibold text-[var(--ink)]">{a.label}</span>
                <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  {a.line1}, {a.city} – {a.pincode}
                </div>
              </button>
            ))}
          </div>
        )}

        {(showNewAddr || addresses.length === 0) && (
          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {addresses.length === 0 ? "Add delivery address" : "New address"}
            </p>
            {(
              [
                { key: "label", ph: "Label (Site / Office)" },
                { key: "line1", ph: "Street / building / landmark" },
                { key: "city", ph: "City" },
                { key: "state", ph: "State" },
                { key: "pincode", ph: "Pincode" },
              ] as const
            ).map(({ key, ph }) => (
              <input
                key={key}
                placeholder={ph}
                value={addrForm[key]}
                onChange={(e) => setAddrForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c8922a]/40"
              />
            ))}
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={addrForm.isDefault}
                onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Set as default
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingAddr}
                onClick={() => void saveNewAddress()}
                className="btn-dark flex-1 py-2.5 text-sm disabled:opacity-60"
              >
                {savingAddr ? "Saving…" : "Save address"}
              </button>
              {addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewAddr(false)}
                  className="flex-1 rounded-full border border-[var(--line)] py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="px-4 mb-4 md:px-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
          Notes for sales
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Delivery instructions, preferred size confirmation, site contact…"
          className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c8922a]/40"
        />
      </section>

      <section className="px-4 mb-4 md:px-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Payment</h2>
        <div className="space-y-2">
          {(["COD", "UPI"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`w-full rounded-xl border p-3 text-left ${
                paymentMethod === method
                  ? "border-[#121a16] bg-[#f3efe6]"
                  : "border-[var(--line)] bg-white"
              }`}
            >
              <div className="text-sm font-medium text-[var(--ink)]">
                {method === "COD" ? "Cash on Delivery" : "UPI"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="mx-4 rounded-2xl bg-[#f3efe6] p-4 text-sm md:mx-8">
        <div className="flex justify-between text-[var(--ink-soft)]">
          <span>Items ({items.length}) excl. GST</span>
          <span>₹{subtotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 font-display text-lg font-semibold text-[var(--ink)]">
          <span>Submit total</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--ink-soft)]">
          GST is applied from each product’s tax rate when the order is created. Sales may adjust pricing later.
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 md:mx-8">{error}</div>
      )}

      <div className="sticky bottom-0 mt-4 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur md:px-8">
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing || !profile}
          className="btn-primary btn-primary-block disabled:opacity-60"
        >
          {placing ? "Submitting…" : `Submit for review  ₹${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
