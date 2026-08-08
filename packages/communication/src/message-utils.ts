import { DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT } from "./constants";
import type { CursorPaginationParams, CursorPaginationResult } from "./types";

/**
 * Format message text with WhatsApp-style markdown:
 * *bold* → <strong>bold</strong>
 * _italic_ → <em>italic</em>
 * ~strikethrough~ → <del>strikethrough</del>
 * Returns HTML-safe string with formatting.
 */
export function formatMessageText(text: string): string {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");

  return escaped
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~(.+?)~/g, "<del>$1</del>");
}

/** Extract @mentions from message text */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}

/** Extract URLs from message text */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) ?? [];
}

/** Normalize limit for cursor pagination */
export function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_MESSAGE_LIMIT;
  return Math.min(limit, MAX_MESSAGE_LIMIT);
}

/** Build cursor pagination result */
export function buildPaginationResult<T extends { id: string; createdAt: string | Date }>(
  items: T[],
  limit: number
): CursorPaginationResult<T> {
  if (items.length <= limit) {
    return { data: items, nextCursor: null, hasMore: false };
  }
  const data = items.slice(0, limit);
  const last = data[data.length - 1];
  return {
    data,
    nextCursor: `${new Date(last.createdAt).getTime()}-${last.id}`,
    hasMore: true,
  };
}

/** Parse cursor for pagination (returns createdAt timestamp + id) */
export function parseCursor(cursor: string | null | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.lastIndexOf("-");
  if (sep < 0) return null;
  const ts = parseInt(cursor.slice(0, sep), 10);
  const id = cursor.slice(sep + 1);
  if (isNaN(ts) || !id) return null;
  return { createdAt: new Date(ts), id };
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format duration for display (seconds → M:SS) */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}