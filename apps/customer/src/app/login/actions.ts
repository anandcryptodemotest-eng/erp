"use server";

import { resolveTenantSlug } from "@/lib/tenant";

const GATEWAY = process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010";

export type AuthOk = {
  data: {
    accessToken: string;
    tenant: { id: string; slug: string; name: string };
    user: { email: string; role: string; name: string | null };
  };
};

export type AuthResult = AuthOk | { error: string };

function effectiveTenant(explicit?: string): string {
  const slug = explicit?.trim() || resolveTenantSlug();
  if (!slug) throw new Error("Organisation is not configured for this portal");
  return slug;
}

export async function loginAction(input: {
  email: string;
  password: string;
  /** Optional override; normally resolved from env/host/query */
  tenantSlug?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = effectiveTenant(input.tenantSlug);
    const res = await fetch(`${GATEWAY}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: input.email,
        password: input.password,
        tenantSlug,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: AuthOk["data"]; error?: string };
    if (!res.ok) return { error: json.error ?? `Login failed (${res.status})` };
    if (!json.data?.accessToken || !json.data?.tenant?.id) {
      return { error: "Invalid login response" };
    }
    return { data: json.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach auth service" };
  }
}

export async function registerCustomerAction(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName?: string;
  tenantSlug?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = effectiveTenant(input.tenantSlug);
    const res = await fetch(`${GATEWAY}/api/auth?action=register-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
        companyName: input.companyName,
        tenantSlug,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: AuthOk["data"]; error?: string };
    if (!res.ok) return { error: json.error ?? `Register failed (${res.status})` };
    if (!json.data?.accessToken || !json.data?.tenant?.id) {
      return { error: "Invalid register response" };
    }
    return { data: json.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach auth service" };
  }
}
