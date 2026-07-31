import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createPlatformToken } from "@erp/auth";
import { isPlatformRole, type PlatformRole } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";
import { writePlatformAudit } from "@/lib/platform-audit";
import { clientMeta } from "@/lib/platform-auth";

const loginSchema = z.object({
  action: z.literal("login").optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const operator = await prisma.platformOperator.findUnique({ where: { email: email.toLowerCase() } });
    if (!operator || !operator.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, operator.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!isPlatformRole(operator.role)) {
      return NextResponse.json({ error: "Invalid operator role" }, { status: 500 });
    }

    const role = operator.role as PlatformRole;
    const accessToken = await createPlatformToken({ sub: operator.id, role });
    const refreshRaw = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.platformRefreshToken.create({
      data: {
        operatorId: operator.id,
        tokenHash: hashToken(refreshRaw),
        expiresAt,
      },
    });
    await prisma.platformOperator.update({
      where: { id: operator.id },
      data: { lastLoginAt: new Date() },
    });

    const meta = clientMeta(request);
    await writePlatformAudit({
      operatorId: operator.id,
      action: "AUTH_LOGIN",
      entityType: "PlatformOperator",
      entityId: operator.id,
      metadata: { email: operator.email },
      ...meta,
    });

    return NextResponse.json({
      data: {
        accessToken,
        refreshToken: refreshRaw,
        expiresIn: 8 * 60 * 60,
        operator: {
          id: operator.id,
          email: operator.email,
          name: operator.name,
          role: operator.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
