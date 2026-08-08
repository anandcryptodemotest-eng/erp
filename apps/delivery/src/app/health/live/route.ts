import { NextResponse } from "next/server";
import { livePayload } from "@erp/telemetry/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(livePayload(process.env.SERVICE_NAME || "delivery"));
}
