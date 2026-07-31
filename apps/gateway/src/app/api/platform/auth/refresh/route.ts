import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlatformToken } from "@erp/auth";
import { isPlatformRole, type PlatformRole } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  refreshToken: z.string().min(16),
});

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Stub-capable refresh — rotates access token from stored refresh hash. */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const tokenHash = hashToken(body.refreshToken);
    const row = await prisma.platformRefreshToken.findUnique({
      where: { tokenHash },
      include: { operator: true },
    });
    if (!row || row.expiresAt < new Date() || !row.operator.isActive) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }
    if (!isPlatformRole(row.operator.role)) {
      return NextResponse.json({ error: "Invalid operator role" }, { status: 500 });
    }
    const accessToken = await createPlatformToken({
      sub: row.operator.id,
      role: row.operator.role as PlatformRole,
    });
    return NextResponse.json({
      data: { accessToken, expiresIn: 8 * 60 * 60 },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
