import { type LucideIcon, Inbox } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "./utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mist)]">
        <Icon className="h-6 w-6 text-[var(--ink-soft)]" />
      </div>
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-[var(--ink-soft)]">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
