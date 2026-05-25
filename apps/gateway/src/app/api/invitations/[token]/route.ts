import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type Params = { params: Promise<{ token: string }> };

// GET /api/invitations/:token — preview invitation details (no auth required)
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired or already been used" }, { status: 410 });
  }

  return NextResponse.json({
    data: {
      email: invitation.email,
      role: invitation.role,
      tenant: invitation.tenant,
      expiresAt: invitation.expiresAt,
    },
  });
}

// POST /api/invitations/:token — accept invitation (requires auth — the invited user must be logged in)
export async function POST(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { token: inviteToken } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(inviteToken) },
    include: { tenant: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired or already been used" }, { status: 410 });
  }

  // Verify the logged-in user's email matches the invitation email
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: "This invitation was sent to a different email address" }, { status: 403 });
  }

  // Check if already a member
  const existing = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: invitation.tenantId, userId: auth.userId } },
  });

  if (existing?.isActive) {
    return NextResponse.json({ error: "You are already a member of this workspace" }, { status: 409 });
  }

  await prisma.$transaction([
    // Add (or re-activate) the user in this tenant
    existing
      ? prisma.tenantUser.update({
          where: { tenantId_userId: { tenantId: invitation.tenantId, userId: auth.userId } },
          data: { role: invitation.role, isActive: true },
        })
      : prisma.tenantUser.create({
          data: { tenantId: invitation.tenantId, userId: auth.userId, role: invitation.role },
        }),
    // Mark invitation as used
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    data: {
      message: `Joined ${invitation.tenant.name} as ${invitation.role}`,
      tenantId: invitation.tenantId,
      tenantSlug: invitation.tenant.slug,
    },
  });
}
