"use client";
import type { CSSProperties } from "react";
import type {
  DashboardConfig,
  DashboardAuthContext,
  DashboardPortal,
  ResolvedWidget,
  WidgetProps,
} from "./types";
import { resolveWidgets } from "./registry";

export interface DashboardRendererProps {
  config: DashboardConfig;
  auth: DashboardAuthContext;
  portal: DashboardPortal;
  fetchData: <T = unknown>(dataSource: string) => Promise<T | null>;
  /** Optional per-widget custom renderer (e.g. wrap in editor chrome). */
  renderWidget?: (widget: ResolvedWidget, props: WidgetProps) => React.ReactNode;
}

/**
 * Lays out resolved (permission-filtered) widgets on a 12-column grid.
 * Static positioning: each widget is absolutely placed by x/y/w/h.
 */
export function DashboardRenderer({
  config,
  auth,
  portal,
  fetchData,
  renderWidget,
}: DashboardRendererProps) {
  const resolved = resolveWidgets(config.widgets, auth, portal);
  const columns = config.layout?.columns ?? 12;

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridAutoRows: "minmax(80px, auto)",
    gap: 16,
  };

  return (
    <div className="dashboard-grid" style={containerStyle}>
      {resolved.map((widget) => {
        const props: WidgetProps = {
          auth,
          portal,
          placement: widget,
          config: widget.config,
          fetchData,
        };
        const cellStyle: CSSProperties = {
          gridColumn: `span ${Math.min(widget.w || widget.definition.defaultWidth, columns)}`,
          gridRow: `span ${widget.h || widget.definition.defaultHeight}`,
          minHeight: 0,
        };
        return (
          <div key={widget.type} className="dashboard-grid__cell" style={cellStyle}>
            {renderWidget ? renderWidget(widget, props) : <widget.definition.component {...props} />}
          </div>
        );
      })}
    </div>
  );
}