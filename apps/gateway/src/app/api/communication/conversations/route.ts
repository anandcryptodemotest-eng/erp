import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { GENERAL_CONTEXT } from "@erp/communication";
import { serviceClient } from "@erp/config";

export const runtime = "nodejs";

type CustomerRecord = { id: string; name: string; email: string | null; phone: string | null };
type ParticipantRecord = { id: string; participantType: string; participantId: string };

function participantLabel(name: string | null | undefined, phone: string | null | undefined, email: string | null | undefined, fallback: string) {
  return name?.trim() || phone?.trim() || email?.trim() || fallback;
}

async function addParticipantLabels<T extends { participants: ParticipantRecord[] }>(tenantId: string, conversations: T[]) {
  const participantIds = conversations.flatMap((conversation) =>
    conversation.participants.map((participant) => participant.participantId)
  );
  const userIds = [...new Set(
    conversations.flatMap((conversation) =>
      conversation.participants
        .filter((participant) => participant.participantType === "USER")
        .map((participant) => participant.participantId)
    )
  )];
  const customerIds = [...new Set(
    conversations.flatMap((conversation) =>
      conversation.participants
        .filter((participant) => participant.participantType === "CUSTOMER")
        .map((participant) => participant.participantId)
    )
  )];

  const [users, customerResults] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: userIds },
        tenants: { some: { tenantId, isActive: true } },
      },
      select: { id: true, name: true, email: true },
    }),
    Promise.all(customerIds.map((customerId) =>
      serviceClient.call<{ data?: CustomerRecord }>("sales", `/api/customers/${customerId}`, { tenantId })
    )),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const customerById = new Map(
    customerResults.flatMap((result) => result.status === 200 && result.data?.data ? [[result.data.data.id, result.data.data] as const] : [])
  );

  return conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) => {
      const user = participant.participantType === "USER" ? userById.get(participant.participantId) : null;
      const customer = participant.participantType === "CUSTOMER" ? customerById.get(participant.participantId) : null;
      return {
        ...participant,
        displayName: participantLabel(
          user?.name ?? customer?.name,
          customer?.phone,
          user?.email ?? customer?.email,
          participant.participantId
        ),
      };
    }),
  }));
}

async function resolvePortalCustomer(tenantId: string, userId: string) {
  const result = await serviceClient.call<{ data?: CustomerRecord }>("sales", "/api/customers/me", {
    tenantId,
    userId,
  });
  return result.status === 200 ? result.data?.data ?? null : null;
}

/**
 * GET /api/communication/conversations
 * List conversations for the current user.
 * Query: ?status=OPEN (default), ?contextModule=sales, ?contextEntity=SalesOrder, ?contextId=SO-10012
 */
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "OPEN";
  const contextModule = searchParams.get("contextModule");
  const contextEntity = searchParams.get("contextEntity");
  const contextId = searchParams.get("contextId");
  const portalCustomer = await resolvePortalCustomer(tenantId, auth.userId);

  const where: Record<string, unknown> = {
    tenantId,
    status,
    participants: {
      some: {
        leftAt: null,
        OR: [
          { participantType: "USER", participantId: auth.userId },
          ...(portalCustomer ? [{ participantType: "CUSTOMER", participantId: portalCustomer.id }] : []),
        ],
      },
    },
  };

  if (contextModule) where.contextModule = contextModule;
  if (contextEntity) where.contextEntity = contextEntity;
  if (contextId) where.contextId = contextId;

  const conversations = await prisma.conversation.findMany({
    where,
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
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ data: await addParticipantLabels(tenantId, conversations) });
}

/**
 * POST /api/communication/conversations
 * Create a conversation (DIRECT or GROUP).
 * Body: { type, title?, participantIds: string[], customerIds?: string[], contextModule?, contextEntity?, contextId?, contextLabel?, policy? }
 */
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const body = await request.json();
  const { type, title, participantIds, customerIds = [], contextModule, contextEntity, contextId, contextLabel, policy } = body;

  if (!type || !["DIRECT", "GROUP"].includes(type)) {
    return NextResponse.json({ error: "type must be DIRECT or GROUP" }, { status: 400 });
  }
  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return NextResponse.json({ error: "participantIds is required" }, { status: 400 });
  }
  if (!Array.isArray(customerIds) || customerIds.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ error: "customerIds must be an array of IDs" }, { status: 400 });
  }
  if (request.headers.get("x-user-role") === "CUSTOMER" && customerIds.length > 0) {
    return NextResponse.json({ error: "Customers cannot add arbitrary customer participants" }, { status: 403 });
  }

  const customerResults = await Promise.all(
    [...new Set(customerIds)].map((customerId: string) =>
      serviceClient.call<{ data?: CustomerRecord }>("sales", `/api/customers/${customerId}`, { tenantId })
    )
  );
  if (customerResults.some((result) => result.status !== 200 || !result.data?.data)) {
    return NextResponse.json({ error: "One or more customers were not found in this tenant" }, { status: 404 });
  }

  // Ensure creator is included
  const allParticipants = [...new Set([auth.userId, ...participantIds])];

  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      type,
      status: "OPEN",
      title: title || null,
      contextModule: contextModule || GENERAL_CONTEXT.module,
      contextEntity: contextEntity || GENERAL_CONTEXT.entity,
      contextId: contextId || null,
      contextLabel: typeof contextLabel === "string" ? contextLabel.trim() || null : null,
      createdBy: auth.userId,
      participants: {
        create: [
          ...allParticipants.map((pid: string) => ({
            participantType: "USER",
            participantId: pid,
            role: pid === auth.userId ? "ADMIN" : "MEMBER",
          })),
          ...[...new Set(customerIds)].map((customerId: string) => ({
            participantType: "CUSTOMER",
            participantId: customerId,
            role: "MEMBER",
          })),
        ],
      },
      policy: policy && typeof policy === "object" ? {
        create: {
          tenantId,
          visibility: typeof policy.visibility === "string" ? policy.visibility : "PARTICIPANTS",
          allowedParticipantTypes: Array.isArray(policy.allowedParticipantTypes) ? policy.allowedParticipantTypes : [],
          canSend: Array.isArray(policy.canSend) ? policy.canSend : [],
          canEdit: Array.isArray(policy.canEdit) ? policy.canEdit : [],
          canDelete: Array.isArray(policy.canDelete) ? policy.canDelete : [],
          canClose: Array.isArray(policy.canClose) ? policy.canClose : [],
          retentionDays: typeof policy.retentionDays === "number" ? policy.retentionDays : null,
          allowExport: policy.allowExport === true,
        },
      } : undefined,
    },
    include: {
      participants: true,
      policy: true,
    },
  });

  const [enrichedConversation] = await addParticipantLabels(tenantId, [conversation]);
  return NextResponse.json({ data: enrichedConversation }, { status: 201 });
}