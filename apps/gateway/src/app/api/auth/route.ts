import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createToken, verifyToken, extractToken } from "@erp/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const switchTenantSchema = z.object({
  tenantId: z.string().min(1),
});

// ─── Router ──────────────────────────────────────────────────────────────────

// POST /api/auth?action=login (default)
// POST /api/auth?action=register
// POST /api/auth?action=refresh
// POST /api/auth?action=logout
// POST /api/auth?action=forgot-password
// POST /api/auth?action=reset-password
// POST /api/auth?action=switch-tenant
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  switch (action) {
    case "register":        return handleRegister(request);
    case "refresh":         return handleRefresh(request);
    case "logout":          return handleLogout(request);
    case "forgot-password": return handleForgotPassword(request);
    case "reset-password":  return handleResetPassword(request);
    case "switch-tenant":   return handleSwitchTenant(request);
    default:                return handleLogin(request);
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function handleLogin(request: Request) {
  try {
    const body = await request.json();
    const { email, password, tenantSlug } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenants: {
          where: { isActive: true },
          include: {
            tenant: {
              include: { licenses: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Determine tenant context
    let tenantUser = user.tenants[0];
    if (tenantSlug) {
      const found = user.tenants.find((tu) => tu.tenant.slug === tenantSlug);
      if (found) tenantUser = found;
    }

    if (!tenantUser) {
      return NextResponse.json({ error: "No tenant access" }, { status: 403 });
    }

    const modules = tenantUser.tenant.licenses.map((l) => l.moduleId);

    const accessToken = await createToken({
      userId: user.id,
      tenantId: tenantUser.tenantId,
      role: tenantUser.role as "ADMIN" | "USER" | "MANAGER",
      modules,
    });

    // Create refresh token — store SHA-256 hash only, return raw to client
    const rawRefresh = generateToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      data: {
        accessToken,
        refreshToken: rawRefresh,
        expiresIn: 86400,
        user: { id: user.id, email: user.email, name: user.name, role: tenantUser.role },
        tenant: { id: tenantUser.tenant.id, name: tenantUser.tenant.name, slug: tenantUser.tenant.slug },
        modules,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    // Surface a clear error when the database is unavailable in local/dev runs.
    if (
      error instanceof Error &&
      (error.message.includes("Can't reach database server") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("P1001"))
    ) {
      return NextResponse.json(
        { error: "Database unavailable. Start PostgreSQL and try again." },
        { status: 503 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[auth:login] unexpected error", error);
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

async function handleRegister(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    // Auto-create a personal workspace
    const baseSlug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    let slug = `${baseSlug}-org`;
    const taken = await prisma.tenant.findUnique({ where: { slug } });
    if (taken) slug = `${baseSlug}-org-${Date.now()}`;

    const tenant = await prisma.tenant.create({ data: { name: `${name}'s Organization`, slug } });
    await prisma.$transaction([
      prisma.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" } }),
      prisma.moduleLicense.create({ data: { tenantId: tenant.id, moduleId: "core", plan: "basic" } }),
    ]);

    return NextResponse.json(
      { data: { userId: user.id, message: "Account created. Please log in." } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

async function handleRefresh(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken: rawToken } = refreshSchema.parse(body);

    const tokenHash = hashToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            tenants: {
              where: { isActive: true },
              include: { tenant: { include: { licenses: { where: { isActive: true } } } } },
            },
          },
        },
      },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    if (!stored.user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 401 });
    }

    // Rotate — revoke used token and issue new one
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { isRevoked: true } });

    const tenantUser = stored.user.tenants[0];
    if (!tenantUser) {
      return NextResponse.json({ error: "No tenant access" }, { status: 403 });
    }

    const modules = tenantUser.tenant.licenses.map((l) => l.moduleId);
    const accessToken = await createToken({
      userId: stored.user.id,
      tenantId: tenantUser.tenantId,
      role: tenantUser.role as "ADMIN" | "USER" | "MANAGER",
      modules,
    });

    const newRaw = generateToken();
    await prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        tokenHash: hashToken(newRaw),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ data: { accessToken, refreshToken: newRaw, expiresIn: 86400 } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

async function handleLogout(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken: rawToken } = refreshSchema.parse(body);

    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken) },
      data: { isRevoked: true },
    });

    return NextResponse.json({ data: { message: "Logged out" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Forgot Password ─────────────────────────────────────────────────────────

async function handleForgotPassword(request: Request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 — never reveal whether email exists
    if (!user) {
      return NextResponse.json({ data: { message: "If that email exists, a reset link has been sent." } });
    }

    // Invalidate any existing unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // TODO: send email via notification service in production
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ data: { message: "Reset token generated.", resetToken: rawToken } });
    }

    return NextResponse.json({ data: { message: "If that email exists, a reset link has been sent." } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Reset Password ──────────────────────────────────────────────────────────

async function handleResetPassword(request: Request) {
  try {
    const body = await request.json();
    const { token: rawToken, password } = resetPasswordSchema.parse(body);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { isRevoked: true } }),
    ]);

    return NextResponse.json({ data: { message: "Password updated. Please log in." } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Switch Tenant ────────────────────────────────────────────────────────────

async function handleSwitchTenant(request: Request) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { tenantId } = switchTenantSchema.parse(body);

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: auth.userId } },
      include: { tenant: { include: { licenses: { where: { isActive: true } } } } },
    });

    if (!tenantUser || !tenantUser.isActive) {
      return NextResponse.json({ error: "No access to this tenant" }, { status: 403 });
    }

    const modules = tenantUser.tenant.licenses.map((l) => l.moduleId);
    const accessToken = await createToken({
      userId: auth.userId,
      tenantId,
      role: tenantUser.role as "ADMIN" | "USER" | "MANAGER",
      modules,
    });

    return NextResponse.json({
      data: {
        accessToken,
        expiresIn: 86400,
        tenant: { id: tenantUser.tenant.id, name: tenantUser.tenant.name, slug: tenantUser.tenant.slug },
        modules,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
