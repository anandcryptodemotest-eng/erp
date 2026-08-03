"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";

/**
 * Operational Workspace Framework v0.1 — chrome only.
 * Owns layout slots. Domain modules own business logic (SREQ, SO, tasks, …).
 * Lifecycle: Queue → Claim → Work → Complete → Refresh
 * Kernel / Provider deferred until a second consumer (e.g. Warehouse).
 */

export type WorkspaceLayoutProps = {
  toolbar?: ReactNode;
  filterBar?: ReactNode;
  /** Left queue column */
  queue?: ReactNode;
  /** Primary detail for the selected document */
  detail?: ReactNode;
  /** Optional task / work panel under or beside detail */
  task?: ReactNode;
  bottomBar?: ReactNode;
  /** Extra content above the queue/detail grid (KPIs, alerts) */
  ahead?: ReactNode;
  className?: string;
};

export function WorkspaceLayout({
  toolbar,
  filterBar,
  queue,
  detail,
  task,
  bottomBar,
  ahead,
  className,
}: WorkspaceLayoutProps) {
  return (
    <div
      className={cn("flex min-h-0 w-full flex-1 flex-col", className)}
      style={{ gap: "var(--space-4)" }}
    >
      {toolbar}
      {filterBar}
      {ahead}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]"
        style={{ gap: "var(--space-6)" }}
      >
        {queue}
        <div className="flex min-h-0 min-w-0 flex-col" style={{ gap: "var(--space-4)" }}>
          {detail}
          {task}
        </div>
      </div>
      {bottomBar}
    </div>
  );
}

export type WorkspaceToolbarProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function WorkspaceToolbar({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: WorkspaceToolbarProps) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between", className)}
      style={{ gap: "var(--space-3)" }}
      {...props}
    >
      <div className="min-w-0">
        {title ? (
          <div className="font-display text-xl font-semibold tracking-tight text-[var(--ink)]">{title}</div>
        ) : null}
        {description ? <div className="mt-0.5 text-sm text-[var(--ink-soft)]">{description}</div> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }}>{actions}</div> : null}
    </div>
  );
}

export type WorkspaceFilterBarProps = HTMLAttributes<HTMLDivElement>;

export function WorkspaceFilterBar({ className, children, ...props }: WorkspaceFilterBarProps) {
  return (
    <div
      role="search"
      className={cn("flex flex-wrap items-center", className)}
      style={{ gap: "var(--space-2)" }}
      {...props}
    >
      {children}
    </div>
  );
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Accessible name when title is not a string */
  "aria-label"?: string;
};

function PanelShell({
  title,
  actions,
  children,
  className,
  "aria-label": ariaLabel,
  ...props
}: PanelProps) {
  const label = ariaLabel ?? (typeof title === "string" ? title : undefined);
  return (
    <section
      role="region"
      aria-label={label}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <header
          className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-[var(--space-4)] py-[var(--space-3)] text-sm font-medium text-[var(--ink-soft)]"
          style={{ gap: "var(--space-2)" }}
        >
          <div className="min-w-0">{title}</div>
          {actions ? <div className="flex shrink-0 items-center" style={{ gap: "var(--space-2)" }}>{actions}</div> : null}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function QueuePanel(props: PanelProps) {
  return <PanelShell {...props} aria-label={props["aria-label"] ?? (typeof props.title === "string" ? props.title : "Queue")} />;
}

export function DetailPanel(props: PanelProps) {
  return <PanelShell {...props} aria-label={props["aria-label"] ?? (typeof props.title === "string" ? props.title : "Detail")} />;
}

export function TaskPanel(props: PanelProps) {
  return <PanelShell {...props} aria-label={props["aria-label"] ?? (typeof props.title === "string" ? props.title : "Tasks")} />;
}

export type WorkspaceBottomBarProps = HTMLAttributes<HTMLDivElement>;

export function WorkspaceBottomBar({ className, children, ...props }: WorkspaceBottomBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Workspace actions"
      className={cn(
        "flex flex-wrap items-center border-t-2 border-[var(--line)] bg-[var(--surface-raised)] px-[var(--space-4)] py-[var(--space-3)]",
        className
      )}
      style={{ gap: "var(--space-2)", minHeight: "var(--touch-min)" }}
      {...props}
    >
      {children}
    </div>
  );
}
