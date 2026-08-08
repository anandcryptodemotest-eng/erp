import { NextResponse } from "next/server";
import { tenantCan } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tenantCan(role, "audit.read")) {
    return NextResponse.json({ error: "Audit access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;
  const action = url.searchParams.get("action")?.trim() || undefined;
  const entityType = url.searchParams.get("entityType")?.trim() || undefined;

  const where = { tenantId, ...(action ? { action } : {}), ...(entityType ? { entityType } : {}) };
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.auditEvent.count({ where }),
  ]);

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
