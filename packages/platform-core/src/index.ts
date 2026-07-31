/** Platform operator roles — not tenant SUPER_ADMIN. */
export const PLATFORM_ROLES = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
  "PLATFORM_VIEWER",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_TOKEN_VERSION = 1;

export type PlatformTokenClaims = {
  sub: string;
  scope: "platform";
  role: PlatformRole;
  ver: number;
};

/** Tenant operational capabilities (not TenantSetting / branding). */
export const CapabilityKey = {
  ProcessStudio: "processStudio",
  AI: "ai",
  AdvancedReports: "advancedReports",
  ApiAccess: "apiAccess",
  SSO: "sso",
} as const;

export type CapabilityKey = (typeof CapabilityKey)[keyof typeof CapabilityKey];

export const CAPABILITY_KEYS = Object.values(CapabilityKey);

/** ModuleLicense moduleIds that commercially allow Process Studio. */
export const PROCESS_STUDIO_LICENSE_MODULES = ["core", "process", "sales"] as const;

export function licenseAllowsProcessStudio(moduleIds: Iterable<string>): boolean {
  const set = moduleIds instanceof Set ? moduleIds : new Set(moduleIds);
  return PROCESS_STUDIO_LICENSE_MODULES.some((m) => set.has(m));
}

export type PlatformCapability =
  | "provisionTenant"
  | "manageLicenses"
  | "disableTenant"
  | "writeSettings"
  | "readAudit"
  | "writeAudit"
  | "manageOperators"
  | "manageProcess"
  | "readAll";

const PERMISSIONS: Record<PlatformRole, ReadonlySet<PlatformCapability>> = {
  PLATFORM_OWNER: new Set([
    "provisionTenant",
    "manageLicenses",
    "disableTenant",
    "writeSettings",
    "readAudit",
    "writeAudit",
    "manageOperators",
    "manageProcess",
    "readAll",
  ]),
  PLATFORM_ADMIN: new Set([
    "provisionTenant",
    "manageLicenses",
    "disableTenant",
    "writeSettings",
    "readAudit",
    "writeAudit",
    "manageProcess",
    "readAll",
  ]),
  PLATFORM_SUPPORT: new Set(["disableTenant", "readAudit", "readAll"]),
  PLATFORM_VIEWER: new Set(["readAudit", "readAll"]),
};

export function isPlatformRole(role: string | null | undefined): boolean {
  return !!role && (PLATFORM_ROLES as readonly string[]).includes(role);
}

export function can(role: PlatformRole, capability: PlatformCapability): boolean {
  return PERMISSIONS[role]?.has(capability) ?? false;
}

export function canProvisionTenant(role: PlatformRole): boolean {
  return can(role, "provisionTenant");
}

export function canManageLicenses(role: PlatformRole): boolean {
  return can(role, "manageLicenses");
}

export function canDisableTenant(role: PlatformRole): boolean {
  return can(role, "disableTenant");
}

export function canWriteSettings(role: PlatformRole): boolean {
  return can(role, "writeSettings");
}

export function canReadAudit(role: PlatformRole): boolean {
  return can(role, "readAudit");
}

export function canManageOperators(role: PlatformRole): boolean {
  return can(role, "manageOperators");
}

export function canManageProcess(role: PlatformRole): boolean {
  return can(role, "manageProcess");
}

export const PLATFORM_AUDIT_ACTIONS = [
  "AUTH_LOGIN",
  "TENANT_CREATED",
  "TENANT_UPDATED",
  "TENANT_DISABLED",
  "TENANT_ENABLED",
  "TENANT_CAPABILITY_UPDATED",
  "LICENSE_UPDATED",
  "SETTINGS_UPDATED",
] as const;

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

export type ServiceHealthStatus = "UP" | "DEGRADED" | "DOWN";

export type ServiceHealthRow = {
  id: string;
  name: string;
  environment: string;
  status: ServiceHealthStatus;
  live: boolean;
  ready: boolean;
  version: string | null;
  build: string | null;
  commit: string | null;
  latencyMs: number | null;
  checkedAt: string;
  error?: string;
};

export type ProvisionTenantResponse = {
  tenantId: string;
  slug: string;
  adminEmail: string;
  loginUrl: string;
};

export type ProvisionTenantInput = {
  name: string;
  slug: string;
  plan?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword: string;
};
