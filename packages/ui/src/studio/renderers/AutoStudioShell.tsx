"use client";

import { useMediaQuery } from "../../hooks/use-media-query";
import { DesktopRenderer, type DesktopRendererProps } from "./desktop/DesktopRenderer";
import { MobileRenderer, type MobileRendererProps } from "./mobile/MobileRenderer";

export type AutoStudioShellProps = DesktopRendererProps & MobileRendererProps;

/** Optional web helper: inject Desktop or Mobile renderer by breakpoint. */
export function AutoStudioShell(props: AutoStudioShellProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (isDesktop) return <DesktopRenderer {...props} />;
  return <MobileRenderer {...props} />;
}
