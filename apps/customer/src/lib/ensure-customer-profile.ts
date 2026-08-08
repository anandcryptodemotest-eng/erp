import { api } from "@/lib/api-client";

export type PortalCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  wallet?: number;
  addresses?: unknown[];
  [key: string]: unknown;
};

/**
 * Resolve Sales Customer linked to the portal login.
 * If missing (register race / legacy account), bootstrap via POST /api/customers/me.
 */
export async function ensureCustomerProfile(opts?: {
  name?: string;
  email?: string;
  phone?: string;
}): Promise<{ customer: PortalCustomer | null; error?: string }> {
  const existing = await api<{ data: PortalCustomer }>("sales", "/api/customers/me");
  if (!existing.error && existing.data?.data?.id) {
    return { customer: existing.data.data };
  }

  const name =
    opts?.name?.trim() ||
    opts?.email?.split("@")[0] ||
    "Customer";

  const created = await api<{ data: PortalCustomer }>("sales", "/api/customers/me", {
    method: "POST",
    body: JSON.stringify({
      name,
      email: opts?.email,
      phone: opts?.phone,
    }),
  });

  if (created.error || !created.data?.data?.id) {
    return {
      customer: null,
      error:
        created.error ||
        existing.error ||
        "No customer profile linked to this login",
    };
  }

  return { customer: created.data.data };
}
