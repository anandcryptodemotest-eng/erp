import { createToken, verifyToken, extractToken } from "@erp/auth";
import {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  legacyBcryptVerify,
} from "./password";
import { getIdentityProvider, getIdentityProviderRegistry } from "@erp/auth";
import type { VerifiedIdentity } from "@erp/auth";
import { prisma } from "@/lib/prisma";
import {
  findCredentialByProvider,
  updateCredentialLastUsed,
  upsertPasswordCredential,
} from "./credential-service";
import {
  createSession,
  validateToken,
  markTokenUsed,
  revokeToken,
  revokeAllTokens,
} from "./session-service";
import { linkProviderToUserByEmail } from "./account-link-service";
import type { SessionMeta } from "./session-service";
import { GoogleIdentityProvider } from "./google-provider";

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; name: string | null; role: string };
  tenant: { id: string; name: string; slug: string } | null;
  modules: string[];
  isNewUser: boolean;
};

export class TenantMembershipError extends Error {
  constructor(message = "No access to this organization") {
    super(message);
    this.name = "TenantMembershipError";
  }
}

/**
 * IdentityService — provider-agnostic authentication orchestration.
 *
 * Route stays thin: Route → IdentityService → Issue Session → Return Tokens.
 * Handles Google login + auto-registration + account linking, password login,
 * password set/change, session creation and revocation.
 */
export async function issueSession(
  userId: string,
  tenantSlug?: string,
  meta: SessionMeta = {},
  options?: { requireTenantSlug?: boolean }
): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenants: {
        where: { isActive: true, tenant: { isActive: true } },
        include: { tenant: { include: { licenses: { where: { isActive: true } } } } },
      },
    },
  });
  if (!user || !user.isActive) throw new Error("Account unavailable");

  let tenantUser = user.tenants[0];
  if (tenantSlug) {
    const found = user.tenants.find((tu) => tu.tenant.slug === tenantSlug);
    if (found) {
      tenantUser = found;
    } else if (options?.requireTenantSlug) {
      throw new TenantMembershipError();
    }
  }
  const tenant = tenantUser?.tenant ?? null;

  let modules: string[] = [];
  if (tenant) modules = tenant.licenses.map((l) => l.moduleId);
  const capabilities = tenant
    ? (await prisma.tenantCapability.findMany({
        where: { tenantId: tenant.id, enabled: true },
        select: { key: true },
      })).map((c) => c.key)
    : [];

  const role = tenantUser?.role ?? "USER";
  const accessToken = tenant
    ? await createToken({
        userId: user.id,
        tenantId: tenant.id,
        role: role as "ADMIN" | "USER" | "MANAGER",
        modules,
        capabilities,
      })
    : await createToken({
        userId: user.id,
        tenantId: "",
        role: role as "ADMIN" | "USER" | "MANAGER",
        modules,
      });

  const refreshToken = await createSession(user.id, meta);

  return {
    accessToken,
    refreshToken,
    expiresIn: 86400,
    user: { id: user.id, email: user.email, name: user.name, role },
    tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
    modules,
    isNewUser: false,
  };
}

/**
 * Google login + auto-registration + account linking (single endpoint).
 */
export async function authenticateGoogle(input: {
  idToken: string;
  tenantSlug?: string;
  meta?: SessionMeta;
}): Promise<IssuedSession> {
  // Lazy-register the Google provider on first use.
  // Registration lives here (not in the shared package) because google-auth-library
  // pulls in Node.js native modules that must be server-externalised by Next.js.
  let provider = getIdentityProvider("google");
  if (!provider) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Google sign-in is not configured");
    provider = new GoogleIdentityProvider(clientId);
    getIdentityProviderRegistry().register(provider);
  }

  const identity: VerifiedIdentity = await provider.verifyIdToken(input.idToken);
  if (!identity.emailVerified) {
    throw new Error("Google account email is not verified");
  }

  // 1. Known credential → login
  const credential = await findCredentialByProvider("GOOGLE", identity.providerId);
  if (credential) {
    await updateCredentialLastUsed(credential.id);
    const session = await issueSession(credential.userId, input.tenantSlug, input.meta);
    session.isNewUser = false;
    return session;
  }

  // 2. Link to existing verified-email account
  const linkResult = await linkProviderToUserByEmail({
    email: identity.email,
    type: "GOOGLE",
    providerId: identity.providerId,
  });

  let userId: string;
  if (linkResult && linkResult.linked === "linked") {
    userId = linkResult.user.id;
  } else if (linkResult && linkResult.linked === "skipped") {
    // Unverified target account — do not link; create a fresh account below.
    userId = await createUserFromIdentity(identity);
  } else {
    // 3. No existing user → create account
    userId = await createUserFromIdentity(identity);
  }

  const session = await issueSession(userId, input.tenantSlug, input.meta);
  session.isNewUser = true;
  return session;
}

async function createUserFromIdentity(identity: VerifiedIdentity): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: identity.email,
        name: identity.name ?? identity.email.split("@")[0],
        emailVerified: true,
      },
    });
    await tx.authCredential.create({
      data: { userId: user.id, type: "GOOGLE", providerId: identity.providerId },
    });

    // Auto-create a personal workspace so the customer can sign in from the
    // admin side too, matching the existing email self-service registration.
    const baseSlug = identity.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    let slug = `${baseSlug}-org`;
    const taken = await tx.tenant.findUnique({ where: { slug } });
    if (taken) slug = `${baseSlug}-org-${Date.now()}`;
    const tenant = await tx.tenant.create({
      data: { name: `${user.name}'s Organization`, slug },
    });
    await tx.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: "CUSTOMER" },
    });
    await tx.moduleLicense.create({
      data: { tenantId: tenant.id, moduleId: "core", plan: "basic" },
    });
    return user.id;
  });
}


/**
 * Email + password login. Transparently migrates legacy bcrypt hashes to
 * Argon2id on successful login.
 */
export async function authenticatePassword(input: {
  email: string;
  password: string;
  tenantSlug?: string;
  meta?: SessionMeta;
}): Promise<{ session: IssuedSession } | { needGoogle: true } | { invalid: true }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { credentials: true },
  });
  if (!user || !user.isActive) return { invalid: true };

  const passwordCred = user.credentials.find((c) => c.type === "PASSWORD");
  if (!passwordCred || !passwordCred.passwordHash) {
    // Account has no password credential (e.g. Google-only).
    const hasGoogle = user.credentials.some((c) => c.type === "GOOGLE");
    if (hasGoogle) return { needGoogle: true };
    return { invalid: true };
  }

  const ok = isBcryptHash(passwordCred.passwordHash)
    ? await legacyBcryptVerify(input.password, passwordCred.passwordHash)
    : await verifyPassword(input.password, passwordCred.passwordHash);
  if (!ok) return { invalid: true };

  // Re-hash legacy bcrypt hashes to Argon2id.
  if (isBcryptHash(passwordCred.passwordHash)) {
    await upsertPasswordCredential(user.id, await hashPassword(input.password));
  } else {
    await updateCredentialLastUsed(passwordCred.id);
  }

  const session = await issueSession(user.id, input.tenantSlug, input.meta, {
    requireTenantSlug: Boolean(input.tenantSlug),
  });
  session.isNewUser = false;
  return { session };
}

/**
 * Set / change the password credential for an authenticated user.
 * All existing sessions are revoked for security.
 */
export async function setUserPassword(userId: string, newPassword: string) {
  const hash = await hashPassword(newPassword);
  await upsertPasswordCredential(userId, hash);
  await revokeAllTokens(userId);
}

/** Revoke a single session (logout) by raw refresh token. */
export async function logout(rawRefreshToken: string): Promise<boolean> {
  return revokeToken(rawRefreshToken);
}

/** Revoke all sessions (logout-all-devices). */
export async function logoutAll(userId: string) {
  await revokeAllTokens(userId);
}

/** Refresh flow: validate + rotate the refresh token and re-issue tokens. */
export async function refreshSession(rawRefreshToken: string, meta: SessionMeta = {}) {
  const stored = await validateToken(rawRefreshToken);
  if (!stored || !stored.userId) return null;

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) return null;

  // Rotate: revoke old, issue new.
  await revokeToken(rawRefreshToken);
  await markTokenUsed(stored.id);
  const session = await issueSession(user.id, undefined, meta);
  return session;
}

export { verifyToken, extractToken };

