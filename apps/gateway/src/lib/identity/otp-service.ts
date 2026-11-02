import { createHash, randomInt } from "crypto";
import { getServiceSecret } from "@erp/auth";
import { createLogger } from "@erp/logger";
import { prisma } from "@/lib/prisma";
import { otpPepper } from "@/lib/integrations/crypto";
import {
  loadApiKey,
  sendOtpMessage,
  WhatsAppNotConfiguredError,
} from "@/lib/integrations/whatsapp-integration-service";
import { Fast2SmsError, sendQuickSms } from "@/lib/integrations/fast2sms";
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

/** Dev/demo OTP mode: when no provider is configured, deliver the code via logs
 * (and return it in the API response) so phone login is usable out of the box.
 * Explicit + off by default — never weakens a configured production tenant. */
function otpDevModeEnabled(): boolean {
  const v = (process.env.OTP_DEV_MODE ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  // Default ON outside production so local/demo phone login works without setup.
  return v === "" && process.env.NODE_ENV !== "production";
}

/**
 * Deliver an OTP via the best available channel, in order:
 *   1. the tenant's configured WhatsApp/SMS OTP channel (sendOtpMessage)
 *   2. a generic Fast2SMS quick-SMS using the tenant's saved API key
 *   3. dev mode (logged + returned to caller) when nothing is configured
 * Returns the channel used and the provider request id (when any).
 */
async function deliverOtp(
  tenantId: string,
  phoneE164: string,
  code: string
): Promise<{ channel: string; requestId: string | null; devCode?: string }> {
  // 1. Configured OTP channel (WhatsApp auth/simple or Fast2SMS OTP id).
  try {
    const sent = await sendOtpMessage(tenantId, phoneE164, code);
    return { channel: "provider", requestId: sent.requestId ?? null };
  } catch (err) {
    if (!(err instanceof WhatsAppNotConfiguredError)) {
      // A real send failure (Fast2SmsError or other) — surface it, don't silently fall back.
      throw err;
    }
    // Not configured → try the generic SMS fallback next.
  }

  // 2. Generic quick-SMS using the tenant's saved Fast2SMS API key (no WhatsApp template needed).
  const apiKey = await loadApiKey(tenantId).catch(() => null);
  if (apiKey) {
    const mobile = phoneE164.replace(/\D/g, "").slice(-10);
    if (mobile.length === 10) {
      try {
        const raw = await sendQuickSms({
          apiKey,
          message: `${code} is your verification code. It expires in 5 minutes. Do not share it.`,
          numbers: mobile,
        });
        const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const rid = rec.request_id ?? rec.message_id ?? rec.message;
        return { channel: "sms", requestId: rid != null ? String(rid) : null };
      } catch (err) {
        log.warn("otp_sms_fallback_failed", { tenantId, err });
        // fall through to dev mode / error
      }
    }
  }

  // 3. Dev/demo mode — issue the code without a provider.
  if (otpDevModeEnabled()) {
    log.warn("otp_dev_mode", {
      tenantId,
      phone: phoneE164,
      code,
      note: "OTP delivered via dev mode (no provider configured). Set OTP_DEV_MODE=false to disable.",
    });
    return { channel: "dev", requestId: null, devCode: code };
  }

  throw new WhatsAppNotConfiguredError(
    "No OTP delivery channel configured. Configure WhatsApp/SMS, or enable OTP_DEV_MODE for testing."
  );
}

export async function startOtp(input: {
  phone: string;
  tenantSlug: string;
  purpose: OtpPurpose;
}): Promise<{ expiresIn: number; phone: string; channel: string; devCode?: string }> {
  const phoneNormalized = normalizeWhatsAppPhone(input.phone);
  if (!phoneNormalized) {
    throw new OtpError("INVALID_PHONE", "Enter a valid mobile number with country code", 400);
  }
  const tenant = await resolveTenant(input.tenantSlug);
  await assertRateLimit(tenant.id, phoneNormalized);

  const code = generateOtp();
  let delivery: { channel: string; requestId: string | null; devCode?: string };
  try {
    delivery = await deliverOtp(tenant.id, phoneNormalized, code);
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      throw new OtpError("OTP_NOT_CONFIGURED", err.message, 503);
    }
    if (err instanceof Fast2SmsError) {
      throw new OtpError("OTP_SEND_FAILED", err.message, err.clientStatus);
    }
    log.error("otp_send_failed", { err });
    throw new OtpError("OTP_SEND_FAILED", "Could not send verification code", 502);
  }

  await prisma.otpChallenge.create({
    data: {
      tenantId: tenant.id,
      phoneNormalized,
      codeHash: hashOtp(tenant.id, phoneNormalized, code),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      providerRequestId: delivery.requestId,
    },
  });

  return {
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    phone: phoneNormalized,
    channel: delivery.channel,
    // Only present in dev mode; lets local/demo clients auto-fill the code.
    ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
  };
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
