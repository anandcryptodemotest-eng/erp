/**
 * Same-origin API client. Paths like `/api/orders` are rewritten by next.config
 * to the gateway. Public catalog uses `/api/portal/*` (Customer BFF).
 */
import { storage } from "@/lib/platform/storage";
import { resolveTenantSlug } from "@/lib/tenant";

export type ServiceName = "gateway" | "sales" | "inventory" | "portal";

const TOKEN_KEY = "customer_token";
const TENANT_KEY = "customer_tenant_id";

function getToken(): string | null {
  return storage.get(TOKEN_KEY);
}

function getTenantId(): string | null {
  return storage.get(TENANT_KEY);
}

export function saveAuth(token: string, tenantId: string) {
  storage.set(TOKEN_KEY, token);
  storage.set(TENANT_KEY, tenantId);
}

export function clearAuth() {
  storage.remove(TOKEN_KEY);
  storage.remove(TENANT_KEY);
  storage.remove("customer_display_name");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function api<T = unknown>(
  _service: ServiceName,
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${path}`;
  const token = getToken();
  const tenantId = getTenantId();
  const tenantSlug = resolveTenantSlug();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] ??= "application/json";
  }

  if (token && !options.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }
  if (tenantSlug) {
    headers["x-tenant-slug"] = tenantSlug;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    if (!res.ok) {
      return { error: (json as { error?: string }).error ?? `Request failed (${res.status})` };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Authenticated binary download (invoice PDFs). Plain <a href> cannot send Bearer. */
export async function openAuthenticatedDocument(path: string, fileName = "document.pdf") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = getToken();
  const tenantId = getTenantId();
  const tenantSlug = resolveTenantSlug();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;
  if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;

  const res = await fetch(`${origin}${path}`, { headers });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
