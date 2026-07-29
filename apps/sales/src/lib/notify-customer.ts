import { createLogger } from "@erp/logger";

const log = createLogger({ service: "sales" });
/** Best-effort in-app notification to the portal user linked on the customer. */
export async function notifyPortalCustomer(opts: {
  tenantId: string;
  portalUserId: string | null | undefined;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.portalUserId) return;
  const gateway =
    process.env.GATEWAY_SERVICE_URL ?? process.env.CORE_SERVICE_URL ?? "http://localhost:3010";
  const serviceSecret = process.env.SERVICE_SECRET || "dev-service-secret";
  try {
    await fetch(`${gateway}/api/notifications/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": serviceSecret,
        "x-tenant-id": opts.tenantId,
        "x-user-id": opts.portalUserId,
      },
      body: JSON.stringify({
        userId: opts.portalUserId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        metadata: opts.metadata,
      }),
    });
  } catch (err) {
    log.error("notifyportalcustomer", { err: err });
  }
}
