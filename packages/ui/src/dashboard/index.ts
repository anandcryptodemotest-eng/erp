export { registerDashboardWidgets } from "./widgets";
import { registerDashboardWidgets } from "./widgets";

/** Ensure server routes (GET/PUT config) see the catalog. Idempotent. */
registerDashboardWidgets();

export { DashboardRenderer } from "./renderer";
export { DashboardEditor } from "./editor";
export { roleDefaultConfig } from "./defaults";
export { resolveWidgets, allowedWidgets, getWidget, listWidgets } from "./registry";
export { authorizeWidget } from "./types";
export type {
  DashboardConfig,
  DashboardPlacement,
  DashboardPortal,
  DashboardAuthContext,
  WidgetDefinition,
  WidgetProps,
  ResolvedWidget,
} from "./types";
export type { DashboardRendererProps } from "./renderer";
export type { DashboardEditorProps } from "./editor";