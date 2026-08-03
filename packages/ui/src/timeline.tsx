import { cn } from "./utils";

export interface TimelineEvent {
  key: string;
  label: string;
  timestamp?: string;
  description?: string;
  state: "completed" | "current" | "pending" | "error";
}

const DOT_CLASSES: Record<TimelineEvent["state"], string> = {
  completed: "bg-[var(--brand)] border-[var(--brand)]",
  current: "bg-[var(--brand)] border-[var(--brand)] ring-4 ring-[color-mix(in_srgb,var(--brand)_20%,transparent)]",
  pending: "bg-[var(--surface-raised)] border-[var(--line)]",
  error: "bg-[var(--danger)] border-[var(--danger)]",
};

const TEXT_CLASSES: Record<TimelineEvent["state"], string> = {
  completed: "text-[var(--ink)]",
  current: "text-[var(--ink)] font-medium",
  pending: "text-[var(--ink-soft)] italic",
  error: "text-[var(--danger)]",
};

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {events.map((event, i) => (
        <div key={event.key} className="relative flex gap-3 pb-6 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute left-[5px] top-3 bottom-0 w-px bg-[var(--line)]" aria-hidden />
          )}
          <span className={cn("relative z-10 mt-1 h-3 w-3 rounded-full border-2 shrink-0", DOT_CLASSES[event.state])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-sm", TEXT_CLASSES[event.state])}>{event.label}</span>
              {event.timestamp && (
                <span className="text-xs text-[var(--ink-soft)] shrink-0">{event.timestamp}</span>
              )}
            </div>
            {event.description && <p className="text-xs text-[var(--ink-soft)] mt-0.5">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
