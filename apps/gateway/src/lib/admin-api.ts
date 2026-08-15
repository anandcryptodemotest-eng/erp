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

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
  const raw = await res.text();
  let json: any = {};
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status}: ${raw.slice(0, 200) || "empty response"}`), {
          status: res.status,
        });
      }
      throw new Error(`Invalid JSON from ${path}`);
    }
  }
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
  return json as T;
}

/** Fetch a private file (PDF) with auth and open/download — plain href gets 401. */
export async function openAuthenticatedDocument(path: string, fileName = "document.pdf") {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "x-tenant-id": getTenantId(),
    },
  });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* binary error body */
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
  // Keep blob URL briefly so a new tab can load it; revoke after.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/** POST a document endpoint that returns a PDF/binary and trigger a download. */
export async function downloadAuthenticatedDocument(
  path: string,
  fileName: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "x-tenant-id": getTenantId(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* binary error body */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
