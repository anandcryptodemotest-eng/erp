"use client";
import { useState } from "react";
import type { DashboardConfig, DashboardAuthContext, DashboardPortal, DashboardPlacement } from "./types";
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

const WIDTH_PRESETS = [3, 4, 6, 8, 12];

/**
 * Configurable dashboard editor: add / remove / reorder / resize / reset.
 * The catalog is permission-filtered (server resolver re-applies on every read,
 * so adding an unauthorized widget is harmless — it won't render).
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
  const [adding, setAdding] = useState(false);
  const catalog = allowedWidgets(auth, portal).filter(
    (w) => !config.widgets.some((p) => p.type === w.id)
  );

  const update = (widgets: DashboardPlacement[]) => onChange({ ...config, widgets });

  function addWidget(type: string) {
    const def = [...catalog, ...allowedWidgets(auth, portal)].find((w) => w.id === type);
    if (!def) return;
    const maxY = config.widgets.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    update([...config.widgets, { type, x: 0, y: maxY, w: def.defaultWidth, h: def.defaultHeight }]);
    setAdding(false);
  }

  function move(index: number, dir: -1 | 1) {
    const widgets = [...config.widgets];
    const target = index + dir;
    if (target < 0 || target >= widgets.length) return;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    update(widgets);
  }

  function resize(index: number, w: number) {
    const widgets = config.widgets.map((p, i) => (i === index ? { ...p, w } : p));
    update(widgets);
  }

  function remove(index: number) {
    update(config.widgets.filter((_, i) => i !== index));
  }

  const resolved = resolveWidgets(config.widgets, auth, portal);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAdding((v) => !v)} className="ws-btn ws-btn--primary">
          + Add widget
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="ws-btn">
          {saving ? "Saving…" : "Save layout"}
        </button>
        <button type="button" onClick={onReset} className="ws-btn ws-btn--ghost">
          Reset to default
        </button>
      </div>

      {adding ? (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]/70">
            Add a widget
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
          <p>Reset to your role default, or add widgets and save the layout.</p>
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
          renderWidget={(widget, props) => {
            const index = config.widgets.findIndex((p) => p.type === widget.type);
            return (
              <div className="group relative flex h-full flex-col">
                <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-1 md:hidden md:group-hover:flex">
                  <button
                    type="button"
                    disabled={index <= 0}
                    onClick={() => move(index, -1)}
                    className="rounded-md bg-[var(--surface-raised)] px-1.5 text-sm shadow-[var(--shadow-sm)]"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index < 0 || index >= config.widgets.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-md bg-[var(--surface-raised)] px-1.5 text-sm shadow-[var(--shadow-sm)]"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <select
                    value={widget.w}
                    aria-label="Width"
                    onChange={(e) => resize(index, Number(e.target.value))}
                    className="rounded-md bg-[var(--surface-raised)] px-1 text-xs shadow-[var(--shadow-sm)]"
                  >
                    {WIDTH_PRESETS.map((w) => (
                      <option key={w} value={w}>
                        {w} cols
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded-md bg-[color-mix(in_srgb,var(--danger)_14%,white)] px-1.5 text-sm text-[var(--danger)] shadow-[var(--shadow-sm)]"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1">
                  <widget.definition.component {...props} />
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
