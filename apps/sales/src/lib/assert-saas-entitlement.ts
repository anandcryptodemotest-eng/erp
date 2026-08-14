import { NextResponse } from "next/server";
import { serviceClient } from "@erp/config";

type EntitlementPayload = {
  data?: { licensed?: boolean; reason?: string; features?: string[] };
};

export async function assertSaasEntitlement(
  tenantId: string,
  feature?: string
): Promise<NextResponse | null> {
  const res = await serviceClient.call<EntitlementPayload>(
    "core",
    `/api/internal/tenants/${tenantId}/saas-entitlement`,
    { method: "GET", tenantId }
  );
  if (res.error || res.status !== 200 || !res.data?.data) {
    return NextResponse.json(
      { error: "SaaS entitlement unavailable", code: "SAAS_ENTITLEMENT" },
      { status: 403 }
    );
  }
  const ent = res.data.data;
  if (!ent.licensed) {
    return NextResponse.json(
      {
        error: "Sankalp subscription required to create new orders",
        code: "SAAS_UNLICENSED",
        reason: ent.reason,
      },
      { status: 403 }
    );
  }
  const features = ent.features ?? [];
  if (feature && !features.includes("*") && !features.includes(feature)) {
    return NextResponse.json(
      {
        error: `Plan does not include ${feature}`,
        code: "SAAS_FEATURE",
        reason: feature,
      },
      { status: 403 }
    );
  }
  return null;
}
