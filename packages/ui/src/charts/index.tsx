/** Reserved for platform dashboards — chart library TBD. */
export const CHARTS_READY = false;

export type ChartPlaceholder = {
  title: string;
  note?: string;
};

/** Placeholder until a chart lib is chosen — do not use in production UI. */
export function ChartSlot({ title, note }: ChartPlaceholder) {
  return (
    <div
      className="flex min-h-[12rem] flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--mist)]/40 p-6 text-center"
      data-charts-slot
    >
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">{note ?? "Charts reserved in @erp/ui/charts"}</p>
    </div>
  );
}
