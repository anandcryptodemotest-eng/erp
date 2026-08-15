import { NextRequest, NextResponse } from "next/server";
import { retryNotificationDelivery } from "@/lib/notifications/send";

function requireAdmin(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return { error: NextResponse.json({ error: "Auth context required" }, { status: 400 }) };
  }
  if (!["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role ?? "")) {
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return { tenantId };
}

/** POST /api/notifications/deliveries/:id/retry — operator retry of FAILED deliveries. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const updated = await retryNotificationDelivery(auth.tenantId!, id);
  if (!updated) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
