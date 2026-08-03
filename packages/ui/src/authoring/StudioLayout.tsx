"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type StudioLayoutProps = {
  header: ReactNode;
  rail: ReactNode;
  workspace: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
  className?: string;
  workspaceKey?: string;
  /** page = full admin main; dialog = modal shell (legacy) */
  variant?: "page" | "dialog";
};

/**
 * Three-column authoring shell: StepRail | Workspace | Summary + sticky footer.
 */
export function StudioLayout({
  header,
  rail,
  workspace,
  summary,
  footer,
  className,
  workspaceKey,
  variant = "dialog",
}: StudioLayoutProps) {
  const isPage = variant === "page";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-[var(--canvas)]",
        isPage
          ? "h-full min-h-0 w-full"
          : "w-full max-w-6xl max-h-[92vh] rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow)]",
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-[var(--line)]",
          isPage ? "bg-[var(--canvas)] px-6 py-4" : "bg-[var(--canvas)] px-5 py-3.5"
        )}
      >
        {header}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "hidden shrink-0 overflow-y-auto border-r border-[var(--line)] bg-[var(--surface-raised)] sm:block",
            isPage ? "w-56 xl:w-60" : "w-[11.5rem] md:w-52 bg-[var(--mist)]/60"
          )}
        >
          {rail}
        </aside>

        <main
          key={workspaceKey}
          className={cn(
            "studio-fade-in min-w-0 flex-1 overflow-y-auto",
            isPage ? "bg-[var(--mist)]/50 px-5 py-5 xl:px-6" : "bg-[var(--mist)]/40 px-4 py-4 sm:px-5"
          )}
        >
          {workspace}
        </main>

        <aside
          className={cn(
            "hidden shrink-0 overflow-y-auto border-l border-[var(--line)] bg-[var(--surface-raised)] lg:block",
            isPage ? "w-64 xl:w-72 p-4" : "w-[13.5rem] xl:w-56 p-3 bg-[var(--canvas)]"
          )}
        >
          {summary}
        </aside>
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-[var(--line)] bg-[var(--surface-raised)]",
          isPage ? "px-6 py-3.5" : "bg-[var(--mist)] px-4 py-3 sm:px-5"
        )}
      >
        {footer}
      </div>
    </div>
  );
}
