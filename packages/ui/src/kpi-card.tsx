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
  onClick?: () => void;
  className?: string;
}

const COLOR_CLASSES: Record<NonNullable<KpiCardProps["color"]>, string> = {
  indigo: "bg-[var(--mist)] text-[var(--brand)]",
  emerald: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
  amber: "bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent)]",
  red: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
  blue: "bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-[var(--info)]",
  violet: "bg-[var(--mist)] text-[var(--brand-mid)]",
  slate: "bg-[var(--mist)] text-[var(--ink-soft)]",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  color = "indigo",
  trend,
  trendValue,
  subtext,
  href,
  onClick,
  className,
}: KpiCardProps) {
  const clickable = Boolean(href || onClick);
  const content = (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-sm)] transition-shadow",
        clickable &&
          "cursor-pointer hover:shadow-[var(--shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        !clickable && "hover:shadow-[var(--shadow)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full", COLOR_CLASSES[color])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              trend >= 0
                ? "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]"
                : "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]"
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendValue ?? `${Math.abs(trend)}%`}
          </span>
        )}
      </div>
      <div className="mt-3 text-sm text-[var(--ink-soft)]">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold text-[var(--ink)]">{value}</div>
      {subtext && <div className="mt-1 text-xs text-[var(--ink-soft)] opacity-80">{subtext}</div>}
      {clickable && !subtext && (
        <div className="mt-2 text-xs font-medium text-[var(--brand-mid)]">View list →</div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
