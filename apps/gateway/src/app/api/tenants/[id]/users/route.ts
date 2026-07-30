import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const log = createLogger({ service: "gateway" });

/** Tenant roles used by OMS / admin (stored as TenantUser.role string) */
export const TENANT_ROLES = [
  "ADMIN",
  "MANAGER",
  "PROCESS_OWNER",
  "CATALOG_MANAGER",
  "SALES_EXECUTIVE",
  "PRICING_EXECUTIVE",
  "DISPATCH_EXECUTIVE",
  "DELIVERY_EXECUTIVE",
  "ACCOUNTANT",
  "PROCUREMENT_OFFICER",
  "USER",
] as const;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const inviteSchema = z.object({
  action: z.literal("invite").optional(),
  email: z.string().email(),
  role: z.string().min(2).max(64),
});

const createSchema = z.object({
  action: z.literal("create"),
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: z.string().min(8),
  role: z.string().min(2).max(64),
});

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(request: Request, tenantId: string) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const auth = await verifyToken(token);
  if (!auth) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: auth.userId } },
  });
  if (!caller || !caller.isActive) {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }) };
  }
  return { auth, caller };
}

// GET /api/tenants/:id/users — list members
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await requireAdmin(request, id);
  if ("error" in gate && gate.error) return gate.error;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const skip = (page - 1) * limit;

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

  const rolesRow = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId: id, key: "oms.roles" } },
  });
  let customRoles: string[] = [];
  if (rolesRow?.value) {
    try {
      const parsed = JSON.parse(rolesRow.value) as unknown;
      if (Array.isArray(parsed)) customRoles = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      customRoles = [];
    }
  }

  return NextResponse.json({
    data: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      roles: [...new Set([...TENANT_ROLES, ...customRoles])],
    },
  });
}

// POST /api/tenants/:id/users — invite OR create user with password (ADMIN only)
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const gate = await requireAdmin(request, id);
  if ("error" in gate && gate.error) return gate.error;
  if (gate.caller!.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Create user immediately with password (admin onboarding)
    if (body?.action === "create") {
      const { email, name, password, role } = createSchema.parse(body);
      const hashed = await bcrypt.hash(password, 10);

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: name ?? email.split("@")[0]!,
            password: hashed,
            role: "USER",
          },
        });
      } else {
        // Reset password when admin re-provisions
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashed, ...(name ? { name } : {}) },
        });
      }

      const existing = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: id, userId: user.id } },
      });
      if (existing?.isActive) {
        const updated = await prisma.tenantUser.update({
          where: { id: existing.id },
          data: { role },
        });
        return NextResponse.json({
          data: {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: updated.role,
            message: "User already a member — role and password updated.",
          },
        });
      }

      if (existing && !existing.isActive) {
        const updated = await prisma.tenantUser.update({
          where: { id: existing.id },
          data: { role, isActive: true },
        });
        return NextResponse.json({
          data: {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: updated.role,
            message: "User reactivated.",
          },
          status: 201,
        });
      }

      await prisma.tenantUser.create({
        data: { tenantId: id, userId: user.id, role, isActive: true },
      });

      return NextResponse.json(
        {
          data: {
            userId: user.id,
            email: user.email,
            name: user.name,
            role,
            message: "User created and added to tenant.",
          },
        },
        { status: 201 }
      );
    }

    // Invite (email link) — existing flow
    const { email, role } = inviteSchema.parse(body);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: id, userId: existingUser.id } },
      });
      if (alreadyMember?.isActive) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 });
      }
    }

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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedBy: gate.auth!.userId,
      },
    });

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
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    log.error("tenants_users_post", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
