import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { normalizeLimit, parseCursor, DEFAULT_MESSAGE_LIMIT } from "@erp/communication";
import { serviceClient } from "@erp/config";

export const runtime = "nodejs";

const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
]);

async function resolvePortalCustomerId(tenantId: string, userId: string) {
  const result = await serviceClient.call<{ data?: { id: string } }>("sales", "/api/customers/me", {
    tenantId,
    userId,
  });
  return result.status === 200 ? result.data?.data?.id ?? null : null;
}

/**
 * GET /api/communication/conversations/:id/messages
 * List messages with cursor pagination (newest first, load older).
 * Query: ?cursor=...&limit=50
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
  const { searchParams } = new URL(request.url);
  const limit = normalizeLimit(parseInt(searchParams.get("limit") || "50", 10));
  const cursor = parseCursor(searchParams.get("cursor"));
  const customerId = await resolvePortalCustomerId(tenantId, auth.userId);

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: id,
      leftAt: null,
      OR: [
        { participantType: "USER", participantId: auth.userId },
        ...(customerId ? [{ participantType: "CUSTOMER", participantId: customerId }] : []),
      ],
      conversation: { tenantId },
    },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      isDeleted: false,
      OR: [
        { deletedFor: { equals: [] } },
        { NOT: { deletedFor: { has: auth.userId } } },
      ],
    },
    include: {
      attachments: true,
      reactions: true,
      readReceipts: { where: { userId: { not: auth.userId } } },
      replyTo: { select: { id: true, text: true, type: true, senderId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor.id },
        }
      : {}),
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  // Reverse to chronological order
  data.reverse();

  return NextResponse.json({
    data,
    nextCursor,
    hasMore,
  });
}

/**
 * POST /api/communication/conversations/:id/messages
 * Send a message.
 * Body: { type: "TEXT", text: "...", replyToId?: "..." }
 */
export async function POST(
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
  const customerId = await resolvePortalCustomerId(tenantId, auth.userId);
  const participantIdentity = auth.role === "CUSTOMER" && customerId
    ? { participantType: "CUSTOMER", participantId: customerId }
    : { participantType: "USER", participantId: auth.userId };

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: id,
      leftAt: null,
      ...participantIdentity,
      conversation: { tenantId },
    },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Check conversation is not locked
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { status: true, tenantId: true },
  });
  if (!conversation || conversation.status === "LOCKED" || conversation.status === "DELETED") {
    return NextResponse.json({ error: "Conversation is locked or deleted" }, { status: 403 });
  }

  const body = await request.json();
  const { type = "TEXT", text, replyToId, contextModule, contextEntity, contextId, attachments = [] } = body;

  if (!text && type === "TEXT") {
    return NextResponse.json({ error: "text is required for TEXT messages" }, { status: 400 });
  }
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return NextResponse.json({ error: `A message can include up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments` }, { status: 400 });
  }

  const attachmentData = attachments.map((attachment: unknown) => {
    if (!attachment || typeof attachment !== "object") return null;
    const value = attachment as Record<string, unknown>;
    const assetRef = value.assetRef;
    const fileName = typeof value.fileName === "string" ? value.fileName.trim() : "";
    const mimeType = typeof value.mimeType === "string" ? value.mimeType : "";
    const fileSize = typeof value.fileSize === "number" ? value.fileSize : 0;
    if (
      !assetRef ||
      typeof assetRef !== "object" ||
      typeof (assetRef as Record<string, unknown>).id !== "string" ||
      typeof (assetRef as Record<string, unknown>).type !== "string" ||
      (assetRef as Record<string, unknown>).version !== 1 ||
      !fileName ||
      !ALLOWED_ATTACHMENT_TYPES.has(mimeType) ||
      fileSize <= 0 ||
      fileSize > MAX_ATTACHMENT_BYTES
    ) return null;
    return {
      assetRef,
      fileName,
      mimeType,
      fileSize,
      duration: typeof value.duration === "number" ? value.duration : null,
      width: typeof value.width === "number" ? value.width : null,
      height: typeof value.height === "number" ? value.height : null,
      thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : null,
    };
  });
  if (attachmentData.some((attachment) => attachment === null)) {
    return NextResponse.json({ error: "Invalid attachment metadata" }, { status: 400 });
  }
  const validAttachments = attachmentData.filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      senderType: customerId && participant.participantType === "CUSTOMER" ? "CUSTOMER" : "USER",
      senderId: auth.userId,
      type,
      text: text || null,
      replyToId: replyToId || null,
      contextModule: contextModule || null,
      contextEntity: contextEntity || null,
      contextId: contextId || null,
      attachments: validAttachments.length > 0 ? { create: validAttachments } : undefined,
    },
    include: {
      attachments: true,
      reactions: true,
    },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  // Update participant's lastReadAt
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ data: message }, { status: 201 });
}