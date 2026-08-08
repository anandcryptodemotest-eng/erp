import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { sendSampleMessage } from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const schema = z.object({
  phone: z.string().min(7),
  mode: z.enum(["otp", "simple", "session"]).default("otp"),
  text: z.string().max(1000).optional(),
});

/** POST /api/integrations/whatsapp/send — sample OTP / simple template / session text */
export async function POST(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = schema.parse(await request.json());
    const sent = await sendSampleMessage(gate.auth!.tenantId, body);
    return NextResponse.json({
      data: {
        sent: true,
        requestId: "requestId" in sent ? sent.requestId : null,
        messageId: "messageId" in sent ? sent.messageId : null,
        otpHint: "otpHint" in sent ? sent.otpHint : undefined,
        mode: body.mode,
      },
    });
  } catch (error) {
    return integrationError(error, "Send failed");
  }
}
