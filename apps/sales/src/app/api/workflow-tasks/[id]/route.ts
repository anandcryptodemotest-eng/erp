import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["IN_PROGRESS", "PENDING", "CANCELLED"]).optional(),
  assignedUserId: z.string().nullable().optional(),
});

const ADMIN_OVERRIDE_ROLES = new Set(["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId || !role) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await prisma.workflowTask.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (!ADMIN_OVERRIDE_ROLES.has(role) && existing.assignedRole !== role) {
    return NextResponse.json({ error: `Task belongs to ${existing.assignedRole}` }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.parse(body);
  const nextStatus = parsed.status ?? existing.status;

  if (
    existing.status === "COMPLETED" &&
    nextStatus !== "COMPLETED"
  ) {
    return NextResponse.json({ error: "Completed tasks cannot be reopened" }, { status: 409 });
  }

  const updated = await prisma.workflowTask.update({
    where: { id },
    data: {
      status: nextStatus,
      assignedUserId:
        parsed.assignedUserId === undefined
          ? nextStatus === "IN_PROGRESS"
            ? existing.assignedUserId ?? userId
            : existing.assignedUserId
          : parsed.assignedUserId,
      startedAt: nextStatus === "IN_PROGRESS" ? existing.startedAt ?? new Date() : existing.startedAt,
    },
  });

  return NextResponse.json({ data: updated });
}

