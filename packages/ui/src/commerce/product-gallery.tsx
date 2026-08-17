"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "../utils";

/**
 * Flipkart-style product media:
 * - Compact main stage (does not dominate the viewport)
 * - Horizontal scroll thumbs
 * - Tap/click expands to a lightbox
 *
 * @maturity beta
 */
export function ProductGallery({
  images,
  alt = "",
  className,
  /** compact = e‑commerce PDP (default); hero = larger stage */
  size = "compact",
}: {
  images: string[];
  alt?: string;
  className?: string;
  size?: "compact" | "hero";
}) {
  const list = images.filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const current = list[Math.min(idx, Math.max(0, list.length - 1))] ?? "";

  const close = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && list.length > 1) {
        setIdx((i) => (i + 1) % list.length);
      }
      if (e.key === "ArrowLeft" && list.length > 1) {
        setIdx((i) => (i - 1 + list.length) % list.length);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded, close, list.length]);

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${idx}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [idx]);

  const stageClass =
    size === "hero"
      ? "aspect-[4/3] max-h-[min(42vh,360px)] md:aspect-square md:max-h-[min(48vh,420px)]"
      : // Compact PDP: short stage on phone/app; slightly taller on desktop sidebar
        "h-[148px] max-h-[32dvh] w-full sm:h-[160px] md:h-[200px] md:max-h-[240px] md:aspect-auto";

  return (
    <div className={cn("w-full max-w-[240px] space-y-1.5 sm:max-w-[260px] md:max-w-none", className)}>
      <button
        type="button"
        onClick={() => current && setExpanded(true)}
        className={cn(
          "group relative mx-auto block w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--mist)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
          "active:scale-[0.99] touch-manipulation",
          stageClass
        )}
        aria-label={current ? `View larger image of ${alt || "product"}` : "No image"}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current}
            src={current}
            alt={alt}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--ink-soft)]">
            No image
          </div>
        )}
        {current ? (
          <span
            className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
            aria-hidden
            title="Expand"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}
        {list.length > 1 ? (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {idx + 1}/{list.length}
          </span>
        ) : null}
      </button>

      {list.length > 1 ? (
        <div
          ref={stripRef}
          className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label="Product images"
        >
          {list.map((url, i) => (
            <button
              key={url + i}
              type="button"
              data-thumb={i}
              onClick={() => setIdx(i)}
              className={cn(
                "h-10 w-10 shrink-0 overflow-hidden rounded border-2 bg-[var(--mist)] transition-[border-color] duration-[var(--motion-fast)] touch-manipulation md:h-11 md:w-11",
                i === idx ? "border-[var(--forest)]" : "border-transparent opacity-80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
              )}
              aria-label={`Image ${i + 1}`}
              aria-selected={i === idx}
              role="option"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {expanded && current ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/92 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="flex items-center justify-between px-3 py-2.5 text-white">
            <p id={titleId} className="truncate text-sm font-semibold">
              {alt || "Product image"}
              {list.length > 1 ? (
                <span className="ml-2 font-normal text-white/70">
                  {idx + 1} / {list.length}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/15 text-lg font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {list.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-1 z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/15 text-2xl text-white md:left-4"
                  aria-label="Previous image"
                  onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="absolute right-1 z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/15 text-2xl text-white md:right-4"
                  aria-label="Next image"
                  onClick={() => setIdx((i) => (i + 1) % list.length)}
                >
                  ›
                </button>
              </>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={alt}
              className="max-h-full max-w-full object-contain"
              onClick={close}
              draggable={false}
            />
          </div>

          {list.length > 1 ? (
            <div className="flex justify-center gap-1.5 overflow-x-auto px-3 py-3">
              {list.map((url, i) => (
                <button
                  key={`lb-${url}-${i}`}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={cn(
                    "h-11 w-11 shrink-0 touch-manipulation overflow-hidden rounded-md border-2",
                    i === idx ? "border-white" : "border-transparent opacity-60"
                  )}
                  aria-label={`Show image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
