import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { serviceClient } from "@erp/config";

async function getParticipant(request: Request, conversationId: string) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return { error: "Unauthorized", status: 401 } as const;
  const auth = await verifyToken(token);
  if (!auth) return { error: "Invalid token", status: 401 } as const;
  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return { error: "Tenant required", status: 400 } as const;

  const customerResult = await serviceClient.call<{ data?: { id: string } }>("sales", "/api/customers/me", {
    tenantId,
    userId: auth.userId,
  });
  const customerId = customerResult.status === 200 ? customerResult.data?.data?.id : null;
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      leftAt: null,
      conversation: { tenantId },
      OR: [
        { participantType: "USER", participantId: auth.userId },
        ...(customerId ? [{ participantType: "CUSTOMER", participantId: customerId }] : []),
      ],
    },
  });
  if (!participant) return { error: "Not a participant", status: 403 } as const;
  return { auth, tenantId, participant } as const;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const access = await getParticipant(request, id);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId: id },
    select: { id: true, readReceipts: { orderBy: { readAt: "asc" } } },
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ data: message.readReceipts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const access = await getParticipant(request, id);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const message = await prisma.message.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const receipt = await prisma.messageReadReceipt.upsert({
    where: { messageId_userId: { messageId, userId: access.auth.userId } },
    create: { messageId, userId: access.auth.userId },
    update: { readAt: new Date() },
  });
  await prisma.conversationParticipant.update({ where: { id: access.participant.id }, data: { lastReadAt: new Date() } });
  return NextResponse.json({ data: receipt });
}
