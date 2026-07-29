import type { CartItem } from "@erp/types";
export type { CartItem } from "@erp/types";

// Cart stored in localStorage — no server-side cart needed

const KEY = "customer_cart";

/** Dispatched on same-tab cart mutations so nav badge / cart page can refresh live */
export const CART_CHANGED_EVENT = "erp:cart-changed";

function notifyCartChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

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
  notifyCartChanged();
}

export function addToCart(item: CartItem): CartItem[] {
  if (!item.productId || !item.name || !Number.isFinite(item.price) || item.price < 0 || item.qty < 1) {
    throw new Error("Invalid cart item — missing name or price");
  }
  const cart = getCart();
  const existing = cart.find(
    (c) => c.productId === item.productId && c.variantId === item.variantId
  );
  if (existing) {
    existing.qty += item.qty;
    // Keep latest catalog price when re-adding
    existing.price = item.price;
    existing.name = item.name;
  } else {
    cart.push({ ...item, variantId: item.variantId || undefined });
  }
  saveCart(cart);
  return cart;
}

export function updateQty(productId: string, variantId: string | undefined, qty: number): CartItem[] {
  const cart = getCart()
    .map((c) => {
      if (c.productId === productId && c.variantId === variantId) {
        return { ...c, qty };
      }
      return c;
    })
    .filter((c) => c.qty > 0);
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

/** Subscribe to live cart updates (same tab + other tabs). Returns unsubscribe. */
export function subscribeCart(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener(CART_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
