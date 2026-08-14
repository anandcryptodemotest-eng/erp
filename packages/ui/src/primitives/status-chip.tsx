import type { ReactNode } from "react";
import { cn } from "../utils";

export type StatusChipTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

export type StatusChipProps = {
  children?: ReactNode;
  tone?: StatusChipTone;
  /** Domain status string — mapped to tone when `tone` omitted */
  status?: string;
  className?: string;
};

const TONE_CLASS: Record<StatusChipTone, string> = {
  success: "erp-status-chip--success",
  warning: "erp-status-chip--warning",
  danger: "erp-status-chip--danger",
  neutral: "erp-status-chip--neutral",
  info: "erp-status-chip--info",
  brand: "erp-status-chip--brand",
};

const STATUS_TONE: Record<string, StatusChipTone> = {
  PAID: "success",
  ACTIVE: "success",
  APPROVED: "success",
  COMPLETED: "success",
  PUBLISHED: "success",
  SHIPPED: "success",
  RECEIVED: "success",
  DELIVERED: "success",
  APPLIED: "success",
  REFUNDED: "success",
  PARTIAL: "warning",
  PARTIALLY_PAID: "warning",
  PARTIALLY_SHIPPED: "warning",
  PARTIALLY_RECEIVED: "warning",
  PENDING: "warning",
  SUBMITTED: "warning",
  IN_PROGRESS: "warning",
  FULFILLING: "warning",
  OPEN: "warning",
  ASSIGNED: "info",
  ACCEPTED: "warning",
  PICKED_UP: "warning",
  OVERDUE: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  VOID: "neutral",
  DRAFT: "neutral",
  CLOSED: "success",
  ISSUED: "info",
  SENT: "info",
  DISPATCHED: "info",
  CONVERTED: "info",
  CONFIRMED: "brand",
  INVOICED: "brand",
  READY_FOR_DISPATCH: "brand",
};

function toneForStatus(status?: string): StatusChipTone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toUpperCase()] ?? "neutral";
}

/** Shared status chip — do not invent page-local status colors. */
export function StatusChip({ children, tone, status, className }: StatusChipProps) {
  const resolved = tone ?? toneForStatus(status);
  const label =
    children ??
    (status ? status.replace(/_/g, " ") : "—");
  return (
    <span className={cn("erp-status-chip", TONE_CLASS[resolved], className)}>{label}</span>
  );
}
