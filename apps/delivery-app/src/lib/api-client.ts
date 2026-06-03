// Service URL map — delivery-app calls gateway (auth) and delivery (assignments/earnings)
const SERVICE_URLS: Record<string, string> = {
  gateway: process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3010",
  delivery: process.env.NEXT_PUBLIC_DELIVERY_URL ?? "http://localhost:3006",
};

const TOKEN_KEY = "dex_token";        // delivery executive token
const TENANT_KEY = "dex_tenant_id";
const USER_KEY = "dex_user_id";

export function saveAuth(token: string, tenantId: string, userId: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TENANT_KEY, tenantId);
  localStorage.setItem(USER_KEY, userId);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function getTenantId(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TENANT_KEY) : null;
}

export function getUserId(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null;
}

export async function api<T>(
  service: keyof typeof SERVICE_URLS,
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  const token = getToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "x-tenant-id": tenantId } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  try {
    const res = await fetch(`${SERVICE_URLS[service]}${path}`, { ...options, headers });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? "Request failed" };
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
