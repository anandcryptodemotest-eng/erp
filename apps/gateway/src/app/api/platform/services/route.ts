import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { aggregateServiceHealth } from "@/lib/platform-services";
import { serviceBuild, serviceVersion } from "@erp/telemetry";

export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;

  const services = await aggregateServiceHealth();
  const healthy = services.filter((s) => s.status === "UP").length;
  const failed = services.filter((s) => s.status === "DOWN").length;

  return NextResponse.json({
    data: services,
    meta: {
      platformVersion: serviceVersion(),
      platformBuild: serviceBuild(),
      healthy,
      failed,
      total: services.length,
      checkedAt: new Date().toISOString(),
    },
  });
}
