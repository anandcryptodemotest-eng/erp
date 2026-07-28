import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "./utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: "indigo" | "emerald" | "amber" | "red" | "blue" | "violet" | "slate";
  trend?: number;
  trendValue?: string;
  subtext?: string;
  href?: string;
  className?: string;
}

const COLOR_CLASSES: Record<NonNullable<KpiCardProps["color"]>, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};

export function KpiCard({ label, value, icon: Icon, color = "indigo", trend, trendValue, subtext, href, className }: KpiCardProps) {
  const content = (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-center justify-between">
        {Icon && (
          <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full", COLOR_CLASSES[color])}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendValue ?? `${Math.abs(trend)}%`}
          </span>
        )}
      </div>
      <div className="mt-3 text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-0.5">{value}</div>
      {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  return content;
}
