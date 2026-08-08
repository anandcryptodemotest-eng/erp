"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, subscribeCart } from "@/lib/cart-store";
import { IconCart } from "@/components/nav-icons";

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
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f1f3f2] text-[var(--ink)] ${className ?? ""}`}
      aria-label={`Cart${count ? `, ${count} items` : ""}`}
    >
      <IconCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
