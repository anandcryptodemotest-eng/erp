import { NextResponse } from "next/server";
import { readyPayload, telemetryCheck, type CheckStatus } from "@erp/telemetry";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Alias: combined ready-style health for platform aggregator tooling. */
export async function GET() {
  const checks: Record<string, CheckStatus> = {
    telemetry: telemetryCheck(),
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "UP";
  } catch {
    checks.database = "DOWN";
  }
  const body = readyPayload(process.env.SERVICE_NAME || "delivery", checks);
  const status = body.status === "UP" ? 200 : 503;
  return NextResponse.json(body, { status });
}
