/**
 * Resolve which organisation (tenant) this customer portal belongs to.
 * Priority: ?tenant= / ?t= → subdomain → NEXT_PUBLIC_TENANT_SLUG → default.
 * Customers never type this — it comes from the link/domain they opened.
 */

const DEFAULT_SLUG = "trustwood-enterprise";

const RESERVED_HOST_LABELS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "localhost",
  "127",
  "local",
]);

export function tenantSlugFromHost(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return null;

  // trustwood-enterprise.localhost or org.orders.example.com → first label
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) {
    const sub = parts[0];
    if (sub && !RESERVED_HOST_LABELS.has(sub) && !/^\d+$/.test(sub)) {
      return sub;
    }
  }
  return null;
}

export function tenantSlugFromSearch(search: string): string | null {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const slug = q.get("tenant") ?? q.get("t");
  return slug?.trim() || null;
}

/** Browser-side resolution */
export function resolveTenantSlug(opts?: {
  hostname?: string;
  search?: string;
}): string {
  if (typeof window !== "undefined") {
    const fromQuery = tenantSlugFromSearch(opts?.search ?? window.location.search);
    if (fromQuery) return fromQuery;
    const fromHost = tenantSlugFromHost(opts?.hostname ?? window.location.hostname);
    if (fromHost) return fromHost;
  } else {
    if (opts?.search) {
      const fromQuery = tenantSlugFromSearch(opts.search);
      if (fromQuery) return fromQuery;
    }
    if (opts?.hostname) {
      const fromHost = tenantSlugFromHost(opts.hostname);
      if (fromHost) return fromHost;
    }
  }

  return (
    process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() ||
    process.env.DEFAULT_TENANT_SLUG?.trim() ||
    DEFAULT_SLUG
  );
}

/** Friendly org name shown on login (not the slug) */
export function resolveTenantDisplayName(): string {
  return (
    process.env.NEXT_PUBLIC_TENANT_NAME?.trim() ||
    "Trust Wood"
  );
}
