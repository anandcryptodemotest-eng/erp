import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/leave/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, tenantId },
    include: { employee: true },
  });

  if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  return NextResponse.json({ data: leave });
}

// PATCH /api/leave/:id?action=approve|reject|cancel
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const leave = await prisma.leaveRequest.findFirst({ where: { id, tenantId } });
  if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

  if (action === "approve" || action === "reject") {
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    if (leave.status !== "PENDING") {
      return NextResponse.json({ error: `Cannot ${action} a leave request in ${leave.status} status` }, { status: 409 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
    });
    return NextResponse.json({ data: updated });
  }

  if (action === "cancel") {
    if (!["PENDING", "APPROVED"].includes(leave.status)) {
      return NextResponse.json({ error: `Cannot cancel a leave request in ${leave.status} status` }, { status: 409 });
    }
    const updated = await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Invalid action. Use ?action=approve|reject|cancel" }, { status: 400 });
}
