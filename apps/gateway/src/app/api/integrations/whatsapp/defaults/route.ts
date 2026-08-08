import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { saveWhatsAppDefaults } from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const schema = z
  .object({
    phoneNumberId: z.string().min(1).optional(),
    authTemplateName: z.string().min(1).optional(),
    authTemplateLanguage: z.string().min(1).optional(),
    smsOtpId: z.string().optional(),
    smsSenderId: z.string().optional(),
    dltMessageId: z.string().optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.phoneNumberId ||
          v.authTemplateName ||
          v.smsOtpId !== undefined ||
          v.smsSenderId !== undefined ||
          v.dltMessageId !== undefined
      ),
    { message: "Provide a phone number, template, or SMS otp_id" }
  );

/** PUT /api/integrations/whatsapp/defaults */
export async function PUT(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const result = await saveWhatsAppDefaults(gate.auth!.tenantId, data);
    return NextResponse.json({ data: result });
  } catch (error) {
    return integrationError(error, "Could not save defaults");
  }
}
