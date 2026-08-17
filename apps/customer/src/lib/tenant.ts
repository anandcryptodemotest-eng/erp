/**
 * Resolve which organisation (tenant) this customer portal belongs to.
 * Priority: ?tenant= / ?t= → same-tab query override → subdomain → host cache → env/default.
 * On a shared IP, ?tenant= is the only way to open a non-default org.
 *
 * Display name: always from tenant branding API (brand.displayName || tenant.name).
 */

import { storage } from "@/lib/platform/storage";

const DEFAULT_SLUG = "wimflo";
const DISPLAY_NAME_CACHE_KEY = "customer_tenant_display_name";
const DISPLAY_NAME_SLUG_KEY = "customer_tenant_display_slug";
const HOST_TENANT_CACHE_KEY = "customer_host_tenant_slug";
const QUERY_TENANT_SESSION_KEY = "customer_query_tenant_slug";

const RESERVED_HOST_LABELS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "localhost",
  "127",
  "local",
]);

/** Machine / VPS FQDNs must not be treated as tenant slugs. */
function looksLikeMachineLabel(label: string): boolean {
  if (label.length > 40) return true;
  if (/vps|noidageneral|wd\d{6,}/i.test(label)) return true;
  if (!label.includes("-") && /[0-9]/.test(label) && label.length > 20) return true;
  return false;
}

export function tenantSlugFromHost(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return null;

  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) {
    const sub = parts[0];
    if (
      sub &&
      !RESERVED_HOST_LABELS.has(sub) &&
      !/^\d+$/.test(sub) &&
      !looksLikeMachineLabel(sub)
    ) {
      return sub;
    }
  }
  return null;
}

export function tenantSlugFromSearch(search: string): string | null {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const slug = q.get("tenant") ?? q.get("t");
  return slug?.trim().toLowerCase() || null;
}

function readSessionQueryTenant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(QUERY_TENANT_SESSION_KEY)?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Keep ?tenant= for this tab after navigation drops the query (e.g. /login → /shop). */
export function rememberQueryTenant(slug: string) {
  const s = slug.trim().toLowerCase();
  if (!s || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(QUERY_TENANT_SESSION_KEY, s);
  } catch {
    /* ignore */
  }
}

/** True for VPS / shared-IP hosts that must not auto-bind a default tenant. */
export function isSharedIpHostname(hostname: string): boolean {
  const host = hostname.split(":")[0];
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** Read ?tenant= / ?t= from the live browser URL (static login pages miss useSearchParams). */
export function tenantSlugFromBrowser(): string {
  if (typeof window === "undefined") return "";
  return tenantSlugFromSearch(window.location.search) ?? "";
}

/** Explicit link/session override — wins over hostname → Trustwood on a shared IP. */
export function explicitTenantOverride(search?: string): string | null {
  const fromQuery = tenantSlugFromSearch(
    search ?? (typeof window !== "undefined" ? window.location.search : "")
  );
  if (fromQuery) {
    rememberQueryTenant(fromQuery);
    return fromQuery;
  }
  return readSessionQueryTenant();
}

/** Browser-side resolution */
export function resolveTenantSlug(opts?: {
  hostname?: string;
  search?: string;
}): string {
  const override = explicitTenantOverride(opts?.search);
  if (override) return override;

  if (typeof window !== "undefined") {
    try {
      const cached = storage.get(HOST_TENANT_CACHE_KEY);
      const cachedHost = storage.get(`${HOST_TENANT_CACHE_KEY}:host`);
      const host = (opts?.hostname ?? window.location.hostname).toLowerCase();
      if (cached && cachedHost === host) return cached;
    } catch {
      /* ignore */
    }
    const fromHost = tenantSlugFromHost(opts?.hostname ?? window.location.hostname);
    if (fromHost) return fromHost;
  } else if (opts?.hostname) {
    const fromHost = tenantSlugFromHost(opts.hostname);
    if (fromHost) return fromHost;
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim();
  if (fromEnv) return fromEnv;

  // Shared IP without ?tenant=: prefer WimFlo rather than blank chrome.
  if (typeof window !== "undefined" && isSharedIpHostname(window.location.hostname)) {
    return DEFAULT_SLUG;
  }

  if (process.env.NODE_ENV === "production") return "";
  return DEFAULT_SLUG;
}

/** Resolve a verified custom hostname through Gateway and cache it for browser API calls. */
export async function resolveTenantSlugByHostname(
  hostname?: string,
  portalType = "CUSTOMER"
): Promise<string | null> {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).trim().toLowerCase();
  if (!host) return null;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(
      `${origin}/api/public/tenants/resolve?hostname=${encodeURIComponent(host)}&portalType=${encodeURIComponent(portalType)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { slug?: string } };
    const slug = json.data?.slug?.trim().toLowerCase();
    if (!slug || typeof window === "undefined") return slug || null;
    storage.set(HOST_TENANT_CACHE_KEY, slug);
    storage.set(`${HOST_TENANT_CACHE_KEY}:host`, host);
    return slug;
  } catch {
    return null;
  }
}

export type TenantBranding = {
  slug: string;
  displayName: string;
  branding?: { logo: string | null; accent: string; theme: string };
};

function readCachedDisplayName(slug: string): string | null {
  try {
    const cachedSlug = storage.get(DISPLAY_NAME_SLUG_KEY);
    const name = storage.get(DISPLAY_NAME_CACHE_KEY);
    if (cachedSlug === slug && name?.trim()) return name.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedDisplayName(slug: string, name: string) {
  try {
    storage.set(DISPLAY_NAME_SLUG_KEY, slug);
    storage.set(DISPLAY_NAME_CACHE_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Deterministic label from slug — identical on server and first client paint. */
export function displayNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Sync fallback for non-render helpers.
 * Do NOT use for React initial state — localStorage causes hydration mismatches.
 * Prefer TenantBrandingProvider / useTenantDisplayName().
 */
export function resolveTenantDisplayName(): string {
  const slug = resolveTenantSlug();
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_NAME?.trim();
  if (fromEnv) return fromEnv;
  return displayNameFromSlug(slug);
}

/** Client-only: previously fetched display name for this slug. */
export function peekCachedTenantDisplayName(slug?: string): string | null {
  if (typeof window === "undefined") return null;
  return readCachedDisplayName((slug ?? resolveTenantSlug()).trim());
}

/** Fetch brand.displayName || tenant.name from Gateway public branding API. */
export async function fetchTenantBranding(slug?: string): Promise<TenantBranding | null> {
  const s = (slug ?? resolveTenantSlug()).trim().toLowerCase();
  if (!s) return null;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/public/tenants/${encodeURIComponent(s)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: TenantBranding };
    const data = json.data;
    if (!data?.displayName?.trim()) return null;
    writeCachedDisplayName(data.slug || s, data.displayName.trim());
    return { ...data, displayName: data.displayName.trim() };
  } catch {
    return null;
  }
}
