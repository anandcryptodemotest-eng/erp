import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "./utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 mt-1" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
          {item.href ? (
            <a href={item.href} className="hover:text-slate-700">
              {item.label}
            </a>
          ) : (
            <span className="text-slate-500">{item.label}</span>
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
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      </div>
      <div className="flex items-center gap-3">
        {secondaryActions}
        {primaryAction}
      </div>
    </div>
  );
}
