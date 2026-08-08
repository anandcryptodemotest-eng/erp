import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/integrations/require-tenant-admin";
import {
  listTenantWebhooks,
  removeTenantWebhook,
  saveTenantWebhook,
} from "@/lib/integrations/whatsapp-integration-service";
import { integrationError } from "@/lib/integrations/http-error";

const channelSchema = z.enum(["whatsapp", "sms", "otp", "rcs"]).default("whatsapp");

/** GET /api/integrations/whatsapp/webhooks?channel=whatsapp */
export async function GET(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const url = new URL(request.url);
    const channel = channelSchema.parse(url.searchParams.get("channel") ?? "whatsapp");
    const data = await listTenantWebhooks(gate.auth!.tenantId, channel);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Could not list webhooks");
  }
}

const putSchema = z.object({
  channel: channelSchema,
  id: z.string().optional(),
  payload: z.record(z.unknown()),
});

/** PUT /api/integrations/whatsapp/webhooks — create or update Fast2SMS webhook */
export async function PUT(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = putSchema.parse(await request.json());
    const data = await saveTenantWebhook(gate.auth!.tenantId, body.channel, body.payload, body.id);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Could not save webhook");
  }
}

const deleteSchema = z.object({
  channel: channelSchema,
  id: z.string().min(1),
});

/** DELETE /api/integrations/whatsapp/webhooks */
export async function DELETE(request: Request) {
  const gate = await requireTenantAdmin(request);
  if ("error" in gate && gate.error) return gate.error;
  try {
    const body = deleteSchema.parse(await request.json());
    const data = await removeTenantWebhook(gate.auth!.tenantId, body.channel, body.id);
    return NextResponse.json({ data });
  } catch (error) {
    return integrationError(error, "Could not delete webhook");
  }
}
