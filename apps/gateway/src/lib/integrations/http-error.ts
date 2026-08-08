import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationEncryptionError } from "@/lib/integrations/crypto";
import { clientMessageForFast2Sms } from "@/lib/integrations/fast2sms";
import { WhatsAppNotConfiguredError } from "@/lib/integrations/whatsapp-integration-service";
import { createLogger } from "@erp/logger";

const log = createLogger({ service: "gateway-whatsapp" });

export function integrationError(error: unknown, fallback = "Internal server error") {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
  }
  if (error instanceof WhatsAppNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof IntegrationEncryptionError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  const mapped = clientMessageForFast2Sms(error);
  if (error instanceof Error && mapped.message !== "WhatsApp provider request failed") {
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  log.error("whatsapp_integration_error", { err: error });
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}
