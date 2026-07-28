import { cn } from "./utils";
import { type ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-violet-100 text-violet-700",
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
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variantStyles[variant], className)}>
      {children}
    </span>
  );
}

/**
 * Auto-maps a status string (order/invoice/payroll/etc. status) to the
 * canonical bg/text color pair defined in docs/UI-DESIGN.md §12.4.
 * Falls back to the default slate style for unmapped statuses.
 */
const STATUS_MAP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-100 text-amber-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-violet-100 text-violet-700",
  PARTIALLY_SHIPPED: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-emerald-100 text-emerald-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-emerald-100 text-emerald-700",
  INVOICED: "bg-violet-100 text-violet-700",
  PROCESSED: "bg-violet-100 text-violet-700",
  OVERDUE: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  VOID: "bg-slate-100 text-slate-400",
  ISSUED: "bg-blue-100 text-blue-700",
  APPLIED: "bg-emerald-100 text-emerald-700",
  REFUNDED: "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status?.toUpperCase?.() ?? "";
  const style = STATUS_MAP[key] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", style, className)}>
      {status?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}
