import { NextResponse } from "next/server";
import { livePayload } from "@erp/telemetry";

export const dynamic = "force-dynamic";

/** Alias of /health/live for back-compat. */
export async function GET() {
  return NextResponse.json(livePayload(process.env.SERVICE_NAME || "inventory"));
}
