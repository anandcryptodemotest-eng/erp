import type { CartItem } from "@erp/types";
export type { CartItem } from "@erp/types";

// Cart stored in localStorage — no server-side cart needed

const KEY = "customer_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const existing = cart.find(
    (c) => c.productId === item.productId && c.variantId === item.variantId
  );
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function updateQty(productId: string, variantId: string | undefined, qty: number): CartItem[] {
  const cart = getCart().map((c) => {
    if (c.productId === productId && c.variantId === variantId) {
      return { ...c, qty };
    }
    return c;
  }).filter((c) => c.qty > 0);
  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string, variantId?: string): CartItem[] {
  const cart = getCart().filter(
    (c) => !(c.productId === productId && c.variantId === variantId)
  );
  saveCart(cart);
  return cart;
}

export function clearCart(): void {
  saveCart([]);
}

export function cartCount(): number {
  return getCart().reduce((sum, c) => sum + c.qty, 0);
}

export function cartTotal(): number {
  return getCart().reduce((sum, c) => sum + c.price * c.qty, 0);
}
