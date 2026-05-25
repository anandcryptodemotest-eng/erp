import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).default("USER"),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/tenants/:id/users — list all members (must be a member)
export async function GET(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!caller || !caller.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const [members, total] = await prisma.$transaction([
    prisma.tenantUser.findMany({
      where: { tenantId: id, isActive: true },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
    }),
    prisma.tenantUser.count({ where: { tenantId: id, isActive: true } }),
  ]);

  return NextResponse.json({
    data: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// POST /api/tenants/:id/users — invite a user (ADMIN only)
export async function POST(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!caller || !caller.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role } = inviteSchema.parse(body);

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: id, userId: existingUser.id } },
      });
      if (alreadyMember?.isActive) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 });
      }
    }

    // Expire any previous pending invite for this email + tenant
    await prisma.invitation.updateMany({
      where: { tenantId: id, email, acceptedAt: null },
      data: { expiresAt: new Date() },
    });

    const rawToken = generateToken();
    const invitation = await prisma.invitation.create({
      data: {
        tenantId: id,
        email,
        role,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedBy: auth.userId,
      },
    });

    // TODO: send invitation email in production
    const responseData: Record<string, unknown> = {
      invitationId: invitation.id,
      email,
      role,
      expiresAt: invitation.expiresAt,
      message: "Invitation created.",
    };

    if (process.env.NODE_ENV === "development") {
      responseData.inviteToken = rawToken;
    }

    return NextResponse.json({ data: responseData }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
