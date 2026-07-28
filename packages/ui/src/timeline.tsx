import { cn } from "./utils";

export interface TimelineEvent {
  key: string;
  label: string;
  timestamp?: string;
  description?: string;
  state: "completed" | "current" | "pending" | "error";
}

const DOT_CLASSES: Record<TimelineEvent["state"], string> = {
  completed: "bg-indigo-500 border-indigo-500",
  current: "bg-indigo-500 border-indigo-500 ring-4 ring-indigo-100",
  pending: "bg-white border-slate-300",
  error: "bg-red-500 border-red-500",
};

const TEXT_CLASSES: Record<TimelineEvent["state"], string> = {
  completed: "text-slate-900",
  current: "text-slate-900 font-medium",
  pending: "text-slate-400 italic",
  error: "text-red-600",
};

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {events.map((event, i) => (
        <div key={event.key} className="relative flex gap-3 pb-6 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" aria-hidden />
          )}
          <span className={cn("relative z-10 mt-1 h-3 w-3 rounded-full border-2 shrink-0", DOT_CLASSES[event.state])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-sm", TEXT_CLASSES[event.state])}>{event.label}</span>
              {event.timestamp && <span className="text-xs text-slate-400 shrink-0">{event.timestamp}</span>}
            </div>
            {event.description && <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
