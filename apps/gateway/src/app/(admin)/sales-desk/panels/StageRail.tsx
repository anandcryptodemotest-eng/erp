"use client";

import { cn } from "@erp/ui";

export type DeskStage = "inbox" | "mywork" | "active";

const STAGES: { id: DeskStage; label: string; hint: string }[] = [
  { id: "inbox", label: "Inbox", hint: "Sales requests" },
  { id: "mywork", label: "My Work", hint: "Your tasks" },
  { id: "active", label: "Fulfillment", hint: "In flight" },
];

/** Hero stage rail — Inbox → My Work → Fulfillment. */
export function StageRail({
  stage,
  counts,
  onChange,
  className,
}: {
  stage: DeskStage;
  counts: Record<DeskStage, number>;
  onChange: (s: DeskStage) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Order Desk stages" className={cn("ws-stage", className)}>
      {STAGES.map((s, i) => {
        const active = stage === s.id;
        return (
          <div key={s.id} className={cn("ws-stage__item", active && "is-active")}>
            <button type="button" onClick={() => onChange(s.id)} className="ws-stage__btn">
              <span className="ws-stage__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="ws-stage__label">{s.label}</span>
                <span className="ws-stage__hint">{s.hint}</span>
              </span>
              <span className="ws-stage__count">{counts[s.id]}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function deskTabToStage(tab: "sreq" | "tasks" | "inflight"): DeskStage {
  if (tab === "sreq") return "inbox";
  if (tab === "inflight") return "active";
  return "mywork";
}

export function stageToDeskTab(stage: DeskStage): "sreq" | "tasks" | "inflight" {
  if (stage === "inbox") return "sreq";
  if (stage === "active") return "inflight";
  return "tasks";
}
