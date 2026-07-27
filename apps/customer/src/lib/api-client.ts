/**
 * Same-origin API client. Paths like `/api/orders` are rewritten by next.config
 * to the gateway, which proxies to microservices (avoids browser CORS).
 */
export type ServiceName = "gateway" | "sales" | "inventory" | "accounting" | "delivery";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("customer_token");
}

function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("customer_tenant_id");
}

export function saveAuth(token: string, tenantId: string) {
  localStorage.setItem("customer_token", token);
  localStorage.setItem("customer_tenant_id", tenantId);
}

export function clearAuth() {
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_tenant_id");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function api<T = unknown>(
  _service: ServiceName,
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  // Same-origin (rewrite → gateway). Absolute origin avoids odd base-URL cases.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${path}`;
  const token = getToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token && !options.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
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
