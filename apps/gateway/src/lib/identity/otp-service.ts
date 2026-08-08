import { createHash, randomInt } from "crypto";
import { getServiceSecret } from "@erp/auth";
import { createLogger } from "@erp/logger";
import { prisma } from "@/lib/prisma";
import { otpPepper } from "@/lib/integrations/crypto";
import {
  sendOtpMessage,
  WhatsAppNotConfiguredError,
} from "@/lib/integrations/whatsapp-integration-service";
import { Fast2SmsError } from "@/lib/integrations/fast2sms";
import { normalizeWhatsAppPhone, syntheticOtpEmail } from "./phone";
import {
  findCredentialByProvider,
  updateCredentialLastUsed,
} from "./credential-service";
import { issueSession, TenantMembershipError, type IssuedSession } from "./identity-service";
import type { SessionMeta } from "./session-service";

const log = createLogger({ service: "gateway-otp" });

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_HOURLY_CAP = 5;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpPurpose = "LOGIN" | "VERIFY_LINK" | "REGISTER_CUSTOMER";
export type OtpPortal = "CUSTOMER" | "ADMIN";

export class OtpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OtpError";
    this.code = code;
    this.status = status;
  }
}

function hashOtp(tenantId: string, phone: string, code: string): string {
  const pepper = otpPepper();
  if (!pepper) {
    throw new OtpError("OTP_NOT_CONFIGURED", "OTP hashing is not configured", 503);
  }
  return createHash("sha256").update(`${pepper}:${tenantId}:${phone}:${code}`).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

async function resolveTenant(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, name: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) {
    throw new OtpError("TENANT_NOT_FOUND", "Organization not found", 404);
  }
  return tenant;
}

async function assertRateLimit(tenantId: string, phoneNormalized: string) {
  const now = Date.now();
  const recent = await prisma.otpChallenge.findFirst({
    where: {
      tenantId,
      phoneNormalized,
      createdAt: { gte: new Date(now - OTP_RESEND_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    throw new OtpError("OTP_RATE_LIMIT", "Please wait before requesting another code", 429);
  }
  const hourly = await prisma.otpChallenge.count({
    where: {
      tenantId,
      phoneNormalized,
      createdAt: { gte: new Date(now - 60 * 60 * 1000) },
    },
  });
  if (hourly >= OTP_HOURLY_CAP) {
    throw new OtpError("OTP_RATE_LIMIT", "Too many OTP requests. Try again later.", 429);
  }
}

export async function startOtp(input: {
  phone: string;
  tenantSlug: string;
  purpose: OtpPurpose;
}): Promise<{ expiresIn: number; phone: string }> {
  const phoneNormalized = normalizeWhatsAppPhone(input.phone);
  if (!phoneNormalized) {
    throw new OtpError("INVALID_PHONE", "Enter a valid mobile number with country code", 400);
  }
  const tenant = await resolveTenant(input.tenantSlug);
  await assertRateLimit(tenant.id, phoneNormalized);

  const code = generateOtp();
  let requestId: string | null = null;
  try {
    const sent = await sendOtpMessage(tenant.id, phoneNormalized, code);
    requestId = sent.requestId;
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      throw new OtpError("WHATSAPP_NOT_CONFIGURED", err.message, 503);
    }
    if (err instanceof Fast2SmsError) {
      throw new OtpError("WHATSAPP_SEND_FAILED", err.message, err.clientStatus);
    }
    log.error("otp_send_failed", { err });
    throw new OtpError("WHATSAPP_SEND_FAILED", "Could not send WhatsApp OTP", 502);
  }

  await prisma.otpChallenge.create({
    data: {
      tenantId: tenant.id,
      phoneNormalized,
      codeHash: hashOtp(tenant.id, phoneNormalized, code),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      providerRequestId: requestId,
    },
  });

  return { expiresIn: Math.floor(OTP_TTL_MS / 1000), phone: phoneNormalized };
}

async function consumeChallenge(input: {
  tenantId: string;
  phoneNormalized: string;
  code: string;
  purposes: OtpPurpose[];
}) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      tenantId: input.tenantId,
      phoneNormalized: input.phoneNormalized,
      purpose: { in: input.purposes },
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new OtpError("OTP_INVALID", "Invalid or expired code", 400);
  }
  if (challenge.expiresAt < new Date()) {
    throw new OtpError("OTP_EXPIRED", "Code expired. Request a new one.", 400);
  }
  if (challenge.attemptCount >= OTP_MAX_ATTEMPTS) {
    throw new OtpError("OTP_LOCKED", "Too many incorrect attempts. Request a new code.", 429);
  }

  const expected = hashOtp(input.tenantId, input.phoneNormalized, input.code.trim());
  if (expected !== challenge.codeHash) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new OtpError("OTP_INVALID", "Invalid or expired code", 400);
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return challenge;
}

async function ensureSalesCustomer(input: {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
}) {
  const salesUrl = process.env.SALES_SERVICE_URL ?? "http://localhost:3001";
  const serviceSecret = getServiceSecret();
  const headers = {
    "Content-Type": "application/json",
    "x-service-key": serviceSecret,
    "x-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-user-role": "CUSTOMER",
  };
  try {
    const salesRes = await fetch(`${salesUrl}/api/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        portalUserId: input.userId,
      }),
    });
    if (salesRes.ok) return true;
  } catch (err) {
    log.error("otp_sales_customer_create_failed", { err });
  }
  try {
    const meRes = await fetch(`${salesUrl}/api/customers/me`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
      }),
    });
    return meRes.ok;
  } catch (err) {
    log.error("otp_sales_customer_me_failed", { err });
    return false;
  }
}

async function ensureCustomerMembership(input: {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
}) {
  const existing = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
  });
  if (!existing) {
    await prisma.tenantUser.create({
      data: { tenantId: input.tenantId, userId: input.userId, role: "CUSTOMER", isActive: true },
    });
  } else if (!existing.isActive) {
    throw new OtpError("ACCOUNT_DISABLED", "This account is disabled for the organization", 403);
  }
  await ensureSalesCustomer(input);
}

export async function verifyOtpLogin(input: {
  phone: string;
  code: string;
  tenantSlug: string;
  portal: OtpPortal;
  name?: string;
  meta?: SessionMeta;
}): Promise<{ session: IssuedSession; isNewUser: boolean }> {
  const phoneNormalized = normalizeWhatsAppPhone(input.phone);
  if (!phoneNormalized) {
    throw new OtpError("INVALID_PHONE", "Enter a valid mobile number with country code", 400);
  }
  if (!/^\d{6}$/.test(input.code.trim())) {
    throw new OtpError("OTP_INVALID", "Enter the 6-digit code", 400);
  }
  const tenant = await resolveTenant(input.tenantSlug);
  await consumeChallenge({
    tenantId: tenant.id,
    phoneNormalized,
    code: input.code,
    purposes: ["LOGIN", "REGISTER_CUSTOMER"],
  });

  const credential = await findCredentialByProvider("PHONE", phoneNormalized);

  if (input.portal === "ADMIN") {
    if (!credential) {
      throw new OtpError(
        "PHONE_NOT_LINKED",
        "WhatsApp is not linked to a staff account. Sign in with email first.",
        403
      );
    }
    const membership = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: credential.userId } },
    });
    if (!membership || !membership.isActive) {
      throw new OtpError("NOT_A_MEMBER", "No staff access to this organization", 403);
    }
    if (membership.role === "CUSTOMER") {
      throw new OtpError("NOT_A_MEMBER", "No staff access to this organization", 403);
    }
    await updateCredentialLastUsed(credential.id);
    await prisma.user.update({
      where: { id: credential.userId },
      data: { phoneNormalized, phoneVerifiedAt: new Date() },
    });
    try {
      const session = await issueSession(credential.userId, tenant.slug, input.meta ?? {}, {
        requireTenantSlug: true,
      });
      session.isNewUser = false;
      return { session, isNewUser: false };
    } catch (err) {
      if (err instanceof TenantMembershipError) {
        throw new OtpError("NOT_A_MEMBER", err.message, 403);
      }
      throw err;
    }
  }

  let userId: string;
  let isNewUser = false;
  let email: string;
  let name: string;

  if (credential) {
    userId = credential.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new OtpError("ACCOUNT_DISABLED", "Account unavailable", 403);
    }
    email = user.email;
    name = input.name?.trim() || user.name || `WhatsApp ${phoneNormalized.slice(-4)}`;
    await updateCredentialLastUsed(credential.id);
    await prisma.user.update({
      where: { id: userId },
      data: { phoneNormalized, phoneVerifiedAt: new Date(), name: user.name ?? name },
    });
  } else {
    isNewUser = true;
    email = syntheticOtpEmail(phoneNormalized);
    name = input.name?.trim() || `WhatsApp ${phoneNormalized.slice(-4)}`;
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          emailVerified: false,
          phoneNormalized,
          phoneVerifiedAt: new Date(),
        },
      });
      await tx.authCredential.create({
        data: { userId: user.id, type: "PHONE", providerId: phoneNormalized },
      });
      return user;
    });
    userId = created.id;
  }

  await ensureCustomerMembership({
    tenantId: tenant.id,
    userId,
    name,
    email,
    phone: phoneNormalized,
  });

  try {
    const session = await issueSession(userId, tenant.slug, input.meta ?? {}, {
      requireTenantSlug: true,
    });
    session.isNewUser = isNewUser;
    return { session, isNewUser };
  } catch (err) {
    if (err instanceof TenantMembershipError) {
      throw new OtpError("NOT_A_MEMBER", err.message, 403);
    }
    throw err;
  }
}

export async function linkPhoneWithOtp(input: {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  phone: string;
  code: string;
}): Promise<{ phoneNormalized: string; phoneVerifiedAt: string }> {
  const phoneNormalized = normalizeWhatsAppPhone(input.phone);
  if (!phoneNormalized) {
    throw new OtpError("INVALID_PHONE", "Enter a valid mobile number with country code", 400);
  }
  if (!/^\d{6}$/.test(input.code.trim())) {
    throw new OtpError("OTP_INVALID", "Enter the 6-digit code", 400);
  }

  await consumeChallenge({
    tenantId: input.tenantId,
    phoneNormalized,
    code: input.code,
    purposes: ["VERIFY_LINK"],
  });

  const existingPhone = await findCredentialByProvider("PHONE", phoneNormalized);
  if (existingPhone && existingPhone.userId !== input.userId) {
    throw new OtpError("PHONE_IN_USE", "This WhatsApp number is already linked to another account", 409);
  }

  const ownPhone = await prisma.authCredential.findFirst({
    where: { userId: input.userId, type: "PHONE" },
  });

  await prisma.$transaction(async (tx) => {
    if (ownPhone) {
      await tx.authCredential.update({
        where: { id: ownPhone.id },
        data: { providerId: phoneNormalized, lastUsedAt: new Date() },
      });
    } else {
      await tx.authCredential.create({
        data: { userId: input.userId, type: "PHONE", providerId: phoneNormalized },
      });
    }
    await tx.user.update({
      where: { id: input.userId },
      data: { phoneNormalized, phoneVerifiedAt: new Date() },
    });
  });

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (user) {
    await ensureSalesCustomer({
      tenantId: input.tenantId,
      userId: input.userId,
      name: user.name || `WhatsApp ${phoneNormalized.slice(-4)}`,
      email: user.email,
      phone: phoneNormalized,
    });
  }

  return {
    phoneNormalized,
    phoneVerifiedAt: new Date().toISOString(),
  };
}
