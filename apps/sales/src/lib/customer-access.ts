import { prisma } from "@/lib/prisma";

/** Ensure CUSTOMER role can only touch their own customer record. */
export async function assertCustomerAccess(opts: {
  tenantId: string;
  customerId: string;
  userId: string | null;
  role: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (opts.role !== "CUSTOMER") return { ok: true };
  if (!opts.userId) return { ok: false, status: 401, error: "Auth required" };
  const me = await prisma.customer.findFirst({
    where: { id: opts.customerId, tenantId: opts.tenantId, portalUserId: opts.userId, isActive: true },
    select: { id: true },
  });
  if (!me) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true };
}
