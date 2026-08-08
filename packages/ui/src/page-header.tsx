import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "./utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ink-soft)]" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-soft)] opacity-50" />}
          {item.href ? (
            <a href={item.href} className="hover:text-[var(--ink)]">
              {item.label}
            </a>
          ) : (
            <span className="text-[var(--ink-soft)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, breadcrumb, primaryAction, secondaryActions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold text-[var(--ink)] sm:text-2xl">{title}</h1>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {secondaryActions}
        {primaryAction}
      </div>
    </div>
  );
}
