import { OAuth2Client } from "google-auth-library";
import type { IdentityProvider, VerifiedIdentity } from "@erp/auth";

/**
 * Google Identity Provider using Google Identity Services ID tokens.
 *
 * The GIS library returns a JWT ID token (the `credential`) that this provider
 * verifies against Google's public keys. Because the token is signed by Google
 * and we only verify its signature/audience, no client secret is required for
 * this flow — only GOOGLE_CLIENT_ID.
 */
export class GoogleIdentityProvider implements IdentityProvider {
  readonly name = "google";

  private readonly client: OAuth2Client;

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID is required for the Google identity provider");
    }
    this.client = new OAuth2Client(clientId);
    this.clientId = clientId;
  }

  private readonly clientId: string;

  async verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Google token payload could not be decoded");
    }
    if (!payload.email) {
      throw new Error("Google account has no verified email address");
    }
    return {
      provider: this.name,
      providerId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }
}
