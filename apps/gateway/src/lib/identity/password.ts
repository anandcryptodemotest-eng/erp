import * as argon2 from "@node-rs/argon2";

/**
 * Argon2id password hashing/verification.
 *
 * @node-rs/argon2 ships prebuilt native binaries. This module lives in the
 * gateway app (not the shared @erp/auth package) to avoid Next.js webpack
 * attempting to bundle its WASM fallback exports.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function isBcryptHash(hash: string | null | undefined): boolean {
  return !!hash && /^\$2[aby]\$/.test(hash);
}

export async function legacyBcryptVerify(plain: string, bcryptHash: string): Promise<boolean> {
  try {
    const bcrypt = await import("bcryptjs");
    return await bcrypt.compare(plain, bcryptHash);
  } catch {
    return false;
  }
}
