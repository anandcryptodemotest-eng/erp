import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import {
  lookupDeliveryReport,
  lookupSmsDeliveryReport,
} from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

/** GET /api/integrations/whatsapp/reports?requestId=&channel=whatsapp|sms */
export async function GET(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId")?.trim();
    const channel = url.searchParams.get("channel") === "sms" ? "sms" : "whatsapp";
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }
    const data =
      channel === "sms"
        ? await lookupSmsDeliveryReport(gate.auth!.tenantId, requestId)
        : await lookupDeliveryReport(gate.auth!.tenantId, requestId);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Could not fetch delivery report");
  }
}
