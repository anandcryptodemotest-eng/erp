import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const url = new URL(request.url);
  const executiveId = url.searchParams.get("executiveId") ?? undefined;
  const period = url.searchParams.get("period") ?? undefined; // YYYY-MM
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(executiveId && { executiveId }),
    ...(period && { period }),
  };

  const [data, total] = await Promise.all([
    prisma.deliveryEarningLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.deliveryEarningLog.count({ where }),
  ]);

  return NextResponse.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}
