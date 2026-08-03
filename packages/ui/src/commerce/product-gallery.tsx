"use client";

import { useState } from "react";
import { cn } from "../utils";

/** @maturity beta */
export function ProductGallery({
  images,
  alt = "",
  className,
}: {
  images: string[];
  alt?: string;
  className?: string;
}) {
  const list = images.filter(Boolean);
  const [idx, setIdx] = useState(0);
  const current = list[Math.min(idx, Math.max(0, list.length - 1))] ?? "";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="aspect-square overflow-hidden rounded-[var(--radius)] bg-[var(--mist)]">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current}
            src={current}
            alt={alt}
            className="h-full w-full object-cover animate-[fade-in_var(--motion-standard)_var(--ease-out)]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--ink-soft)]">
            No image
          </div>
        )}
      </div>
      {list.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-[border-color] duration-[var(--motion-fast)]",
                i === idx ? "border-[var(--forest)]" : "border-transparent opacity-80 hover:opacity-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
              )}
              aria-label={`Image ${i + 1}`}
              aria-pressed={i === idx}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
