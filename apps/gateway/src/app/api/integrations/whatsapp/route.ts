import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import {
  getWhatsAppStatus,
  saveApiKey,
  syncWhatsApp,
} from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const putSchema = z.object({
  apiKey: z.string().min(8),
  sync: z.boolean().optional(),
});

/** GET /api/integrations/whatsapp — redacted status + snapshot */
export async function GET(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const data = await getWhatsAppStatus(gate.auth!.tenantId);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error);
  }
}

/** PUT /api/integrations/whatsapp — save API key (never echoed back) */
export async function PUT(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = await request.json();
    const { apiKey, sync } = putSchema.parse(body);
    await saveApiKey(gate.auth!.tenantId, apiKey);
    const data = sync ? await syncWhatsApp(gate.auth!.tenantId) : await getWhatsAppStatus(gate.auth!.tenantId);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error);
  }
}
