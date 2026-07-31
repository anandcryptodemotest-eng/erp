// Browser: same-origin `/api` (nginx). Server: loopback gateway (with basePath /admin).
const BASE =
  typeof window !== "undefined" ? "" : "http://127.0.0.1:3010/admin";

export type AdminSessionUser = {
  id?: string;
  email: string;
  name: string | null;
  role: string;
  /** Optional per-user module override (from admin config later) */
  navModules?: string[] | null;
  /** Enabled TenantCapability keys */
  capabilities?: string[] | null;
};

export function getToken() {
  return localStorage.getItem("admin_token") ?? "";
}
export function getTenantId() {
  return localStorage.getItem("admin_tenant_id") ?? "";
}
export function getAdminUser(): AdminSessionUser | null {
  try {
    const raw = localStorage.getItem("admin_user");
    if (raw) return JSON.parse(raw) as AdminSessionUser;
  } catch {
    /* ignore */
  }
  // Legacy sessions (token only) — read role from JWT payload
  const token = getToken();
  if (!token) return null;
  try {
    const mid = token.split(".")[1];
    if (!mid) return null;
    const json = JSON.parse(atob(mid.replace(/-/g, "+").replace(/_/g, "/"))) as {
      role?: string;
      userId?: string;
    };
    if (!json.role) return null;
    return { email: "", name: null, role: json.role, id: json.userId };
  } catch {
    return null;
  }
}

export function saveAuth(token: string, tenantId: string, user?: AdminSessionUser) {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_tenant_id", tenantId);
  if (user) {
    localStorage.setItem("admin_user", JSON.stringify(user));
  }
}

export function clearAuth() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_tenant_id");
  localStorage.removeItem("admin_user");
}

export async function api(path: string, options: RequestInit = {}) {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${getToken()}`,
      "x-tenant-id": getTenantId(),
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error ?? `HTTP ${res.status}`) as Error & {
      issues?: unknown;
      analyze?: unknown;
      status?: number;
    };
    err.issues = json.issues;
    err.analyze = json.analyze;
    err.status = res.status;
    throw err;
  }
  return json;
}
