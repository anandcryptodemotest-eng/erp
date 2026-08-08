import { NextResponse } from "next/server";
import { serviceClient, services } from "@erp/config";
import { tenantCan } from "@erp/platform-core";
import type { ModuleId } from "@erp/types";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !request.headers.get("x-user-id")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!role || !tenantCan(role, "reconciliation.retry")) return NextResponse.json({ error: "Reconciliation access required" }, { status: 403 });

  const { id } = await params;
  const record = await prisma.reconciliationRecord.findFirst({ where: { id, tenantId } });
  if (!record) return NextResponse.json({ error: "Reconciliation record not found" }, { status: 404 });
  if (record.status === "SUCCEEDED") return NextResponse.json({ data: record, message: "Already reconciled" });
  if (!(record.targetService in services)) {
    return NextResponse.json({ error: "Invalid reconciliation target" }, { status: 422 });
  }

  const result = await serviceClient.call(record.targetService as ModuleId, record.path, {
    method: record.method,
    tenantId,
    body: record.payload ?? undefined,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
  const succeeded = result.status >= 200 && result.status < 300;
  const updated = await prisma.reconciliationRecord.update({
    where: { id: record.id },
    data: {
      attempts: { increment: 1 },
      status: succeeded ? "SUCCEEDED" : "FAILED",
      lastError: succeeded ? null : result.error ?? `Downstream status ${result.status}`,
      nextRetryAt: succeeded ? null : new Date(Date.now() + Math.min(60, 2 ** Math.min(record.attempts, 5)) * 60_000),
    },
  });
  return NextResponse.json({ data: updated }, { status: succeeded ? 200 : 502 });
}