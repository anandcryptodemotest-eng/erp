// Service base URLs — configurable via NEXT_PUBLIC_* env vars
const SERVICE_URLS: Record<string, string> = {
  gateway: process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3010",
  sales: process.env.NEXT_PUBLIC_SALES_URL ?? "http://localhost:3001",
  inventory: process.env.NEXT_PUBLIC_INVENTORY_URL ?? "http://localhost:3002",
  accounting: process.env.NEXT_PUBLIC_ACCOUNTING_URL ?? "http://localhost:3003",
  hr: process.env.NEXT_PUBLIC_HR_URL ?? "http://localhost:3004",
  procurement: process.env.NEXT_PUBLIC_PROCUREMENT_URL ?? "http://localhost:3005",
  delivery: process.env.NEXT_PUBLIC_DELIVERY_URL ?? "http://localhost:3006",
};

export type ServiceName = keyof typeof SERVICE_URLS;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("erp_token");
}

function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("erp_tenant_id");
}

export function saveAuth(token: string, tenantId: string) {
  localStorage.setItem("erp_token", token);
  localStorage.setItem("erp_tenant_id", tenantId);
}

export function clearAuth() {
  localStorage.removeItem("erp_token");
  localStorage.removeItem("erp_tenant_id");
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

  if (token && !options.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    if (!res.ok) return { error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
    return { data: json as T };
  } catch {
    return { error: "Network error" };
  }
}
