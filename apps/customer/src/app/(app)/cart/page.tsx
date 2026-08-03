"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, CartSummary, Container, PriceDisplay, QuantityStepper, SectionHeader } from "@erp/ui";
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

  return (
    <Container layout="wide" className="pb-28 pt-5 md:pb-32">
      <SectionHeader title="Your cart" />
      <p className="mb-6 -mt-2 text-sm text-[var(--ink-soft)]">
        {items.length === 0
          ? "Nothing here yet"
          : `${items.length} line${items.length === 1 ? "" : "s"} ready for checkout`}
      </p>

      {items.length === 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-white px-6 py-12 text-center">
          <p className="font-display text-xl text-[var(--ink)]">Cart is empty</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Browse materials and add configurations.</p>
          <Link href="/products" className="mt-5 inline-block">
            <Button variant="primary">Start shopping</Button>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={`${item.productId}-${item.variantId}`}
                className="flex gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--mist)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl || productImageUrl({ id: item.productId, name: item.name }, i)}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold text-[var(--ink)]">{item.name}</div>
                  <PriceDisplay amount={item.price} className="mt-1" size="sm" />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <QuantityStepper
                      value={item.qty}
                      onChange={(n) => handleQty(item.productId, item.variantId, n)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemove(item.productId, item.variantId)}
                      className="ml-auto text-xs font-semibold text-[var(--danger)]"
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

          <CartSummary
            className="mt-5"
            itemCount={items.length}
            totalLabel={`₹${subtotal.toLocaleString("en-IN")}`}
          />
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            GST is calculated from each product&apos;s tax rate when the order is created.
          </p>

          <div className="sticky bottom-0 z-[var(--z-sticky)] mt-6 border-t border-[var(--line)] bg-[var(--paper)]/95 py-3 backdrop-blur">
            <Button variant="secondary" size="block" onClick={() => router.push("/checkout")}>
              Proceed to checkout
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}
