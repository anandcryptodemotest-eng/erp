import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createToken, verifyToken, extractToken, getServiceSecret } from "@erp/auth";
import { hashPassword } from "@/lib/identity/password";
import { z } from "zod";
import {
  authenticateGoogle,
  authenticatePassword,
  setUserPassword,
  logout,
  logoutAll,
  refreshSession,
  issueSession,
  TenantMembershipError,
} from "@/lib/identity/identity-service";
import { auditAuthEvent, AuthAuditEvent } from "@/lib/identity/audit-events";
import type { SessionMeta } from "@/lib/identity/session-service";
import {
  startOtp,
  verifyOtpLogin,
  linkPhoneWithOtp,
  OtpError,
} from "@/lib/identity/otp-service";
import { IntegrationEncryptionError } from "@/lib/integrations/crypto";

const log = createLogger({ service: "gateway" });

async function enabledCapabilityKeys(tenantId: string): Promise<string[]> {
  const rows = await prisma.tenantCapability.findMany({
    where: { tenantId, enabled: true },
    select: { key: true },
  });
  return rows.map((r) => r.key);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Build session metadata (device/ip/userAgent) from the request. */
function sessionMetaFromRequest(request: Request): SessionMeta {
  const ua = request.headers.get("user-agent") ?? undefined;
  const forwarded =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined;
  return {
    device: ua,

    ip: forwarded,
    userAgent: ua,
  };
}

/** Convert an IssuedSession into the wire payload used by the existing clients. */
function sessionToPayload(session: Awaited<ReturnType<typeof issueSession>>) {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    user: session.user,
    tenant: session.tenant,
    modules: session.modules,
    isNewUser: session.isNewUser,
  };
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

const registerCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1),
  phone: z.string().optional(),
  companyName: z.string().optional(),
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

const googleSchema = z.object({
  idToken: z.string().min(1),
  tenantSlug: z.string().optional(),
});

const setPasswordSchema = z.object({
  password: z.string().min(8),
});

const otpStartSchema = z.object({
  phone: z.string().min(7),
  tenantSlug: z.string().min(1),
  purpose: z.enum(["LOGIN", "VERIFY_LINK", "REGISTER_CUSTOMER"]).default("LOGIN"),
  portal: z.enum(["CUSTOMER", "ADMIN"]).optional(),
});

const otpVerifySchema = z.object({
  phone: z.string().min(7),
  code: z.string().min(4).max(8),
  tenantSlug: z.string().min(1),
  portal: z.enum(["CUSTOMER", "ADMIN"]).default("CUSTOMER"),
  name: z.string().min(1).optional(),
});

const otpLinkSchema = z.object({
  phone: z.string().min(7),
  code: z.string().min(4).max(8),
});

// ─── Router ──────────────────────────────────────────────────────────────────

// POST /api/auth?action=login (default)
// POST /api/auth?action=register
// POST /api/auth?action=register-customer
// POST /api/auth?action=google
// POST /api/auth?action=otp-start
// POST /api/auth?action=otp-verify
// POST /api/auth?action=otp-link
// POST /api/auth?action=set-password
// POST /api/auth?action=refresh
// POST /api/auth?action=logout
// POST /api/auth?action=logout-all
// POST /api/auth?action=forgot-password
// POST /api/auth?action=reset-password
// POST /api/auth?action=switch-tenant
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  switch (action) {
    case "register":         return handleRegister(request);
    case "register-customer": return handleRegisterCustomer(request);
    case "google":           return handleGoogle(request);
    case "otp-start":        return handleOtpStart(request);
    case "otp-verify":       return handleOtpVerify(request);
    case "otp-link":         return handleOtpLink(request);
    case "set-password":     return handleSetPassword(request);
    case "refresh":          return handleRefresh(request);
    case "logout":           return handleLogout(request);
    case "logout-all":       return handleLogoutAll(request);
    case "forgot-password":  return handleForgotPassword(request);
    case "reset-password":   return handleResetPassword(request);
    case "switch-tenant":    return handleSwitchTenant(request);
    default:                 return handleLogin(request);
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function handleLogin(request: Request) {
  try {
    const body = await request.json();
    const { email, password, tenantSlug } = loginSchema.parse(body);

    const result = await authenticatePassword({
      email,
      password,
      tenantSlug,
      meta: sessionMetaFromRequest(request),
    });

    if ("needGoogle" in result) {
      if (result.needGoogle) {
        return NextResponse.json(
          { error: "This account uses Google sign-in. Use Continue with Google.", code: "NEED_GOOGLE" },
          { status: 401 }
        );
      }
    }
    if ("invalid" in result) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!("session" in result)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = result.session;
    auditAuthEvent({
      event: AuthAuditEvent.LOGIN_PASSWORD,
      userId: session.user.id,
      email: session.user.email,
    });
    return NextResponse.json({ data: sessionToPayload(session) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof TenantMembershipError) {
      return NextResponse.json({ error: error.message, code: "NOT_A_MEMBER" }, { status: 403 });
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
      log.error("auth_login_unexpected_error", { err: error });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Google Auth ─────────────────────────────────────────────────────────────

async function handleGoogle(request: Request) {
  try {
    const body = await request.json();
    const { idToken, tenantSlug } = googleSchema.parse(body);

    const session = await authenticateGoogle({
      idToken,
      tenantSlug,
      meta: sessionMetaFromRequest(request),
    });

    auditAuthEvent({
      event: session.isNewUser ? AuthAuditEvent.REGISTER_GOOGLE : AuthAuditEvent.LOGIN_GOOGLE,
      userId: session.user.id,
      email: session.user.email,
      meta: { isNewUser: session.isNewUser },
    });
    return NextResponse.json({ data: sessionToPayload(session) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not configured")) {
      return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
    }
    log.error("auth_google_error", { err: error });
    return NextResponse.json({ error: "Google authentication failed" }, { status: 401 });
  }
}

// ─── WhatsApp OTP ────────────────────────────────────────────────────────────

function otpErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
  }
  if (error instanceof OtpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof IntegrationEncryptionError) {
    return NextResponse.json({ error: error.message, code: "OTP_NOT_CONFIGURED" }, { status: 503 });
  }
  if (error instanceof TenantMembershipError) {
    return NextResponse.json({ error: error.message, code: "NOT_A_MEMBER" }, { status: 403 });
  }
  log.error("auth_otp_unexpected_error", { err: error });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function handleOtpStart(request: Request) {
  try {
    const body = await request.json();
    const data = otpStartSchema.parse(body);
    const purpose = data.purpose;
    if (purpose === "VERIFY_LINK") {
      const token = extractToken(request.headers.get("authorization"));
      if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const auth = await verifyToken(token);
      if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      const tenant = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
      if (!tenant || tenant.id !== auth.tenantId) {
        return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
      }
    }
    const result = await startOtp({
      phone: data.phone,
      tenantSlug: data.tenantSlug,
      purpose,
    });
    auditAuthEvent({
      event: AuthAuditEvent.OTP_SENT,
      meta: { tenantSlug: data.tenantSlug, purpose, portal: data.portal },
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return otpErrorResponse(error);
  }
}

async function handleOtpVerify(request: Request) {
  try {
    const body = await request.json();
    const data = otpVerifySchema.parse(body);
    const { session, isNewUser } = await verifyOtpLogin({
      phone: data.phone,
      code: data.code,
      tenantSlug: data.tenantSlug,
      portal: data.portal,
      name: data.name,
      meta: sessionMetaFromRequest(request),
    });
    auditAuthEvent({
      event: AuthAuditEvent.LOGIN_OTP,
      userId: session.user.id,
      email: session.user.email,
      meta: { isNewUser, portal: data.portal },
    });
    return NextResponse.json(
      { data: { ...sessionToPayload(session), isNewUser } },
      { status: isNewUser ? 201 : 200 }
    );
  } catch (error) {
    return otpErrorResponse(error);
  }
}

async function handleOtpLink(request: Request) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const body = await request.json();
    const data = otpLinkSchema.parse(body);
    const result = await linkPhoneWithOtp({
      userId: auth.userId,
      tenantId: auth.tenantId,
      tenantSlug: tenant.slug,
      phone: data.phone,
      code: data.code,
    });
    auditAuthEvent({
      event: AuthAuditEvent.PHONE_LINKED,
      userId: auth.userId,
      meta: { phone: result.phoneNormalized },
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return otpErrorResponse(error);
  }
}

// ─── Set Password (Google users) ─────────────────────────────────────────────

async function handleSetPassword(request: Request) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { password } = setPasswordSchema.parse(body);

    await setUserPassword(auth.userId, password);

    auditAuthEvent({
      event: AuthAuditEvent.PASSWORD_CHANGED,
      userId: auth.userId,
    });
    return NextResponse.json({ data: { message: "Password set. Active sessions were revoked." } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

async function handleRegister(request: Request) {
  if (process.env.ALLOW_SELF_SERVE_TENANT !== "true") {
    return NextResponse.json(
      {
        error:
          "Self-serve registration is disabled. Contact your Platform Administrator to provision a tenant.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, emailVerified: false },
    });
    await prisma.authCredential.create({
      data: { userId: user.id, type: "PASSWORD", passwordHash: hashedPassword },
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

// ─── Register portal customer into an existing tenant ─────────────────────────

async function handleRegisterCustomer(request: Request) {
  try {
    const body = await request.json();
    const data = registerCustomerSchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: data.tenantSlug },
      include: { licenses: { where: { isActive: true } } },
    });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, emailVerified: false },
    });
    await prisma.authCredential.create({
      data: { userId: user.id, type: "PASSWORD", passwordHash: hashedPassword },
    });
    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: "CUSTOMER" },
    });

    // Create linked Sales Customer via service call (must succeed for portal use)
    const salesUrl = process.env.SALES_SERVICE_URL ?? "http://localhost:3001";
    const serviceSecret = getServiceSecret();
    let salesOk = false;
    try {
      const salesRes = await fetch(`${salesUrl}/api/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": serviceSecret,
          "x-tenant-id": tenant.id,
          "x-user-id": user.id,
          "x-user-role": "CUSTOMER",
        },
        body: JSON.stringify({
          name: data.companyName?.trim() || data.name,
          email: data.email,
          phone: data.phone,
          portalUserId: user.id,
        }),
      });
      salesOk = salesRes.ok;
      if (!salesRes.ok) {
        const errBody = await salesRes.text().catch(() => "");
        log.error("auth_register_customer_sales_profile_create_failed", {
          status: salesRes.status,
          body: errBody.slice(0, 500),
        });
      }
    } catch (err) {
      log.error("auth_register_customer_sales_profile_create_failed", { err: err });
    }

    // Fallback: bootstrap via /me if directory POST failed (e.g. duplicate email race)
    if (!salesOk) {
      try {
        const meRes = await fetch(`${salesUrl}/api/customers/me`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-service-key": serviceSecret,
            "x-tenant-id": tenant.id,
            "x-user-id": user.id,
            "x-user-role": "CUSTOMER",
          },
          body: JSON.stringify({
            name: data.companyName?.trim() || data.name,
            email: data.email,
            phone: data.phone,
          }),
        });
        salesOk = meRes.ok;
      } catch (err) {
        log.error("auth_register_customer_sales_me_bootstrap_failed", { err: err });
      }
    }

    if (!salesOk) {
      return NextResponse.json(
        { error: "Account created but customer profile setup failed. Sign in again to retry." },
        { status: 502 }
      );
    }

    const session = await issueSession(user.id, data.tenantSlug, sessionMetaFromRequest(request));

    return NextResponse.json(
      {
        data: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
          user: session.user,
          tenant: session.tenant,
          modules: session.modules,
          isNewUser: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("auth_register_customer", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

async function handleRefresh(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken: rawToken } = refreshSchema.parse(body);

    const session = await refreshSession(rawToken, sessionMetaFromRequest(request));
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    auditAuthEvent({
      event: AuthAuditEvent.LOGIN_PASSWORD,
      userId: session.user.id,
      email: session.user.email,
      meta: { refresh: true },
    });
    return NextResponse.json({
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        user: session.user,
        tenant: session.tenant,
        modules: session.modules,
        isNewUser: session.isNewUser,
      },
    });
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

    const seen = await logout(rawToken);
    auditAuthEvent({ event: AuthAuditEvent.LOGOUT, meta: { found: seen } });

    return NextResponse.json({ data: { message: "Logged out" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Logout All Devices ──────────────────────────────────────────────────────

async function handleLogoutAll(request: Request) {
  try {
    const token = extractToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    await logoutAll(auth.userId);
    auditAuthEvent({ event: AuthAuditEvent.LOGOUT_ALL, userId: auth.userId });

    return NextResponse.json({ data: { message: "Signed out from all devices" } });
  } catch (error) {
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

    const hashedPassword = await hashPassword(password);

    // Upsert the user's PASSWORD credential (create if Google-only user).
    const existingCred = await prisma.authCredential.findFirst({
      where: { userId: record.userId, type: "PASSWORD" },
    });

    await prisma.$transaction([
      existingCred
        ? prisma.authCredential.update({
            where: { id: existingCred.id },
            data: { passwordHash: hashedPassword },
          })
        : prisma.authCredential.create({
            data: { userId: record.userId, type: "PASSWORD", passwordHash: hashedPassword },
          }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { isRevoked: true } }),
    ]);

    auditAuthEvent({ event: AuthAuditEvent.PASSWORD_CHANGED, userId: record.userId });

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
    const capabilities = await enabledCapabilityKeys(tenantId);
    const accessToken = await createToken({
      userId: auth.userId,
      tenantId,
      role: tenantUser.role as "ADMIN" | "USER" | "MANAGER",
      modules,
      capabilities,
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
