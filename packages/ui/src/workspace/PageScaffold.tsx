import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils";
import { WorkspaceHero, type WorkspaceHeroProps } from "./WorkspaceHero";

export type PageScaffoldProps = {
  children: ReactNode;
  className?: string;
  /** Skip page-enter motion (e.g. nested panels) */
  noEnter?: boolean;
  /** Optional max width override */
  wide?: boolean;
  hero?: WorkspaceHeroProps;
  /** Content below hero (filters, KPIs) before main children */
  ahead?: ReactNode;
  style?: CSSProperties;
};

/**
 * Mandatory list/ops page chrome for Design System v2.
 * Prefer this over page-local headers. Existing PageHeader must migrate here.
 */
export function PageScaffold({
  children,
  className,
  noEnter,
  wide,
  hero,
  ahead,
  style,
}: PageScaffoldProps) {
  return (
    <div
      className={cn("ws-page", !noEnter && "erp-page-enter", wide && "ws-page--wide", className)}
      style={style}
    >
      {hero ? <WorkspaceHero {...hero} /> : null}
      {ahead}
      {children}
    </div>
  );
}
