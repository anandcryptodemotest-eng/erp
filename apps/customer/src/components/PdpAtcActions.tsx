"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@erp/ui";
import { cartCount, subscribeCart } from "@/lib/cart-store";

/**
 * Sticky ATC actions: always offer Add when available; Go to cart whenever
 * the cart already has lines (not only right after a successful add).
 */
export function PdpAtcActions(props: {
  canAdd: boolean;
  onAdd: () => void;
  addLabel?: string;
  disabledLabel?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(cartCount());
    return subscribeCart(() => setCount(cartCount()));
  }, []);

  const addLabel = props.addLabel ?? "Add to Cart";
  const disabledLabel = props.disabledLabel ?? addLabel;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="md"
        className={`!rounded-md ${count > 0 ? "" : "flex-1 sm:flex-none"} !min-w-[9rem]`}
        disabled={!props.canAdd}
        onClick={props.onAdd}
      >
        {props.canAdd ? addLabel : disabledLabel}
      </Button>
      {count > 0 ? (
        <Link
          href="/cart"
          className="inline-flex min-h-[var(--control-h)] min-w-[8rem] flex-1 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--surface-raised)] px-4 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-1)] hover:bg-[var(--surface-sunken)] sm:flex-none"
        >
          Go to cart{count > 1 ? ` (${count})` : ""}
        </Link>
      ) : null}
    </>
  );
}
