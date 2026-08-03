import { cn } from "./utils";
import { type ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--mist)] text-[var(--ink-soft)]",
  success: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
  info: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  purple: "bg-[var(--mist)] text-[var(--brand-mid)]",
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

const STATUS_MAP: Record<string, string> = {
  DRAFT: "bg-[var(--mist)] text-[var(--ink-soft)]",
  PUBLISHED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  PENDING: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  SUBMITTED: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  IN_PROGRESS: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  APPROVED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  ACTIVE: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  CONFIRMED: "bg-[var(--mist)] text-[var(--brand-mid)]",
  PARTIALLY_SHIPPED: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  PARTIALLY_RECEIVED: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  SHIPPED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  RECEIVED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  COMPLETED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  PAID: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  INVOICED: "bg-[var(--mist)] text-[var(--brand-mid)]",
  PROCESSED: "bg-[var(--mist)] text-[var(--brand-mid)]",
  OVERDUE: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
  REJECTED: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
  CANCELLED: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
  VOID: "bg-[var(--mist)] text-[var(--ink-soft)] opacity-70",
  ISSUED: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  APPLIED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  REFUNDED: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  OPEN: "bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--ink)]",
  CONVERTED: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status?.toUpperCase?.() ?? "";
  const style = STATUS_MAP[key] ?? "bg-[var(--mist)] text-[var(--ink-soft)]";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      {status?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}
