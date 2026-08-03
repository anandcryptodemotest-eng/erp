"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/admin-api";

const MAX_IMAGES = 4;
const ACCEPT = "image/jpeg,image/png,image/webp";

export type ProductMediaGalleryProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  /** Shown under the Media heading */
  helperText?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  /** Larger studio layout — gallery occupies more space */
  variant?: "default" | "studio";
};

/**
 * Shared commercial media gallery (images today).
 * Upload · drag & drop · reorder · remove · primary = index 0.
 */
export function ProductMediaGallery({
  value,
  onChange,
  helperText,
  disabled,
  onError,
  variant = "default",
}: ProductMediaGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const studio = variant === "studio";
  const tile = studio ? "h-32 w-32 sm:h-36 sm:w-36" : "h-24 w-24";

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).slice(0, Math.max(0, MAX_IMAGES - value.length));
      if (!list.length || disabled) return;
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const file of list) {
          const fd = new FormData();
          fd.append("file", file);
          const r = await api("/api/uploads/product-image", { method: "POST", body: fd });
          if (r?.data?.url) uploaded.push(r.data.url as string);
        }
        if (uploaded.length) onChange([...value, ...uploaded].slice(0, MAX_IMAGES));
      } catch (e: unknown) {
        onError?.(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [value, onChange, disabled, onError]
  );

  function removeAt(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function makePrimary(idx: number) {
    if (idx <= 0) return;
    const next = [...value];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    onChange(next);
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--ink)]">
          Gallery
          <span className="ml-2 font-normal text-xs text-[var(--ink-soft)]">
            {value.length}/{MAX_IMAGES} · Primary · Drag to reorder
          </span>
        </div>
      </div>
      {helperText ? <p className="text-xs text-[var(--ink-soft)] mb-3">{helperText}</p> : null}
      <div
        className={`flex flex-wrap gap-3 items-start rounded-xl p-2 transition-colors ${
          dragOver ? "bg-[var(--mist)] ring-2 ring-[var(--brand)]/30 ring-dashed" : ""
        } ${studio ? "min-h-[11rem] border border-dashed border-[var(--line)] bg-[var(--mist)]/40" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && value.length < MAX_IMAGES) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || value.length >= MAX_IMAGES) return;
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
      >
        {value.map((url, idx) => (
          <div
            key={url}
            draggable={!disabled}
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragIndex != null) reorder(dragIndex, idx);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`relative ${tile} rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--mist)] group cursor-grab active:cursor-grabbing shadow-[var(--shadow-sm)] transition-transform duration-[var(--motion-fast)] studio-fade-in`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {idx === 0 ? "Primary" : `#${idx + 1}`}
            </span>
            <span
              className="absolute right-1.5 bottom-1.5 rounded bg-black/50 px-1 py-0.5 text-[10px] text-white/90 opacity-0 group-hover:opacity-100"
              aria-hidden
            >
              ⋮⋮
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeAt(url)}
              className="absolute right-1.5 top-1.5 hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs disabled:opacity-40"
              aria-label="Remove image"
            >
              ×
            </button>
            {idx > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => makePrimary(idx)}
                className="absolute bottom-1.5 left-1.5 hidden group-hover:inline-flex rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-40"
              >
                Make primary
              </button>
            )}
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <label
            className={`flex ${tile} cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--surface-raised)] text-center text-xs text-[var(--ink-soft)] hover:border-[var(--brand-mid)] hover:text-[var(--ink)] transition-colors ${
              disabled || uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
              }}
            />
            <span className="text-2xl font-light leading-none text-[var(--ink-soft)]">+</span>
            <span className="mt-1 font-medium">{uploading ? "Uploading…" : "Add"}</span>
          </label>
        )}
        {studio && value.length === 0 && !uploading && (
          <p className="w-full self-center py-2 text-center text-xs text-[var(--ink-soft)]">
            Drop images here or click Add · JPG/PNG/WebP · max 2 MB
          </p>
        )}
      </div>
      {!studio && (
        <p className="mt-2 text-[11px] text-[var(--ink-soft)]">
          Up to {MAX_IMAGES} · JPG/PNG/WebP · max 2 MB · first is primary · drag &amp; drop supported
        </p>
      )}
    </div>
  );
}
