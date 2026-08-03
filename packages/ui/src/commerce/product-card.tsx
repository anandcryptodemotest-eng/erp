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
        "group flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-white transition-[transform,box-shadow] duration-[var(--motion-standard)] ease-[var(--ease-out)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow)] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="aspect-square overflow-hidden bg-[var(--mist)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-[var(--motion-slow)] group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 text-sm font-semibold text-[var(--ink)]">{title}</div>
        {subtitle ? <div className="text-xs text-[var(--ink-soft)]">{subtitle}</div> : null}
        {priceLabel ? <PriceDisplay amount={priceLabel} className="mt-1" /> : null}
        {meta ? <div className="mt-auto pt-1 text-xs text-[var(--ink-soft)]/70">{meta}</div> : null}
      </div>
    </a>
  );
}
