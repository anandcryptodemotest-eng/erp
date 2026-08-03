"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type WorkspaceCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
};

export function WorkspaceCard({ title, description, children, className, headerRight }: WorkspaceCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)] sm:p-5",
        className
      )}
    >
      {(title || headerRight) && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="font-display text-base font-semibold text-[var(--ink)] tracking-tight">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--ink-soft)] leading-relaxed">{description}</p>
            ) : null}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </section>
  );
}
