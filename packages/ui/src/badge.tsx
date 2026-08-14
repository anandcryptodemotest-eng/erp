import { cn } from "./utils";
import { type ReactNode } from "react";
import { StatusChip, type StatusChipTone } from "./primitives/status-chip";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "brand";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--mist)] text-[var(--ink-soft)]",
  success: "bg-[color-mix(in_srgb,var(--success)_16%,white)] text-[var(--success)]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[color-mix(in_srgb,var(--warning)_80%,black)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_14%,white)] text-[var(--danger)]",
  info: "bg-[color-mix(in_srgb,var(--info)_14%,white)] text-[var(--info)]",
  brand: "bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-[var(--brand-dark)]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Prefer StatusChip on new screens. StatusBadge remains as a thin adapter. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusChip status={status} className={className} />;
}

export type { StatusChipTone };
