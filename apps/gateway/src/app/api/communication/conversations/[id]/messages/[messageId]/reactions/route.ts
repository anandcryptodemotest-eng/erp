import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { serviceClient } from "@erp/config";

const MAX_EMOJI_LENGTH = 16;

async function getParticipant(request: Request, conversationId: string) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return { error: "Unauthorized", status: 401 } as const;
  const auth = await verifyToken(token);
  if (!auth) return { error: "Invalid token", status: 401 } as const;
  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return { error: "Tenant required", status: 400 } as const;
  const customerResult = await serviceClient.call<{ data?: { id: string } }>("sales", "/api/customers/me", { tenantId, userId: auth.userId });
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
  return { auth } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const access = await getParticipant(request, id);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json();
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!emoji || emoji.length > MAX_EMOJI_LENGTH) return NextResponse.json({ error: "A valid emoji is required" }, { status: 400 });
  const message = await prisma.message.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  const reaction = await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId: access.auth.userId, emoji } },
    create: { messageId, userId: access.auth.userId, emoji },
    update: {},
  });
  return NextResponse.json({ data: reaction }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const access = await getParticipant(request, id);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const emoji = new URL(request.url).searchParams.get("emoji")?.trim() || "";
  if (!emoji) return NextResponse.json({ error: "emoji is required" }, { status: 400 });
  await prisma.messageReaction.deleteMany({ where: { messageId, userId: access.auth.userId, emoji, message: { conversationId: id } } });
  return NextResponse.json({ data: { messageId, emoji } });
}
