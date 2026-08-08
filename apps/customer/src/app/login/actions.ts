"use server";

import { isSharedIpHostname, resolveTenantSlug } from "@/lib/tenant";

const GATEWAY = process.env.GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3010/admin";

export type AuthOk = {
  data: {
    accessToken: string;
    tenant: { id: string; slug: string; name: string };
    user: { email: string; role: string; name: string | null };
  };
};

export type AuthResult = AuthOk | { error: string };

async function effectiveTenant(explicit?: string, hostname?: string): Promise<string> {
  const fromExplicit = explicit?.trim().toLowerCase();
  if (fromExplicit) return fromExplicit;

  // Shared IP is mapped to Trustwood — never use hostname as the org unless slug is explicit.
  if (hostname && !isSharedIpHostname(hostname)) {
    const resolved = await fetch(
      `${GATEWAY}/api/public/tenants/resolve?hostname=${encodeURIComponent(hostname)}&portalType=CUSTOMER`,
      { cache: "no-store" }
    );
    if (resolved.ok) {
      const json = (await resolved.json()) as { data?: { slug?: string } };
      if (json.data?.slug) return json.data.slug;
    }
  }
  const slug = resolveTenantSlug();
  if (!slug) throw new Error("Organisation is not configured for this portal");
  return slug;
}

export async function loginAction(input: {
  email: string;
  password: string;
  /** Optional override; normally resolved from env/host/query */
  tenantSlug?: string;
  tenantHostname?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = await effectiveTenant(input.tenantSlug, input.tenantHostname);
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
  tenantHostname?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = await effectiveTenant(input.tenantSlug, input.tenantHostname);
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

/**
 * Verify a Google Identity Services ID token and sign in / register the customer.
 * A single gateway endpoint handles login, auto-registration, and account linking.
 */
export async function otpStartAction(input: {
  phone: string;
  tenantSlug?: string;
  tenantHostname?: string;
  purpose?: "LOGIN" | "VERIFY_LINK";
}): Promise<{ data: { expiresIn: number; phone: string } } | { error: string }> {
  try {
    const tenantSlug = await effectiveTenant(input.tenantSlug, input.tenantHostname);
    const res = await fetch(`${GATEWAY}/api/auth?action=otp-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: input.phone,
        tenantSlug,
        purpose: input.purpose ?? "LOGIN",
        portal: "CUSTOMER",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      data?: { expiresIn: number; phone: string };
      error?: string;
    };
    if (!res.ok) return { error: json.error ?? `Could not send OTP (${res.status})` };
    if (!json.data?.expiresIn) return { error: "Invalid OTP response" };
    return { data: json.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach auth service" };
  }
}

export async function otpVerifyAction(input: {
  phone: string;
  code: string;
  name?: string;
  tenantSlug?: string;
  tenantHostname?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = await effectiveTenant(input.tenantSlug, input.tenantHostname);
    const res = await fetch(`${GATEWAY}/api/auth?action=otp-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: input.phone,
        code: input.code,
        tenantSlug,
        portal: "CUSTOMER",
        name: input.name,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: AuthOk["data"]; error?: string };
    if (!res.ok) return { error: json.error ?? `OTP verify failed (${res.status})` };
    if (!json.data?.accessToken || !json.data?.tenant?.id) {
      return { error: "Invalid OTP login response" };
    }
    return { data: json.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach auth service" };
  }
}

export async function googleLoginAction(input: {
  idToken: string;
  tenantSlug?: string;
  tenantHostname?: string;
}): Promise<AuthResult> {
  try {
    const tenantSlug = await effectiveTenant(input.tenantSlug, input.tenantHostname);
    const res = await fetch(`${GATEWAY}/api/auth?action=google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: input.idToken, tenantSlug }),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: AuthOk["data"]; error?: string; code?: string };
    if (!res.ok) {
      if (json.code === "NEXT_STEP_REQUIRED") {
        return { error: json.error ?? "Additional verification required" };
      }
      return { error: json.error ?? `Google sign-in failed (${res.status})` };
    }
    if (!json.data?.accessToken || !json.data?.tenant?.id) {
      return { error: "Invalid Google sign-in response" };
    }
    return { data: json.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach auth service" };
  }
}
