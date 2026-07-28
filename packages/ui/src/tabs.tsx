"use client";

import { cn } from "./utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-slate-200", className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-xs",
                  isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-500 rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}
