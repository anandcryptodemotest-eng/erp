import { serviceClient } from "@erp/config";
import { parseTenantTaxProfile, type TenantTaxProfile } from "@erp/tax-india";

export async function fetchTenantTaxProfile(tenantId: string): Promise<TenantTaxProfile> {
  const res = await serviceClient.call<{ data: { profile: TenantTaxProfile } }>(
    "core",
    `/api/internal/tenants/${tenantId}/tax-profile`,
    { method: "GET", tenantId }
  );
  if (res.error || !res.data?.data?.profile) {
    return parseTenantTaxProfile({});
  }
  return res.data.data.profile;
}
