import { NextResponse } from "next/server";
import {
  extractToken,
  verifyPlatformToken,
} from "@erp/auth";
import {
  can,
  type PlatformCapability,
  type PlatformRole,
  type PlatformTokenClaims,
} from "@erp/platform-core";

export type PlatformAuthOk = {
  claims: PlatformTokenClaims;
  role: PlatformRole;
};

export async function requirePlatformAuth(
  request: Request,
  capability?: PlatformCapability
): Promise<PlatformAuthOk | NextResponse> {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const claims = await verifyPlatformToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid platform token" }, { status: 401 });
  }
  if (capability && !can(claims.role, capability)) {
    return NextResponse.json({ error: "Insufficient platform permissions" }, { status: 403 });
  }
  return { claims, role: claims.role };
}

export function clientMeta(request: Request) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}
