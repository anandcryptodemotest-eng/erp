import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;

  const notification = await prisma.notification.findFirst({ where: { id, userId, tenantId } });
  if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  return NextResponse.json({ data: notification });
}

// PATCH /api/notifications/:id — mark single notification as read
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;

  const existing = await prisma.notification.findFirst({ where: { id, userId, tenantId } });
  if (!existing) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json({ data: updated });
}

// DELETE /api/notifications/:id — delete notification
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;

  const existing = await prisma.notification.findFirst({ where: { id, userId, tenantId } });
  if (!existing) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
