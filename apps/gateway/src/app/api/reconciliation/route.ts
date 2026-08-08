import { NextResponse } from "next/server";
import { tenantCan } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !request.headers.get("x-user-id")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!role || !tenantCan(role, "reconciliation.read")) return NextResponse.json({ error: "Reconciliation access required" }, { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const status = url.searchParams.get("status")?.trim() || undefined;
  const where = { tenantId, ...(status ? { status } : {}) };
  const [data, total] = await Promise.all([
    prisma.reconciliationRecord.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.reconciliationRecord.count({ where }),
  ]);
  return NextResponse.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}