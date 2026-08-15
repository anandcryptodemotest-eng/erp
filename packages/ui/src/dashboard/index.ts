export { registerDashboardWidgets } from "./widgets";
import { registerDashboardWidgets } from "./widgets";

/** Ensure server routes (GET/PUT config) see the catalog. Idempotent. */
registerDashboardWidgets();

export { DashboardRenderer } from "./renderer";
export { DashboardEditor } from "./editor";
export { roleDefaultConfig, shouldReplaceStaleRoleLayout, shouldReplaceStaleAdminLayout } from "./defaults";
export {
  buildRevenueTrendHref,
  buildOrderStatusHref,
  buildOutstandingInvoiceHref,
  buildTopProductsHref,
  buildInvoicesOutstandingHref,
  buildMyTasksStatusHref,
  buildSreqStatusHref,
  countByStatus,
  formatStatusLabel,
  positiveStatusCounts,
  taskVizMode,
  revenueTrendRangeBounds,
  REVENUE_TREND_RANGES,
  toDayParam,
} from "./charts/hrefs";
export type { StatusCount, TaskVizMode, RevenueTrendRange } from "./charts/hrefs";
export { getPresentationWidgets, viewportFromWidth } from "./presentation";
export type {
  PresentationAdminMode,
  PresentationOptions,
  PresentationViewport,
} from "./presentation";
export {
  buildOpsAttention,
  formatAttentionLine,
  formatInr,
  formatInrCompact,
} from "./ops-attention";
export type { OpsAttentionCounts, OpsAttentionItem } from "./ops-attention";
export { kpisForVariant } from "./ops-kpis";
export type { OpsKpi, OpsKpiVariant, OpsKpiSpec } from "./ops-kpis";
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
