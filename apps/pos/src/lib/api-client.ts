const SERVICE_URLS: Record<string, string> = {
  // Keep browser requests same-origin; next.config.ts rewrites these to real services.
  gateway: "/_svc/gateway",
  sales: "/_svc/sales",
  inventory: "/_svc/inventory",
  accounting: "/_svc/accounting",
};

export type ServiceName = keyof typeof SERVICE_URLS;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pos_token");
}

function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pos_tenant_id");
}

export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pos_user_id");
}

export function saveAuth(token: string, tenantId: string, userId: string) {
  localStorage.setItem("pos_token", token);
  localStorage.setItem("pos_tenant_id", tenantId);
  localStorage.setItem("pos_user_id", userId);
}

export function clearAuth() {
  localStorage.removeItem("pos_token");
  localStorage.removeItem("pos_tenant_id");
  localStorage.removeItem("pos_user_id");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function api<T = unknown>(
  service: ServiceName,
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  const base = SERVICE_URLS[service] ?? SERVICE_URLS.gateway;
  const url = `${base}${path}`;
  const token = getToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token && !options.skipAuth) headers["Authorization"] = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? `Request failed (${res.status})` };
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}
