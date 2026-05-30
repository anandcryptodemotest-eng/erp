"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCart, updateQty, removeFromCart, cartTotal, CartItem } from "@/lib/cart-store";

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => { setItems(getCart()); }, []);

  function handleQty(productId: string, variantId: string | undefined, qty: number) {
    setItems(updateQty(productId, variantId, qty));
  }

  function handleRemove(productId: string, variantId?: string) {
    setItems(removeFromCart(productId, variantId));
  }

  const subtotal = cartTotal();
  const TAX_RATE = 0.05;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  return (
    <div className="pb-28">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Cart</h1>
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <div className="text-5xl">🛒</div>
          <div className="mt-3 text-base font-medium">Your cart is empty</div>
          <Link href="/products"
            className="mt-4 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white">
            Start Shopping
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="divide-y divide-gray-100 px-4">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex gap-3 py-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-2xl">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain rounded-xl" /> : "🥬"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 line-clamp-2">{item.name}</div>
                  <div className="mt-1 text-sm font-bold text-green-700">₹{Number(item.price).toLocaleString("en-IN")}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => handleQty(item.productId, item.variantId, item.qty - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-base font-bold text-gray-600">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                    <button onClick={() => handleQty(item.productId, item.variantId, item.qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-base font-bold text-gray-600">+</button>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => handleRemove(item.productId, item.variantId)}
                    className="text-xs text-gray-400 hover:text-red-500">✕</button>
                  <div className="text-sm font-bold text-gray-900">
                    ₹{(item.price * item.qty).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Price summary */}
          <div className="mx-4 mt-2 rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (5%)</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout button */}
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-2 bg-white border-t border-gray-100">
            <button onClick={() => router.push("/checkout")}
              className="mt-2 w-full rounded-full bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700">
              Proceed to Checkout  →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
