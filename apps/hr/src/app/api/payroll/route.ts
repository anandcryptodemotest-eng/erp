import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const processPayrollSchema = z.object({
  employeeId: z.string(),
  period: z.string(),
  allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const records = await prisma.payrollRecord.findMany({
    where: { tenantId },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = processPayrollSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, tenantId },
    });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const netPay = employee.salary + data.allowances - data.deductions;

    const record = await prisma.payrollRecord.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        period: data.period,
        basicSalary: employee.salary,
        allowances: data.allowances,
        deductions: data.deductions,
        netPay,
      },
      include: { employee: true },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
