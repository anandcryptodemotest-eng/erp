"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

/** @maturity beta — field / delivery surfaces */
export function RouteCard({
  title,
  subtitle,
  status,
  href,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-[var(--ink)]">{title}</div>
          {subtitle ? <div className="mt-0.5 text-sm text-[var(--ink-soft)]">{subtitle}</div> : null}
        </div>
        {status}
      </div>
      {children}
    </>
  );
  const cls = cn(
    "block rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-[var(--pad-surface)] shadow-[var(--shadow-sm)]",
    className
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** @maturity beta */
export function DeliveryStatus({
  label,
  tone = "default",
  className,
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    default: "bg-[var(--mist)] text-[var(--ink-soft)]",
    success: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
    danger: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
    info: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

/** @maturity internal — placeholder for signature capture */
export function SignaturePad({
  className,
  label = "Signature",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[8rem] items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--mist)]/50 text-sm text-[var(--ink-soft)]",
        className
      )}
      role="img"
      aria-label={label}
    >
      {label} pad
    </div>
  );
}
