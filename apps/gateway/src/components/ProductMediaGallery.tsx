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
}: ProductMediaGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <div>
      {helperText ? <p className="text-xs text-gray-400 mb-3">{helperText}</p> : null}
      <div
        className={`flex flex-wrap gap-3 items-start rounded-xl p-1 transition-colors ${
          dragOver ? "bg-gray-50 ring-2 ring-gray-300 ring-dashed" : ""
        }`}
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
            className="relative h-24 w-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {idx === 0 && (
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Primary
              </span>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeAt(url)}
              className="absolute right-1 top-1 hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs disabled:opacity-40"
              aria-label="Remove image"
            >
              ×
            </button>
            {idx > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => makePrimary(idx)}
                className="absolute bottom-1 left-1 hidden group-hover:inline-flex rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-40"
              >
                Make primary
              </button>
            )}
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <label
            className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-center text-xs text-gray-500 hover:border-gray-500 hover:text-gray-800 ${
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
            {uploading ? "Uploading…" : "+ Add"}
          </label>
        )}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Up to {MAX_IMAGES} · JPG/PNG/WebP · max 2 MB · first is primary · drag &amp; drop supported
      </p>
    </div>
  );
}
