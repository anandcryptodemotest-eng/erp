import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import { sendOtpMessage } from "@/lib/integrations/whatsapp-integration-service";
import { normalizeWhatsAppPhone } from "@/lib/identity/phone";
import { integrationError } from "@/lib/integrations/http-error";
import { randomInt } from "crypto";

const schema = z.object({
  phone: z.string().min(7),
});

/** POST /api/integrations/whatsapp/test — send OTP without creating a login challenge */
export async function POST(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = await request.json();
    const { phone } = schema.parse(body);
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
    }
    const otp = String(randomInt(100000, 1000000));
    const sent = await sendOtpMessage(gate.auth!.tenantId, normalized, otp);
    return NextResponse.json({
      data: {
        sent: true,
        phone: normalized,
        requestId: sent.requestId,
        message: "Test OTP sent. This code cannot be used to sign in.",
      },
    });
  } catch (error) {
    return integrationError(error, "Test send failed");
  }
}
