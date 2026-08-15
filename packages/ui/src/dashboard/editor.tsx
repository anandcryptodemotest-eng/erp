"use client";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import type { DashboardConfig, DashboardPlacement } from "./types";
import { allowedWidgets, resolveWidgets } from "./registry";
import { DashboardRenderer } from "./renderer";
import type { DashboardRendererProps } from "./renderer";

export interface DashboardEditorProps extends Omit<DashboardRendererProps, "config"> {
  config: DashboardConfig;
  onChange: (config: DashboardConfig) => void;
  onSave: () => void;
  onReset: () => void;
  saving?: boolean;
}

/**
 * Configurable dashboard: choose what appears, then reorder.
 * Phone (operational): Customize lives under overflow — never a primary first-screen control.
 */
export function DashboardEditor({
  config,
  auth,
  portal,
  fetchData,
  onChange,
  onSave,
  onReset,
  saving,
}: DashboardEditorProps) {
  const [customizing, setCustomizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneOps, setPhoneOps] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = () => {
      const mode = document.querySelector(".admin-shell")?.getAttribute("data-admin-mode");
      setPhoneOps(mode === "operational" && window.matchMedia("(max-width: 767px)").matches);
    };
    apply();
    window.addEventListener("resize", apply);
    const shell = document.querySelector(".admin-shell");
    const mo = shell ? new MutationObserver(apply) : null;
    if (shell && mo) mo.observe(shell, { attributes: true, attributeFilter: ["data-admin-mode"] });
    return () => {
      window.removeEventListener("resize", apply);
      mo?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const catalog = allowedWidgets(auth, portal).filter(
    (w) => !config.widgets.some((p) => p.type === w.id)
  );

  const update = (widgets: DashboardPlacement[]) => onChange({ ...config, widgets });

  function addWidget(type: string) {
    const def = [...catalog, ...allowedWidgets(auth, portal)].find((w) => w.id === type);
    if (!def) return;
    const maxY = config.widgets.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    update([...config.widgets, { type, x: 0, y: maxY, w: def.defaultWidth, h: def.defaultHeight }]);
  }

  function move(index: number, dir: -1 | 1) {
    const widgets = [...config.widgets];
    const target = index + dir;
    if (target < 0 || target >= widgets.length) return;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    update(widgets);
  }

  function remove(index: number) {
    update(config.widgets.filter((_, i) => i !== index));
  }

  const resolved = resolveWidgets(config.widgets, auth, portal);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {customizing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onSave} disabled={saving} className="ws-btn ws-btn--primary">
              {saving ? "Saving…" : "Save layout"}
            </button>
            <button type="button" onClick={onReset} disabled={saving} className="ws-btn ws-btn--ghost">
              Reset to default
            </button>
            <button type="button" onClick={() => setCustomizing(false)} className="ws-btn ws-btn--ghost">
              Done
            </button>
          </div>
        ) : phoneOps ? (
          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              className="ws-btn ws-btn--ghost !min-h-9 !px-2"
              aria-label="Dashboard menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-2)]">
                <button
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-[var(--ink)] hover:bg-[var(--mist)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setCustomizing(true);
                  }}
                >
                  Customize layout
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" onClick={() => setCustomizing(true)} className="ws-btn">
            Customize layout
          </button>
        )}
      </div>

      {customizing ? (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]/70">
            Choose what appears
          </p>
          <p className="mb-3 text-sm text-[var(--ink-soft)]">
            Add a block, then reorder with the arrows on each card.
          </p>
          {catalog.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No more widgets available for your role.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {catalog.map((w) => (
                <button key={w.id} type="button" onClick={() => addWidget(w.id)} className="ws-btn">
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {resolved.length === 0 ? (
        <div className="ws-empty">
          <h2>This dashboard is empty</h2>
          <p>Restore your role default, or customize and add widgets.</p>
          <button type="button" onClick={onReset} className="ws-btn ws-btn--primary">
            Restore default layout
          </button>
        </div>
      ) : (
        <DashboardRenderer
          config={config}
          auth={auth}
          portal={portal}
          fetchData={fetchData}
          renderWidget={
            customizing
              ? (widget, props) => {
                  const index = config.widgets.findIndex((p) => p.type === widget.type);
                  return (
                    <div className="relative h-full rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] p-1">
                      <div className="mb-1 flex items-center justify-between gap-1 px-1">
                        <span className="truncate text-[11px] font-semibold text-[var(--ink-soft)]">
                          {widget.definition.name}
                        </span>
                        <span className="flex shrink-0 gap-0.5">
                          <button type="button" className="ws-btn ws-btn--ghost !min-h-7 !px-1.5 text-xs" onClick={() => move(index, -1)} aria-label="Move up">
                            ↑
                          </button>
                          <button type="button" className="ws-btn ws-btn--ghost !min-h-7 !px-1.5 text-xs" onClick={() => move(index, 1)} aria-label="Move down">
                            ↓
                          </button>
                          <button type="button" className="ws-btn ws-btn--ghost !min-h-7 !px-1.5 text-xs text-[var(--danger)]" onClick={() => remove(index)} aria-label="Remove">
                            ×
                          </button>
                        </span>
                      </div>
                      <widget.definition.component {...props} />
                    </div>
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
