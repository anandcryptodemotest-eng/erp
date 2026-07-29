/**
 * Canonical Workflow Definition JSON — sole source of truth for authoring & runtime.
 * The Visual Designer saves this shape; the engine never reads UI canvas nodes.
 * `layout` is designer-only and ignored by the runtime.
 *
 * Design-time vs Runtime:
 * - Configuration Studio authors Draft → Validate → Publish → Archive
 * - Runtime only consumes published immutable assets via AssetRef (concrete version)
 */

export type TaskKind = "HUMAN" | "SYSTEM";

export type WorkflowPermissionAction = "claim" | "complete" | "reassign";

export type TaskPermissions = Partial<Record<WorkflowPermissionAction, string[]>>;

/** Extensible metadata asset kinds (Phase 1 uses WORKFLOW + FORM). */
export type AssetType =
  | "WORKFLOW"
  | "FORM"
  | "RULE"
  | "MENU"
  | "PERMISSION"
  | "NOTIFICATION"
  | "REPORT"
  | "PROMPT"
  | "INTEGRATION"
  | "VARIABLE";

/**
 * Immutable reference to a published metadata asset.
 * Designer may pick "Latest"; publish resolves to a concrete version.
 * Runtime and snapshots NEVER store "latest" — only number.
 */
export interface AssetRef {
  type: AssetType;
  id: string;
  version: number;
}

export type FormFieldType = "number" | "text" | "readonly" | "textarea" | "select";

export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  scope?: "per-item" | "order";
  /** Binding path alias (e.g. unitPrice); prefer `binding` going forward */
  source?: string;
  binding?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface FormDefinition {
  /** Catalog id (stable); equals key when seeded from legacy forms[] */
  id?: string;
  key: string;
  title?: string;
  /** generic (default) | custom — custom uses `component` registry id */
  renderer?: "generic" | "custom";
  /** Optional rich React component id (e.g. SalesReview); otherwise generic field renderer */
  component?: string;
  fields?: FormFieldDefinition[];
  showItems?: boolean;
  showTotal?: boolean;
  /**
   * Theme id (oms-default / oms-attention) or legacy emerald | amber.
   * Prefer themeId on ScreenDefinition; kept for back-compat.
   */
  theme?: "emerald" | "amber" | string;
  themeId?: string;
  confirmLabel?: string;
  description?: string;
  /**
   * UI Runtime layout — preferred over renderer/component.
   * Each entry: { widget, props }
   */
  layout?: { widget: string; props?: Record<string, unknown> }[];
}


export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

export interface ActivityDefinition {
  key: string;
  /** Registered TaskType, e.g. PRICING_REVIEW */
  type: string;
  kind: TaskKind;
  label?: string;
  optional?: boolean;
  /** ConditionRegistry key; evaluated when unlocking this activity */
  condition?: string;
  /**
   * Preferred: reference a FORM asset in the metadata catalog.
   * Runtime resolves via snapshot.pinnedAssets only (never drafts / latest).
   */
  assetRef?: AssetRef;
  /** @deprecated Prefer assetRef; kept for back-compat with embedded forms[] */
  formKey?: string;
  permissions?: TaskPermissions;
  roleHint?: string;
  retryPolicy?: RetryPolicy;
  slaHours?: number;
  autoComplete?: boolean;
  canSkip?: boolean;
  canReject?: boolean;
  canReopen?: boolean;
  /** Coarse entity status projection hint when this activity completes */
  projectionStatus?: string;
}

/** Pinned asset body inside a workflow instance snapshot */
export interface PinnedAsset {
  ref: AssetRef;
  body: FormDefinition | Record<string, unknown>;
}

/**
 * Runtime snapshot = published workflow definition + pinned referenced assets.
 * Extends WorkflowDefinition so existing readers casting snapshot still work.
 */
export type WorkflowRuntimeSnapshot = WorkflowDefinition & {
  pinnedAssets?: Record<string, PinnedAsset>;
};

export interface WorkflowEdge {
  from: string;
  to: string;
  on?: "FINISH" | "CANCEL";
  condition?: string;
}

export interface WorkflowLayoutNode {
  x: number;
  y: number;
}

/** Designer-only; runtime must ignore */
export type WorkflowLayout = Record<string, WorkflowLayoutNode>;

export interface CustomTaskType {
  type: string;
  label: string;
  kind: TaskKind;
  description?: string;
}

export interface WorkflowDefinition {
  template: string;
  version: number;
  name?: string;
  description?: string;
  entityTypes: string[];
  activities: ActivityDefinition[];
  edges: WorkflowEdge[];
  forms?: FormDefinition[];
  /** Tenant/designer-defined task types beyond the platform library */
  customTaskTypes?: CustomTaskType[];
  /** Initial variables schema keys (documentation / simulation defaults) */
  variableDefaults?: Record<string, unknown>;
  layout?: WorkflowLayout;
}

export type TemplateLifecycle = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface WorkflowTemplateRecord {
  id: string;
  tenantId: string;
  template: string;
  version: number;
  lifecycle: TemplateLifecycle;
  definition: WorkflowDefinition;
  clonedFromId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
