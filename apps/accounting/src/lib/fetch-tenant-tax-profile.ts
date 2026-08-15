import { serviceClient } from "@erp/config";
import { parseTenantTaxProfile, type TenantTaxProfile } from "@erp/tax-india";

export async function fetchTenantTaxContext(tenantId: string): Promise<{
  profile: TenantTaxProfile;
  logoUrl: string;
}> {
  const res = await serviceClient.call<{
    data: { profile?: TenantTaxProfile; settings?: Record<string, string> };
  }>("core", `/api/internal/tenants/${tenantId}/tax-profile`, { method: "GET", tenantId });
  const profile = res.data?.data?.profile ?? parseTenantTaxProfile({});
  const logo = res.data?.data?.settings?.["brand.logo"];
  const logoUrl =
    typeof logo === "string" && logo.trim() ? logo.trim() : process.env.TENANT_LOGO_URL || "";
  return { profile, logoUrl };
}

export async function fetchTenantTaxProfile(tenantId: string): Promise<TenantTaxProfile> {
  const { profile } = await fetchTenantTaxContext(tenantId);
  return profile;
}
