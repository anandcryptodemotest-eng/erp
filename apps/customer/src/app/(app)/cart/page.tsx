"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCart, updateQty, removeFromCart, cartTotal, subscribeCart, type CartItem } from "@/lib/cart-store";
import { productImageUrl } from "@/lib/media";

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
    return subscribeCart(() => setItems(getCart()));
  }, []);

  function handleQty(productId: string, variantId: string | undefined, qty: number) {
    setItems(updateQty(productId, variantId, qty));
  }

  function handleRemove(productId: string, variantId?: string) {
    setItems(removeFromCart(productId, variantId));
  }

  const subtotal = cartTotal();
  // Cart shows catalogue sell prices only. GST is applied on the sales order
  // (product taxRate / pricing step) — not a hard-coded % here.
  const total = subtotal;

  return (
    <div className="pb-28 md:pb-32">
      <div className="px-4 pt-5 md:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Cart</p>
        <h1 className="font-display text-3xl font-semibold text-[var(--ink)]">Your order list</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]/70">
          {items.length === 0 ? "Nothing here yet" : `${items.length} line${items.length === 1 ? "" : "s"} ready for checkout`}
        </p>
      </div>

      {items.length === 0 && (
        <div className="mx-4 mt-10 overflow-hidden rounded-3xl border border-[var(--line)] bg-white md:mx-8">
          <div
            className="h-40 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(to top, rgba(18,26,22,0.65), transparent), url(https://images.unsplash.com/photo-1589939708026-92c8eba88eef?auto=format&fit=crop&w=1200&q=80)",
            }}
          />
          <div className="px-6 py-8 text-center">
            <p className="font-display text-xl text-[var(--ink)]">Cart is empty</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Browse plywood, sizes and site materials.</p>
            <Link href="/products" className="btn-dark mt-5">
              Start shopping
            </Link>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-6 space-y-3 px-4 md:px-8">
            {items.map((item, i) => (
              <div
                key={`${item.productId}-${item.variantId}`}
                className="flex gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--mist)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl || productImageUrl({ id: item.productId, name: item.name }, i)}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold text-[var(--ink)]">{item.name}</div>
                  <div className="mt-1 font-display text-base font-semibold text-[var(--forest)]">
                    ₹{Number(item.price).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQty(item.productId, item.variantId, item.qty - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-base font-bold text-[var(--ink-soft)]"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => handleQty(item.productId, item.variantId, item.qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-base font-bold text-[var(--ink-soft)]"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.productId, item.variantId)}
                      className="ml-auto text-xs font-semibold text-red-600/80"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="self-start text-sm font-bold text-[var(--ink)]">
                  ₹{(item.price * item.qty).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>

          <div className="mx-4 mt-5 rounded-2xl border border-[var(--line)] bg-[#121a16] p-5 text-white md:mx-8">
            <div className="flex justify-between text-sm text-white/70">
              <span>Subtotal (excl. GST)</span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-2 text-xs text-white/55 leading-relaxed">
              GST is calculated from each product’s tax rate when the order is created, and may be adjusted by sales/pricing.
            </div>
            <div className="mt-3 flex justify-between border-t border-white/15 pt-3 font-display text-xl font-semibold">
              <span>Items total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="sticky bottom-0 z-40 mt-6 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur md:px-8">
            <button type="button" onClick={() => router.push("/checkout")} className="btn-primary btn-primary-block">
              Proceed to checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
