import type { ComponentType } from "react";

/** Portal where a dashboard lives. */
export type DashboardPortal = "ADMIN" | "CUSTOMER";

/**
 * A configurable property of a widget (e.g. date range, top-N count).
 * The editor renders a control based on `kind`.
 */
export interface WidgetPropertyDef {
  key: string;
  label: string;
  kind: "number" | "text" | "select" | "boolean";
  options?: { label: string; value: string }[];
  defaultValue?: unknown;
}

/**
 * Declarative widget definition. Authorization is:
 *   requiredModule?     → tenant must have the module licensed (ENTITLEMENT gate)
 *   requiredCapability? → JWT must carry the capability      (USER gate)
 *   supportedRoles      → advisory only (drives default configs, never a gate)
 */
export interface WidgetDefinition {
  id: string;
  name: string;
  description?: string;
  category:
    | "sales"
    | "inventory"
    | "delivery"
    | "accounting"
    | "customer"
    | "summary";
  requiredModule?: string;
  requiredCapability?: string;
  supportedRoles?: string[];
  dataSource: string;
  component: ComponentType<WidgetProps>;
  configurableProperties?: WidgetPropertyDef[];
  /** Grid span in 12-column units. */
  defaultWidth: number;
  /** Approximate row height in units. */
  defaultHeight: number;
}

/** A widget placed on a dashboard grid. */
export interface DashboardPlacement {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

/** Authorized user context passed to widgets and the resolver. */
export interface DashboardAuthContext {
  userId: string;
  role: string;
  modules: string[];
  capabilities: string[];
  /**
   * Capability keys the tenant has EVER provisioned (enabled or disabled). If a
   * widget's requiredCapability is NOT in this set, that capability was never
   * configured for the tenant — fall back to the module gate only (permissive).
   * If it IS provisioned, it must be enabled for the user (`capabilities`).
   */
  provisionedCapabilities?: string[];
}

/** Props every widget receives. */
export interface WidgetProps {
  auth: DashboardAuthContext;
  portal: DashboardPortal;
  placement: DashboardPlacement;
  config?: Record<string, unknown>;
  /** Portal-agnostic data fetcher bound by the hosting page. */
  fetchData: <T = unknown>(dataSource: string) => Promise<T | null>;
}

/** Serialized dashboard config returned to the client. */
export interface DashboardConfig {
  dashboard: DashboardPortal;
  layout: { columns: number };
  widgets: DashboardPlacement[];
}

/** Widget + resolved definition the renderer needs. */
export interface ResolvedWidget extends DashboardPlacement {
  definition: WidgetDefinition;
}

export function authorizeWidget(
  widget: WidgetDefinition,
  auth: DashboardAuthContext
): boolean {
  if (widget.requiredModule && !auth.modules.includes(widget.requiredModule)) {
    return false;
  }
  if (widget.requiredCapability) {
    const provisioned = auth.provisionedCapabilities ?? auth.capabilities;
    const configured = provisioned.includes(widget.requiredCapability);
    const allowed = auth.capabilities.includes(widget.requiredCapability);
    // If the capability is provisioned for the tenant but not granted to this
    // user, reject. If never provisioned, the module gate above is the only gate.
    if (configured && !allowed) {
      return false;
    }
  }
  return true;
}