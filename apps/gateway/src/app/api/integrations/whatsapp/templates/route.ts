import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import {
  createAuthCopyCodeTemplate,
  createCustomMetaTemplate,
  createUtilityHelloTemplate,
} from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const schema = z.object({
  kind: z.enum(["copy_code", "text", "custom"]).default("copy_code"),
  name: z.string().min(1).max(80).optional(),
  payload: z.record(z.unknown()).optional(),
});

/** POST /api/integrations/whatsapp/templates — create Copy Code / utility / custom Meta template */
export async function POST(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = await request.json();
    const input = schema.parse(body);
    if (input.kind === "copy_code") {
      const data = await createAuthCopyCodeTemplate(gate.auth!.tenantId, input.name);
      return NextResponse.json({ data });
    }
    if (input.kind === "text") {
      const data = await createUtilityHelloTemplate(gate.auth!.tenantId, input.name);
      return NextResponse.json({ data });
    }
    if (!input.payload) {
      return NextResponse.json({ error: "Custom template payload is required" }, { status: 400 });
    }
    const created = await createCustomMetaTemplate(gate.auth!.tenantId, input.payload);
    return NextResponse.json({ data: created });
  } catch (error) {
    return integrationError(error, "Could not create template");
  }
}
