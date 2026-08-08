"use client";

import { cn } from "../utils";
import { PriceDisplay } from "./price-display";

/** @maturity stable */
export function ProductCard({
  href,
  title,
  subtitle,
  imageUrl,
  priceLabel,
  meta,
  className,
}: {
  href: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  priceLabel?: string;
  meta?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-[#e8e8e8] bg-white",
        "transition-transform duration-[var(--motion-fast)] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-1",
        className
      )}
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#f5f5f5]">
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
        <PriceDisplay
          amount={priceLabel ?? "Configure"}
          size="sm"
          className="mt-1"
        />
        {meta ? (
          <div className="mt-auto pt-0.5 text-[11px] text-[var(--ink-soft)]">{meta}</div>
        ) : null}
      </div>
    </a>
  );
}
