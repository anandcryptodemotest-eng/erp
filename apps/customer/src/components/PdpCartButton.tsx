"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart } from "@erp/ui";
import { cartCount, subscribeCart } from "@/lib/cart-store";

/** Cart control for PDP sticky headers (shell hides global cart on these pages). */
export function PdpCartButton({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(cartCount());
    return subscribeCart(() => setCount(cartCount()));
  }, []);

  return (
    <Link
      href="/cart"
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--mist)] text-[var(--ink)] ${className ?? ""}`}
      aria-label={`Cart${count ? `, ${count} items` : ""}`}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
