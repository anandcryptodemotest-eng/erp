import type { ReactNode } from "react";
import { cn } from "../utils";

export type WorkspaceHeroProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Shared page hero for Dashboard + Order Desk (and other workspaces). */
export function WorkspaceHero({
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: WorkspaceHeroProps) {
  return (
    <header className={cn("ws-hero", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="ws-hero__eyebrow">{eyebrow}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="ws-hero__title">{title}</h1>
          {badge}
        </div>
        {description ? <p className="ws-hero__desc">{description}</p> : null}
      </div>
      {actions ? <div className="ws-hero__actions">{actions}</div> : null}
    </header>
  );
}
