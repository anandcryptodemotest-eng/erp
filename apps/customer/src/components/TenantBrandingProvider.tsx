"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  displayNameFromSlug,
  explicitTenantOverride,
  fetchTenantBranding,
  peekCachedTenantDisplayName,
  resolveTenantSlug,
  resolveTenantSlugByHostname,
} from "@/lib/tenant";

type TenantCtx = {
  slug: string;
  displayName: string;
  ready: boolean;
};

const TenantContext = createContext<TenantCtx>({
  slug: "",
  displayName: "",
  ready: false,
});

/**
 * Loads tenant displayName from public branding API (brand.displayName || tenant.name).
 * Initial render uses slug-derived name only (SSR-safe). Cache + API apply after mount.
 * ?tenant= / ?t= wins over hostname (shared IP otherwise always Trustwood).
 */
export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState(() => resolveTenantSlug());
  const [displayName, setDisplayName] = useState(() => displayNameFromSlug(slug));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function apply(nextSlug: string) {
      if (!nextSlug) {
        setReady(true);
        return;
      }
      if (nextSlug !== slug) {
        setSlug(nextSlug);
        setDisplayName(displayNameFromSlug(nextSlug));
        return;
      }
      const cached = peekCachedTenantDisplayName(nextSlug);
      if (cached) setDisplayName(cached);
      const b = await fetchTenantBranding(nextSlug);
      if (cancelled) return;
      if (b?.displayName) setDisplayName(b.displayName);
      setReady(true);
    }

    const override = explicitTenantOverride() ?? (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("tenant") ??
          new URLSearchParams(window.location.search).get("t"))
          ?.trim()
          .toLowerCase() || null
      : null);
    if (override) {
      void apply(override);
      return () => {
        cancelled = true;
      };
    }

    void resolveTenantSlugByHostname().then((resolvedSlug) => {
      if (cancelled) return;
      void apply(resolvedSlug || slug);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const value = useMemo(
    () => ({ slug, displayName, ready }),
    [slug, displayName, ready]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantBranding(): TenantCtx {
  return useContext(TenantContext);
}

/** Convenience — always the live display name string. */
export function useTenantDisplayName(): string {
  return useTenantBranding().displayName;
}
