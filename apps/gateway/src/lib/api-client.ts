// Browser traffic must stay same-origin (nginx → gateway). Never call microservice ports from the client.
function browserBase(): string {
  return ""; // same-origin; gateway rewrites /api/* to internal services
}

function serverBase(service: string): string {
  // Server-side only (RSC / route handlers). Prefer env overrides; default to loopback.
  const map: Record<string, string | undefined> = {
    gateway: process.env.GATEWAY_INTERNAL_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL,
    sales: process.env.SALES_SERVICE_URL ?? process.env.NEXT_PUBLIC_SALES_URL,
    inventory: process.env.INVENTORY_SERVICE_URL ?? process.env.NEXT_PUBLIC_INVENTORY_URL,
    accounting: process.env.ACCOUNTING_SERVICE_URL ?? process.env.NEXT_PUBLIC_ACCOUNTING_URL,
    hr: process.env.HR_SERVICE_URL ?? process.env.NEXT_PUBLIC_HR_URL,
    procurement: process.env.PROCUREMENT_SERVICE_URL ?? process.env.NEXT_PUBLIC_PROCUREMENT_URL,
    delivery: process.env.DELIVERY_SERVICE_URL ?? process.env.NEXT_PUBLIC_DELIVERY_URL,
  };
  const defaults: Record<string, string> = {
    gateway: "http://127.0.0.1:3010",
    sales: "http://127.0.0.1:3001",
    inventory: "http://127.0.0.1:3002",
    accounting: "http://127.0.0.1:3003",
    hr: "http://127.0.0.1:3004",
    procurement: "http://127.0.0.1:3005",
    delivery: "http://127.0.0.1:3006",
  };
  return map[service] ?? defaults[service] ?? defaults.gateway;
}

const SERVICE_URLS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_t, prop: string) {
      if (typeof window !== "undefined") return browserBase();
      return serverBase(prop);
    },
  }
);

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
