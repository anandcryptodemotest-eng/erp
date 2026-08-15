import { NextRequest, NextResponse } from "next/server";
import { getServiceSecret } from "@erp/auth";
import { NotificationCommandError, parseSendCommand } from "@erp/notifications";
import { sendNotification } from "@/lib/notifications/send";

function canSend(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const senderId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  const serviceKey = request.headers.get("x-service-key");
  const serviceSecret = getServiceSecret();
  const isService = !!serviceSecret && serviceKey === serviceSecret;
  if (!tenantId || (!senderId && !isService)) {
    return { error: NextResponse.json({ error: "Auth context required" }, { status: 400 }) };
  }
  if (!isService && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role ?? "")) {
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return { tenantId };
}

/** POST /api/notifications/send — versioned outbound command (v1). */
export async function POST(request: NextRequest) {
  const auth = canSend(request);
  if ("error" in auth && auth.error) return auth.error;
  const tenantId = auth.tenantId!;

  const body = await request.json().catch(() => null);
  try {
    const command = parseSendCommand(body);
    const result = await sendNotification(tenantId, command);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof NotificationCommandError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
