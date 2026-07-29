import { NextResponse } from "next/server";
import { getWorkbenchForRole, syncOpenInstanceReadiness } from "@/lib/workflow-workbench";
import { prisma } from "@/lib/prisma";

const ROLE_MAP: Record<string, string> = {
  SALES_REP: "SALES_EXECUTIVE",
};

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !role) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const requestedRole = url.searchParams.get("role") ?? ROLE_MAP[role] ?? role;
  const mineOnly = url.searchParams.get("scope") === "mine";
  const status = url.searchParams.get("status");
  const salesOrderId = url.searchParams.get("salesOrderId");

  await syncOpenInstanceReadiness(tenantId);

  if (salesOrderId) {
    const data = await prisma.workflowTask.findMany({
      where: {
        tenantId,
        salesOrderId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ data });
  }

  const workbench = await getWorkbenchForRole({
    tenantId,
    role: requestedRole,
    userId,
    mineOnly,
  });

  return NextResponse.json({
    data: workbench.tasks,
    meta: workbench.summary,
  });
}
