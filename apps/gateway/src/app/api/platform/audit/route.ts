import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth } from "@/lib/platform-auth";

export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAudit");
  if (gate instanceof NextResponse) return gate;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        operator: { select: { id: true, email: true, name: true, role: true } },
      },
    }),
    prisma.platformAuditLog.count(),
  ]);

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
