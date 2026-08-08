import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { syncWhatsApp } from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

/** POST /api/integrations/whatsapp/sync */
export async function POST(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const data = await syncWhatsApp(gate.auth!.tenantId);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Sync failed");
  }
}
