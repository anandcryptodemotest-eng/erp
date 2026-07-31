import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth } from "@/lib/platform-auth";

// GET /api/platform/licenses?tenantId=
export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;

  const tenantId = new URL(request.url).searchParams.get("tenantId");
  const where = tenantId ? { tenantId } : {};
  const licenses = await prisma.moduleLicense.findMany({
    where,
    orderBy: [{ tenantId: "asc" }, { moduleId: "asc" }],
  });
  return NextResponse.json({ data: licenses });
}
