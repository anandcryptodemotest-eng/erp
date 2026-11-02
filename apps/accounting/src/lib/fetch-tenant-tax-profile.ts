import { serviceClient } from "@erp/config";
import { parseTenantTaxProfile, type TenantTaxProfile } from "@erp/tax-india";

export async function fetchTenantTaxContext(tenantId: string): Promise<{
  profile: TenantTaxProfile;
  logoUrl: string;
  upiVpa: string;
  upiPayeeName: string;
}> {
  const res = await serviceClient.call<{
    data: { profile?: TenantTaxProfile; settings?: Record<string, string> };
  }>("core", `/api/internal/tenants/${tenantId}/tax-profile`, { method: "GET", tenantId });
  const profile = res.data?.data?.profile ?? parseTenantTaxProfile({});
  const settings = res.data?.data?.settings ?? {};
  const logo = settings["brand.logo"];
  const logoUrl =
    typeof logo === "string" && logo.trim() ? logo.trim() : process.env.TENANT_LOGO_URL || "";
  const upiVpa = typeof settings["payments.upi.vpa"] === "string" ? settings["payments.upi.vpa"].trim() : "";
  const named =
    typeof settings["payments.upi.payeeName"] === "string" ? settings["payments.upi.payeeName"].trim() : "";
  const upiPayeeName = named || (profile.legalName ?? "").trim();
  return { profile, logoUrl, upiVpa, upiPayeeName };
}

export async function fetchTenantTaxProfile(tenantId: string): Promise<TenantTaxProfile> {
  const { profile } = await fetchTenantTaxContext(tenantId);
  return profile;
}
