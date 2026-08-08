import { NextResponse } from "next/server";
import { extractToken, verifyToken } from "@erp/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/auth/phone — current user's WhatsApp verification status */
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { phoneNormalized: true, phoneVerifiedAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      phoneNormalized: user.phoneNormalized,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      verified: Boolean(user.phoneVerifiedAt && user.phoneNormalized),
    },
  });
}
