import type { CartItem } from "@erp/types";
import { storage } from "@/lib/platform/storage";
export type { CartItem } from "@erp/types";

const KEY = "customer_cart";

/** Dispatched on same-tab cart mutations so nav badge / cart page can refresh live */
export const CART_CHANGED_EVENT = "erp:cart-changed";

function notifyCartChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export function lineAmount(item: CartItem): number {
  if (typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal)) {
    return item.lineTotal;
  }
  return item.price * item.qty;
}

function withLineTotal(item: CartItem): CartItem {
  return { ...item, lineTotal: item.price * item.qty };
}

export function getCart(): CartItem[] {
  try {
    return JSON.parse(storage.get(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  storage.set(KEY, JSON.stringify(items));
  notifyCartChanged();
}

export function addToCart(item: CartItem): CartItem[] {
  if (!item.productId || !item.name || !Number.isFinite(item.price) || item.price < 0 || item.qty < 1) {
    throw new Error("Invalid cart item — missing name or price");
  }
  const cart = getCart();
  const incoming = withLineTotal(item);
  const existing = cart.find(
    (c) => c.productId === item.productId && c.variantId === item.variantId
  );
  if (existing) {
    existing.qty += item.qty;
    existing.price = item.price;
    existing.name = item.name;
    existing.pricingBasis = item.pricingBasis ?? existing.pricingBasis;
    existing.rateAmount = item.rateAmount ?? existing.rateAmount;
    existing.rateUom = item.rateUom ?? existing.rateUom;
    existing.measureQuantity = item.measureQuantity ?? existing.measureQuantity;
    existing.measureUom = item.measureUom ?? existing.measureUom;
    existing.resolvedQuantity =
      existing.measureQuantity != null
        ? existing.measureQuantity * existing.qty
        : item.resolvedQuantity;
    existing.billLines = item.billLines ?? existing.billLines;
    existing.selectedAttributes = item.selectedAttributes ?? existing.selectedAttributes;
    existing.lineTotal = existing.price * existing.qty;
  } else {
    cart.push({ ...incoming, variantId: item.variantId || undefined });
  }
  saveCart(cart);
  return cart;
}

export function updateQty(productId: string, variantId: string | undefined, qty: number): CartItem[] {
  const cart = getCart()
    .map((c) => {
      if (c.productId === productId && c.variantId === variantId) {
        const next = { ...c, qty };
        next.lineTotal = next.price * qty;
        if (next.measureQuantity != null) {
          next.resolvedQuantity = next.measureQuantity * qty;
        }
        if (next.billLines?.length) {
          next.billLines = next.billLines.map((row) =>
            row.label === "Quantity" ? { ...row, value: String(qty) } : row
          );
        }
        return next;
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
  return getCart().reduce((sum, c) => sum + lineAmount(c), 0);
}

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
