import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const leaveSchema = z.object({
  employeeId: z.string(),
  type: z.enum(["ANNUAL", "SICK", "PERSONAL", "MATERNITY", "PATERNITY", "UNPAID"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const requests = await prisma.leaveRequest.findMany({
    where: { tenantId },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = leaveSchema.parse(body);

    const leave = await prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
      include: { employee: true },
    });

    return NextResponse.json({ data: leave }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
