"use server";

const GATEWAY = process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010";

export type LoginResult =
  | {
      data: {
        accessToken: string;
        tenant: { id: string; slug: string; name: string };
        user: { email: string; role: string; name: string | null };
      };
    }
  | { error: string };

/** Server-side login — avoids browser CORS to the gateway. */
export async function loginAction(input: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<LoginResult> {
  try {
    const res = await fetch(`${GATEWAY}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", ...input }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      data?: LoginResult extends { data: infer D } ? D : never;
      error?: string;
    };
    if (!res.ok) {
      return { error: json.error ?? `Login failed (${res.status})` };
    }
    if (!json.data?.accessToken || !json.data?.tenant?.id) {
      return { error: "Invalid login response" };
    }
    return { data: json.data };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Cannot reach auth service",
    };
  }
}
