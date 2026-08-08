import type { CSSProperties, ReactNode } from "react";

/** Standard widget card shell used by all dashboard widgets. */
export function WidgetShell({
  title,
  subtitle,
  children,
  style,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: CSSProperties;
  actions?: ReactNode;
}) {
  return (
    <section className="ws-widget" style={style}>
      <div className="ws-widget__head">
        <div>
          <h3 className="ws-widget__title">{title}</h3>
          {subtitle ? <p className="ws-widget__sub">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="ws-widget__body">{children}</div>
    </section>
  );
}

export function WidgetEmpty({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[96px] items-center justify-center text-sm text-[var(--ink-soft)]/80">
      {message}
    </div>
  );
}

export function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[96px] items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 text-center text-xs text-[var(--danger)]">
      {message}
    </div>
  );
}

export function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}
