import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
});

type Params = { params: Promise<{ id: string; uid: string }> };

// PATCH /api/tenants/:id/users/:uid — update member role (ADMIN only)
export async function PATCH(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id, uid } = await params;

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!caller || !caller.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Prevent self-demotion from ADMIN if they are the last admin
  if (uid === auth.userId) {
    const body = await request.json();
    const { role } = updateRoleSchema.parse(body);
    if (role !== "ADMIN") {
      const adminCount = await prisma.tenantUser.count({
        where: { tenantId: id, role: "ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 409 });
      }
    }
    const updated = await prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId: id, userId: uid } },
      data: { role },
    });
    return NextResponse.json({ data: updated });
  }

  try {
    const body = await request.json();
    const { role } = updateRoleSchema.parse(body);

    const target = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: id, userId: uid } },
    });

    if (!target || !target.isActive) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const updated = await prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId: id, userId: uid } },
      data: { role },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/tenants/:id/users/:uid — remove member (ADMIN only)
export async function DELETE(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id, uid } = await params;

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!caller || !caller.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  if (uid === auth.userId) {
    return NextResponse.json({ error: "Cannot remove yourself. Transfer admin first." }, { status: 409 });
  }

  const target = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: uid } },
  });

  if (!target || !target.isActive) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.tenantUser.update({
    where: { tenantId_userId: { tenantId: id, userId: uid } },
    data: { isActive: false },
  });

  return NextResponse.json({ data: { message: "Member removed" } });
}
