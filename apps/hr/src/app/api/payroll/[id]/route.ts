import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/payroll/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const record = await prisma.payrollRecord.findFirst({
    where: { id, tenantId },
    include: {
      employee: true,
      payslip: true,
    },
  });

  if (!record) return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });
  return NextResponse.json({ data: record });
}

// PATCH /api/payroll/:id?action=process|pay
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const record = await prisma.payrollRecord.findFirst({ where: { id, tenantId } });
  if (!record) return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });

  if (action === "process") {
    if (record.status !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT payroll records can be processed" }, { status: 409 });
    }

    // Create payslip and mark as PROCESSED in one transaction
    const updated = await prisma.$transaction(async (tx) => {
      await tx.payslip.create({
        data: {
          tenantId,
          employeeId: record.employeeId,
          payrollRecordId: record.id,
          period: record.period,
          grossPay: record.basicSalary + record.allowances,
          tax: record.tax,
          deductions: record.deductions,
          netPay: record.netPay,
        },
      });
      return tx.payrollRecord.update({
        where: { id },
        data: { status: "PROCESSED", processedAt: new Date() },
        include: { payslip: true },
      });
    });

    return NextResponse.json({ data: updated });
  }

  if (action === "pay") {
    if (record.status !== "PROCESSED") {
      return NextResponse.json({ error: "Only PROCESSED payroll records can be paid" }, { status: 409 });
    }
    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Invalid action. Use ?action=process|pay" }, { status: 400 });
}
