import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { lookupDltCatalog } from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const typeSchema = z.enum(["sender", "template"]).default("sender");

/** GET /api/integrations/whatsapp/dlt?type=sender|template */
export async function GET(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const url = new URL(request.url);
    const type = typeSchema.parse(url.searchParams.get("type") ?? "sender");
    const data = await lookupDltCatalog(gate.auth!.tenantId, type);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Could not load DLT catalog");
  }
}
