import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().min(1),
  mimeType: z.string().optional().nullable(),
  type: z.enum(["PO", "SITE_PHOTO", "DRAWING", "OTHER"]).optional(),
});

async function assertCanAccessSreq(
  tenantId: string,
  sreqId: string,
  userId: string | null,
  role: string | null
) {
  const sreq = await prisma.salesRequest.findFirst({
    where: { id: sreqId, tenantId },
    select: { id: true, status: true, customerId: true, userId: true },
  });
  if (!sreq) return { error: NextResponse.json({ error: "Request not found" }, { status: 404 }) };

  if (role === "CUSTOMER" && userId) {
    const me = await prisma.customer.findFirst({
      where: { tenantId, portalUserId: userId, isActive: true },
      select: { id: true },
    });
    if (!me || me.id !== sreq.customerId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }
  return { sreq };
}

/** GET /api/sales-requests/:id/documents */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const access = await assertCanAccessSreq(tenantId, id, userId, role);
  if (access.error) return access.error;

  const rows = await prisma.salesRequestDocument.findMany({
    where: { tenantId, salesRequestId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: rows });
}

/**
 * POST /api/sales-requests/:id/documents
 * Body: { fileName, fileUrl, mimeType?, type? } — file bytes already at Gateway upload.
 * Customer may attach only while SREQ is OPEN.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id } = await params;
  const access = await assertCanAccessSreq(tenantId, id, userId, role);
  if (access.error) return access.error;
  if (access.sreq!.status !== "OPEN") {
    return NextResponse.json({ error: "Attachments only allowed on open requests" }, { status: 409 });
  }

  const count = await prisma.salesRequestDocument.count({
    where: { tenantId, salesRequestId: id },
  });
  if (count >= 5) {
    return NextResponse.json({ error: "Maximum 5 attachments per request" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const doc = await prisma.salesRequestDocument.create({
    data: {
      tenantId,
      salesRequestId: id,
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      mimeType: parsed.data.mimeType ?? null,
      type: parsed.data.type ?? "OTHER",
      uploadedBy: userId,
    },
  });
  return NextResponse.json({ data: doc }, { status: 201 });
}
