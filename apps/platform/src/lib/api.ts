export function getAccessToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("platform_access_token") ?? "";
}

export function getRefreshToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("platform_refresh_token") ?? "";
}

const PROCESS_TENANT_KEY = "platform_process_tenant";

export type ProcessTenantRef = { id: string; name: string; slug: string };

export function getProcessTenant(): ProcessTenantRef | null {
  try {
    const raw = localStorage.getItem(PROCESS_TENANT_KEY);
    return raw ? (JSON.parse(raw) as ProcessTenantRef) : null;
  } catch {
    return null;
  }
}

export function setProcessTenant(tenant: ProcessTenantRef | null) {
  if (!tenant) localStorage.removeItem(PROCESS_TENANT_KEY);
  else localStorage.setItem(PROCESS_TENANT_KEY, JSON.stringify(tenant));
}

export function savePlatformAuth(accessToken: string, refreshToken: string, operator?: unknown) {
  localStorage.setItem("platform_access_token", accessToken);
  localStorage.setItem("platform_refresh_token", refreshToken);
  if (operator) localStorage.setItem("platform_operator", JSON.stringify(operator));
}

export function clearPlatformAuth() {
  localStorage.removeItem("platform_access_token");
  localStorage.removeItem("platform_refresh_token");
  localStorage.removeItem("platform_operator");
  localStorage.removeItem(PROCESS_TENANT_KEY);
}

export function getOperator(): {
  id: string;
  email: string;
  name?: string | null;
  role: string;
} | null {
  try {
    const raw = localStorage.getItem("platform_operator");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

/** Sales process APIs via gateway rewrite — platform JWT + target tenant. */
export async function processApi<T = { data?: unknown }>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tenant = getProcessTenant();
  if (!tenant?.id) throw new Error("Select a tenant first");
  return api<T>(path, {
    ...options,
    headers: {
      "x-tenant-id": tenant.id,
      ...(options.headers ?? {}),
    },
  });
}
