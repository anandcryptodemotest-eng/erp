import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { lookupWhatsAppLogs } from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/** GET /api/integrations/whatsapp/logs?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const url = new URL(request.url);
    const fallback = defaultRange();
    const from = url.searchParams.get("from")?.trim() || fallback.from;
    const to = url.searchParams.get("to")?.trim() || fallback.to;
    const data = await lookupWhatsAppLogs(gate.auth!.tenantId, from, to);
    return NextResponse.json({ data, from, to });
  } catch (error) {
    return integrationError(error, "Could not fetch logs");
  }
}
