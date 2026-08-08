import { prisma } from "@/lib/prisma";
import { createCredential } from "./credential-service";
import type { CredentialType } from "../../generated/prisma";

/**
 * AccountLinkService — attaches an external identity (e.g. Google) to an
 * existing User by verified email.
 *
 * The verified-email rule prevents account takeover: we only link when BOTH
 * the provider verified the email (Google guarantees this) AND the existing
 * User account has emailVerified = true. An attacker must first claim and
 * verify the email on our side before they could link their provider to it.
 */
export async function linkProviderToUserByEmail(input: {
  email: string;
  type: CredentialType;
  providerId: string;
}): Promise<{ user: { id: string; email: string }; linked: "linked" | "skipped" } | null> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return null;
  if (!user.emailVerified) {
    // Do not link to an unverified account.
    return { user, linked: "skipped" };
  }

  const existing = await prisma.authCredential.findUnique({
    where: { type_providerId: { type: input.type, providerId: input.providerId } },
  });
  if (!existing) {
    await createCredential({
      userId: user.id,
      type: input.type,
      providerId: input.providerId,
    });
  }
  return { user, linked: "linked" };
}
