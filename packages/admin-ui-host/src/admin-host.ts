/**
 * Admin Host adapter (ADR 0010 / 0011).
 * Wraps OMS Screen Controller wiring — runtime stays host-agnostic.
 */

import type { Host, HostServices, PermissionProvider } from "@erp/ui-runtime";

export function createAdminHost(opts: {
  permissions: PermissionProvider;
  services?: HostServices;
  themeId?: string;
  navigation?: Host["navigation"];
}): Host {
  return {
    id: "ADMIN",
    permissions: opts.permissions,
    navigation: opts.navigation ?? {},
    theme: { themeId: opts.themeId ?? "oms-default" },
    services: opts.services ?? {},
  };
}
