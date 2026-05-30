const BASE = typeof window !== "undefined" ? "" : "http://localhost:3010";

export function getToken() { return localStorage.getItem("admin_token") ?? ""; }
export function getTenantId() { return localStorage.getItem("admin_tenant_id") ?? ""; }
export function saveAuth(token: string, tenantId: string) {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_tenant_id", tenantId);
}
export function clearAuth() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_tenant_id");
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "x-tenant-id": getTenantId(),
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}
