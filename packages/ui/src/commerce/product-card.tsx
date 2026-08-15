"use client";

import { cn } from "../utils";
import { PriceDisplay } from "./price-display";

export type ProductCardPurchaseMode = "fixed" | "configure";

/** @maturity stable — fixed [+] vs configure “View product →” */
export function ProductCard({
  href,
  title,
  subtitle,
  specs,
  imageUrl,
  priceLabel,
  meta,
  purchaseMode = "configure",
  onQuickAdd,
  className,
}: {
  href: string;
  title: string;
  subtitle?: string;
  /** Spec lines e.g. "Commercial · 19mm", "8 × 4 ft" */
  specs?: string[];
  imageUrl: string;
  priceLabel?: string;
  meta?: string;
  purchaseMode?: ProductCardPurchaseMode;
  /** Fixed-price quick-add; stopPropagation so the card link does not navigate. */
  onQuickAdd?: () => void;
  className?: string;
}) {
  const isFixed = purchaseMode === "fixed" && typeof onQuickAdd === "function";

  return (
    <a
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-[#e8e8e8] bg-white",
        "transition-transform duration-[var(--motion-fast)] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-1",
        className
      )}
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#f0f0f0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        {subtitle ? (
          <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            {subtitle}
          </div>
        ) : null}
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--ink)]">
          {title}
        </div>
        {specs && specs.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">
            {specs.slice(0, 2).map((line) => (
              <div key={line} className="truncate text-[11px] text-[var(--ink-soft)]">
                {line}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceDisplay amount={priceLabel ?? "Price on request"} size="sm" className="min-w-0" />
          {isFixed ? (
            <button
              type="button"
              aria-label={`Add ${title} to cart`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickAdd?.();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--forest)] text-lg font-bold leading-none text-white shadow-sm hover:brightness-110 active:scale-95"
            >
              +
            </button>
          ) : (
            <span className="shrink-0 text-[11px] font-semibold text-[var(--forest)]">
              View →
            </span>
          )}
        </div>
        {meta ? (
          <div className="pt-0.5 text-[10px] text-[var(--ink-soft)]">{meta}</div>
        ) : null}
      </div>
    </a>
  );
}
