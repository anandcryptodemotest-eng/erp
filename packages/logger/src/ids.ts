/**
 * Edge-safe request-id helpers (no node:async_hooks / node:crypto).
 * Used by Next.js middleware (Edge runtime).
 */

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

function mintId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Read or mint request / correlation IDs from inbound headers. */
export function resolveRequestIds(headers: Headers | { get(name: string): string | null }) {
  const incoming =
    headers.get(REQUEST_ID_HEADER) ?? headers.get(CORRELATION_ID_HEADER) ?? null;
  const requestId = incoming && incoming.trim() ? incoming.trim() : mintId();
  const correlationId =
    (headers.get(CORRELATION_ID_HEADER) ?? incoming ?? requestId).trim() || requestId;
  return { requestId, correlationId };
}

export function requestIdHeaders(ctx?: { requestId?: string; correlationId?: string } | null): Record<string, string> {
  if (!ctx?.requestId) return {};
  const out: Record<string, string> = { [REQUEST_ID_HEADER]: ctx.requestId };
  if (ctx.correlationId) out[CORRELATION_ID_HEADER] = ctx.correlationId;
  return out;
}
