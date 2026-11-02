import { createLogger } from "@erp/logger";
import { getServiceSecret } from "@erp/auth";

const log = createLogger({ service: "sales" });
/**
 * Notify the portal customer about an order event across every channel the
 * tenant has enabled. We always request IN_APP + SMS + WHATSAPP + FCM; the
 * gateway's notification policy filters to enabled channels and the adapters
 * gracefully SKIP a channel that isn't configured (and DEMO-record it when the
 * tenant is in demo mode), so this is safe to call even with no SMS/WhatsApp
 * creds set up. Phone is resolved from the User record by the gateway when not
 * provided here; passing it explicitly (from the sales Customer) is a fallback.
 */
export async function notifyPortalCustomer(opts: {
  tenantId: string;
  portalUserId: string | null | undefined;
  type: string;
  title: string;
  body: string;
  /** Optional direct phone (E.164 / 10-digit) — used for SMS/WhatsApp when the User has none. */
  phone?: string | null;
  /** Channels to attempt; defaults to all buyer-reachable channels. */
  channels?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.portalUserId) return;
  const gateway =
    process.env.GATEWAY_SERVICE_URL ?? process.env.CORE_SERVICE_URL ?? "http://localhost:3010";
  const serviceSecret = getServiceSecret();
  const channels = opts.channels ?? ["IN_APP", "SMS", "WHATSAPP", "FCM"];
  const recipient: Record<string, unknown> = { userId: opts.portalUserId };
  if (opts.phone && opts.phone.trim()) recipient.phone = opts.phone.trim();
  try {
    await fetch(`${gateway}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": serviceSecret,
        "x-tenant-id": opts.tenantId,
        "x-user-id": opts.portalUserId,
      },
      body: JSON.stringify({
        version: 1,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        channels,
        recipients: [recipient],
        metadata: opts.metadata,
      }),
    });
  } catch (err) {
    log.error("notifyportalcustomer", { err: err });
  }
}
