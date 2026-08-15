import { NextResponse } from "next/server";
import { completeWorkItem, getWorkItemsForOrder } from "@/lib/workflow-work-items";
import { syncTaskReadiness } from "@/lib/workflow-runtime-v5";
import { prisma } from "@/lib/prisma";

/**
 * GET ?salesOrderId= — Work Items for one SO (journey).
 * POST body { salesOrderId, workItemKey, ...payload } — composite complete (BL-035).
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const salesOrderId = new URL(request.url).searchParams.get("salesOrderId");
  if (!salesOrderId) {
    return NextResponse.json({ error: "salesOrderId required" }, { status: 400 });
  }

  const instance = await prisma.workflowInstance.findFirst({
    where: { tenantId, salesOrderId },
    select: { id: true },
  });
  if (instance) await syncTaskReadiness(instance.id);

  const workItems = await getWorkItemsForOrder({ tenantId, salesOrderId });
  return NextResponse.json({ data: workItems });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const salesOrderId = String(body.salesOrderId ?? "");
  const workItemKey = String(body.workItemKey ?? "");
  if (!salesOrderId || !workItemKey) {
    return NextResponse.json({ error: "salesOrderId and workItemKey required" }, { status: 400 });
  }

  const { salesOrderId: _s, workItemKey: _w, ...payload } = body;

  try {
    const result = await completeWorkItem({
      tenantId,
      salesOrderId,
      workItemKey,
      actorUserId: userId,
      actorRole: role,
      payload,
    });
    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      select: { status: true },
    });
    return NextResponse.json({ data: { ...result, status: order?.status } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Complete failed";
    const status = msg.includes("Not allowed") || msg.includes("role") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
