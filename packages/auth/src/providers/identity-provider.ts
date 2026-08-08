/**
 * Provider-agnostic identity abstraction.
 *
 * Each IdentityProvider knows how to verify an identity token issued by an
 * external identity provider (Google today; Microsoft, Apple, SAML later) and
 * normalise the result into a common shape. Adding a new provider later only
 * requires a new implementation + registration in `providers/index.ts` — no
 * schema change.
 */
export interface VerifiedIdentity {
  /** Provider key, e.g. "google". */
  provider: string;
  /** Provider subject (stable id), e.g. Google `sub`. */
  providerId: string;
  /** Verified email address. */
  email: string;
  /** Whether the provider has verified the email. */
  emailVerified: boolean;
  /** Display name if the provider supplied one. */
  name?: string | null;
  /** Optional avatar URL. */
  picture?: string | null;
}

export interface IdentityProvider {
  readonly name: string;
  verifyIdToken(idToken: string): Promise<VerifiedIdentity>;
}
