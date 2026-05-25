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

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const period = url.searchParams.get("period") ?? undefined;
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const where = { tenantId, ...(period && { period }), ...(employeeId && { employeeId }), ...(status && { status }) };
  const [records, total] = await Promise.all([
    prisma.payrollRecord.findMany({
      where,
      include: { employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
      orderBy: { period: "desc" },
      skip,
      take: limit,
    }),
    prisma.payrollRecord.count({ where }),
  ]);

  return NextResponse.json({ data: records, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = processPayrollSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, tenantId },
      include: { taxSlab: true },
    });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const grossPay = employee.salary + data.allowances;
    const taxRate = employee.taxSlab ? employee.taxSlab.rate / 100 : 0;
    const tax = grossPay * taxRate;
    const netPay = grossPay - tax - data.deductions;

    const record = await prisma.payrollRecord.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        period: data.period,
        basicSalary: employee.salary,
        allowances: data.allowances,
        deductions: data.deductions,
        tax,
        netPay,
      },
      include: { employee: true },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const e = error as { code?: string };
    if (e.code === "P2002") return NextResponse.json({ error: "Payroll already exists for this employee and period" }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
