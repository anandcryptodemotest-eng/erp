/**
 * Host abstraction (ADR 0010 / 0011).
 * Runtime stays host-agnostic; Hosts supply providers and optional services.
 */

import type { ThemeTokens } from "@erp/extensions";
import type { AttachmentItem, HostApis } from "./types";

export type HostId = "ADMIN" | "CUSTOMER" | "WAREHOUSE" | "DRIVER" | "VENDOR" | (string & {});

export interface PermissionProvider {
  canEdit: boolean;
  canComplete: boolean;
  roles: string[];
}

export interface NavigationProvider {
  push?(path: string): void;
  back?(): void;
  replace?(path: string): void;
}

export interface ThemeProvider {
  themeId?: string;
  tokens?: ThemeTokens;
}

/** Optional Host capabilities — expose only what the Host needs (ADR 0011). */
export interface HostServices {
  submit?: (payload: Record<string, unknown>) => Promise<void>;
  upload?: (file: File) => Promise<AttachmentItem | unknown>;
  open?: (ref: string) => void;
  download?: (ref: string) => Promise<void>;
  print?: (ref: string) => void;
}

/**
 * First-class Host unit of composition.
 * Screen Controller bridges Host → UIContext → Runtime.
 */
export interface Host {
  id: HostId;
  permissions: PermissionProvider;
  navigation: NavigationProvider;
  theme: ThemeProvider;
  services: HostServices;
}

/** Map Host.services into UIContext.hostApis (widgets never import Host). */
export function hostServicesToHostApis(services: HostServices): HostApis {
  return {
    uploadFile: services.upload
      ? async (file) => {
          const r = await services.upload!(file);
          return r as AttachmentItem;
        }
      : undefined,
  };
}

/** ADR 0012 — empty audiences ⇒ Admin-only legacy forms. */
export function formMatchesAudience(
  audiences: string[] | undefined | null,
  hostId: string
): boolean {
  const list = audiences?.length ? audiences : ["ADMIN"];
  return list.includes(hostId);
}
