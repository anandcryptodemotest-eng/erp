"use client";

import { useEffect, useState } from "react";

/** UI hook — layout only */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** UI hook */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Layout token helper */
export function useLayoutTier(): "compact" | "medium" | "wide" {
  const medium = useMediaQuery("(min-width: 768px)");
  const wide = useMediaQuery("(min-width: 1024px)");
  if (wide) return "wide";
  if (medium) return "medium";
  return "compact";
}
