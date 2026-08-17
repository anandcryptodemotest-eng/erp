import { getByPath } from "./formatters";
import type { PlacedItem } from "./types";

/** Widget / primitive source. `path` wins exclusively when set — never fall back to `text`. */
export type QRDataSource = {
  path?: string;
  text?: string;
};

export type QRWidgetConfig = {
  path?: string;
  text?: string;
  caption?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value) || value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v === undefined) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return null;
}

/**
 * Stable QR payload string. Objects use recursively sorted keys and compact JSON.
 * Returns null when the value should not be encoded (null/undefined/empty/unserializable).
 */
export function serializeQRData(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(canonicalize(value));
  }
  return null;
}

/**
 * Resolve QR bytes-to-encode from a widget/primitive source + document payload.
 * Path set → that value only (no text fallback). Path unset → optional literal text.
 */
export function resolveQRData(source: QRDataSource, payload: Record<string, unknown>): string | null {
  const path = source.path?.trim();
  if (path) {
    const serialized = serializeQRData(getByPath(payload, path));
    if (serialized === null || serialized === "") return null;
    return serialized;
  }
  if (source.text === undefined || source.text === null) return null;
  const serialized = serializeQRData(source.text);
  if (serialized === null || serialized === "") return null;
  return serialized;
}

export function qrSourceFromItem(item: PlacedItem): QRDataSource {
  if (item.type === "Widget" && item.widgetId === "doc.qr") {
    const cfg = (item.widgetConfig ?? {}) as QRWidgetConfig;
    return {
      path: typeof cfg.path === "string" ? cfg.path : undefined,
      text: typeof cfg.text === "string" ? cfg.text : undefined,
    };
  }
  return {
    path: item.binding?.path,
    text: typeof item.properties?.text === "string" ? item.properties.text : undefined,
  };
}

export function qrCaptionFromItem(item: PlacedItem): string {
  if (item.type === "Widget" && item.widgetId === "doc.qr") {
    const cfg = (item.widgetConfig ?? {}) as QRWidgetConfig;
    return typeof cfg.caption === "string" ? cfg.caption.trim() : "";
  }
  return typeof item.properties?.caption === "string" ? item.properties.caption.trim() : "";
}
