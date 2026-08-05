import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { serviceClient } from "@erp/config";

export const runtime = "nodejs";

type CustomerRecord = { id: string };

/**
 * GET /api/communication/conversations/:id
 * Get a single conversation with participants and last message.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const customerResult = await serviceClient.call<{ data?: CustomerRecord }>("sales", "/api/customers/me", {
    tenantId,
    userId: auth.userId,
  });
  const customerId = customerResult.status === 200 ? customerResult.data?.data?.id : null;

  const conversation = await prisma.conversation.findUnique({
    where: { id, tenantId },
    include: {
      participants: {
        where: { leftAt: null },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      policy: true,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Verify access
  const isParticipant = conversation.participants.some((p) =>
    (p.participantType === "USER" && p.participantId === auth.userId) ||
    (customerId && p.participantType === "CUSTOMER" && p.participantId === customerId)
  );
  if (!isParticipant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  return NextResponse.json({ data: conversation });
}

/**
 * PATCH /api/communication/conversations/:id
 * Update conversation (title, status, description).
 * Body: { title?, status?, description? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { title, status, description } = body;

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: id,
      conversation: { tenantId: auth.tenantId },
      participantType: "USER",
      participantId: auth.userId,
      leftAt: null,
    },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) {
    if (!["OPEN", "ARCHIVED", "LOCKED", "DELETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }

  const conversation = await prisma.conversation.update({
    where: { id },
    data,
    include: { participants: { where: { leftAt: null } } },
  });

  return NextResponse.json({ data: conversation });
}