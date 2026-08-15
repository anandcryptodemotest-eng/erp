"use client";

import { useRef, useState } from "react";
import type { PlacedItem } from "@erp/documents";
import { LOGO_SIZE_PRESETS, recommendedLogoPixels } from "@erp/documents";

export function LogoImageControls({
  item,
  readOnly,
  onUploadImage,
  onPatch,
}: {
  item: PlacedItem;
  readOnly: boolean;
  onUploadImage?: (file: File) => Promise<string>;
  onPatch: (patch: Partial<PlacedItem>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const boxW = item.placement.width;
  const boxH = item.placement.height ?? 48;
  const rec = recommendedLogoPixels(boxW, boxH);
  const src = typeof item.properties?.src === "string" ? item.properties.src : "";

  async function onFile(file: File | undefined) {
    if (!file || !onUploadImage || readOnly) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onUploadImage(file);
      onPatch({ properties: { src: url } });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="erp-doc-designer__section">
      <h3>Image</h3>

      {src ? (
        <div style={{ marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Logo preview"
            style={{
              maxWidth: "100%",
              maxHeight: 72,
              objectFit: "contain",
              border: "1px solid #e7e5e4",
              borderRadius: 4,
              background: "#fafaf9",
            }}
          />
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "#78716c", marginBottom: 8 }}>
          No template image yet. Upload one, or bind a URL path from the document payload.
        </p>
      )}

      <label className="erp-doc-designer__field">
        Image URL
        <input
          disabled={readOnly}
          value={src}
          placeholder="/uploads/… or https://…"
          onChange={(e) => onPatch({ properties: { src: e.target.value } })}
        />
      </label>

      {onUploadImage && !readOnly && (
        <div style={{ marginBottom: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="erp-doc-designer__palette-btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          {src && (
            <button
              type="button"
              className="erp-doc-designer__palette-btn erp-doc-designer__palette-btn--danger"
              style={{ marginLeft: 4 }}
              onClick={() => onPatch({ properties: { src: "" } })}
            >
              Clear
            </button>
          )}
          {uploadError && (
            <p style={{ color: "#b91c1c", fontSize: 11, marginTop: 4 }}>{uploadError}</p>
          )}
        </div>
      )}

      <label className="erp-doc-designer__field">
        Box size preset
        <select
          disabled={readOnly}
          value=""
          onChange={(e) => {
            const preset = LOGO_SIZE_PRESETS.find((p) => p.id === e.target.value);
            if (!preset) return;
            onPatch({
              placement: {
                ...item.placement,
                width: preset.width,
                height: preset.height,
              },
            });
          }}
        >
          <option value="">Apply preset… ({boxW}×{boxH} now)</option>
          {LOGO_SIZE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div
        style={{
          fontSize: 10,
          lineHeight: 1.45,
          color: "#57534e",
          background: "#f5f5f4",
          borderRadius: 4,
          padding: 8,
        }}
      >
        <strong>Clarity tip</strong>
        <br />
        Box on page: <strong>{boxW}×{boxH}</strong> pt (print units).
        <br />
        Upload at least <strong>{rec.w}×{rec.h} px</strong> (2×) for sharp screen/PDF.
        <br />
        For print-grade: <strong>{rec.printW}×{rec.printH} px</strong> (~300 dpi).
        <br />
        Prefer <strong>JPEG</strong> for PDF embedding (PNG works in HTML preview).
        Keep aspect ratio; the box uses contain fit.
      </div>
    </div>
  );
}
