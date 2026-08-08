import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export class IntegrationEncryptionError extends Error {
  constructor(message = "Integration encryption is not configured") {
    super(message);
    this.name = "IntegrationEncryptionError";
  }
}

/** 32-byte key from hex `INTEGRATION_ENCRYPTION_KEY`. */
export function getIntegrationEncryptionKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new IntegrationEncryptionError(
      "INTEGRATION_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getIntegrationEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptSecret(input: { ciphertext: string; iv: string; authTag: string }): string {
  const decipher = createDecipheriv(
    ALGO,
    getIntegrationEncryptionKey(),
    Buffer.from(input.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function lastFourOfSecret(secret: string): string {
  const trimmed = secret.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

export function otpPepper(): string {
  return process.env.OTP_PEPPER?.trim() || process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || "";
}
