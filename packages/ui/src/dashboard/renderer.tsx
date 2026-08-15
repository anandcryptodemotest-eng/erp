"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  DashboardConfig,
  DashboardAuthContext,
  DashboardPortal,
  ResolvedWidget,
  WidgetProps,
} from "./types";
import { resolveWidgets } from "./registry";
import {
  getPresentationWidgets,
  viewportFromWidth,
  type PresentationAdminMode,
  type PresentationViewport,
} from "./presentation";

export interface DashboardRendererProps {
  config: DashboardConfig;
  auth: DashboardAuthContext;
  portal: DashboardPortal;
  fetchData: <T = unknown>(dataSource: string) => Promise<T | null>;
  /** Optional per-widget custom renderer (e.g. wrap in editor chrome). */
  renderWidget?: (widget: ResolvedWidget, props: WidgetProps) => React.ReactNode;
}

function readAdminMode(): PresentationAdminMode {
  if (typeof document === "undefined") return "dense";
  return (
    (document.querySelector(".admin-shell")?.getAttribute("data-admin-mode") as PresentationAdminMode) ||
    "dense"
  );
}

/**
 * Lays out resolved (permission-filtered) widgets on a 12-column grid.
 * Phone + operational: presentation-only order via getPresentationWidgets (never mutates config).
 */
export function DashboardRenderer({
  config,
  auth,
  portal,
  fetchData,
  renderWidget,
}: DashboardRendererProps) {
  const resolved = resolveWidgets(config.widgets, auth, portal);
  const [viewport, setViewport] = useState<PresentationViewport>("desktop");
  const [adminMode, setAdminMode] = useState<PresentationAdminMode>("dense");

  useEffect(() => {
    const apply = () => {
      setViewport(viewportFromWidth(window.innerWidth));
      setAdminMode(readAdminMode());
    };
    apply();
    window.addEventListener("resize", apply);
    const shell = document.querySelector(".admin-shell");
    const mo =
      shell &&
      new MutationObserver(apply);
    if (shell && mo) mo.observe(shell, { attributes: true, attributeFilter: ["data-admin-mode"] });
    return () => {
      window.removeEventListener("resize", apply);
      mo?.disconnect();
    };
  }, []);

  const renderList = getPresentationWidgets(resolved, { adminMode, viewport });
  const phoneOps = adminMode === "operational" && viewport === "phone";
  const columns = config.layout?.columns ?? 12;

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridAutoRows: "minmax(80px, auto)",
    gap: 16,
  };

  return (
    <div
      className="dashboard-grid"
      style={containerStyle}
      data-dash-presentation={phoneOps ? "phone-ops" : "default"}
    >
      {renderList.map((widget) => {
        const props: WidgetProps = {
          auth,
          portal,
          placement: widget,
          config: widget.config,
          fetchData,
        };
        const cellStyle: CSSProperties = phoneOps
          ? {
              gridColumn: `span ${columns}`,
              gridRow: "span 1",
              minHeight: 0,
            }
          : {
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
