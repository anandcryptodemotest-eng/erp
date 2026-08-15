import { serviceClient } from "@erp/config";
import { parseTenantTaxProfile, type TenantTaxProfile } from "@erp/tax-india";

export async function fetchTenantLogoUrl(tenantId: string): Promise<string> {
  const res = await serviceClient.call<{ data: { settings?: Record<string, string> } }>(
    "core",
    `/api/internal/tenants/${tenantId}/tax-profile`,
    { method: "GET", tenantId }
  );
  const logo = res.data?.data?.settings?.["brand.logo"];
  if (typeof logo === "string" && logo.trim()) return logo.trim();
  return process.env.TENANT_LOGO_URL || "";
}

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
