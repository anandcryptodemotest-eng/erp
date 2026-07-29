import type { WorkflowDefinition } from "../types/definition";
import {
  activityKeys,
  endNodes,
  hasCycle,
  reachableFromStarts,
  startNodes,
} from "../graph";
import { activityFormRef, assetKey, formKeyToFormId } from "../metadata/asset-ref";

export interface ValidatorContext {
  /** Registered TaskType keys (e.g. PRICING_REVIEW) */
  registeredTaskTypes: Set<string> | string[];
  /** Registered condition keys */
  registeredConditions: Set<string> | string[];
  /** Previous published version for this template code; omit for first publish */
  previousVersion?: number;
  /** When true, HUMAN activities must have assetRef (FORM) with concrete version */
  requireForms?: boolean;
  /** When true, HUMAN activities must have complete permission roles */
  requirePermissions?: boolean;
  /**
   * Optional set of published FORM asset keys (`FORM:id@version`) for publish-time checks.
   * When provided, assetRef must appear in this set (runtime never resolves "latest").
   */
  publishedFormKeys?: Set<string> | string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  activityKey?: string;
}

export interface DefinitionValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function asSet(v: Set<string> | string[]): Set<string> {
  return v instanceof Set ? v : new Set(v);
}

/**
 * Validate a Workflow Definition before Publish.
 * Shared by Visual Designer and server publish API.
 */
export function validateWorkflowDefinition(
  def: WorkflowDefinition,
  ctx: ValidatorContext
): DefinitionValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const taskTypes = asSet(ctx.registeredTaskTypes);
  for (const ct of def.customTaskTypes ?? []) {
    if (ct.type?.trim()) taskTypes.add(ct.type.trim());
  }
  const conditions = asSet(ctx.registeredConditions);
  const requireForms = ctx.requireForms !== false;
  const requirePermissions = ctx.requirePermissions !== false;

  if (!def.template?.trim()) {
    errors.push({ code: "TEMPLATE_CODE", message: "template code is required" });
  }
  if (!Number.isInteger(def.version) || def.version < 1) {
    errors.push({ code: "VERSION", message: "version must be a positive integer" });
  }
  if (ctx.previousVersion != null && def.version <= ctx.previousVersion) {
    errors.push({
      code: "VERSION_INCREMENT",
      message: `version must be greater than previous published version ${ctx.previousVersion}`,
    });
  }
  if (!Array.isArray(def.entityTypes) || def.entityTypes.length === 0) {
    errors.push({ code: "ENTITY_TYPES", message: "entityTypes must include at least one type" });
  }
  if (!Array.isArray(def.activities) || def.activities.length === 0) {
    errors.push({ code: "NO_ACTIVITIES", message: "activities must not be empty" });
    return { ok: false, errors, warnings };
  }

  const keys = activityKeys(def);
  if (keys.size !== def.activities.length) {
    errors.push({ code: "DUPLICATE_KEY", message: "duplicate activity keys are not allowed" });
  }

  const formKeys = new Set((def.forms ?? []).map((f) => f.key));
  const formIds = new Set(
    (def.forms ?? []).map((f) => f.id ?? formKeyToFormId(f.key))
  );
  const publishedForms = ctx.publishedFormKeys ? asSet(ctx.publishedFormKeys) : null;

  for (const a of def.activities) {
    if (!a.key?.trim()) {
      errors.push({ code: "ACTIVITY_KEY", message: "activity key is required" });
      continue;
    }
    if (!a.type?.trim()) {
      errors.push({ code: "TASK_TYPE", message: "activity type is required", activityKey: a.key });
    } else if (!taskTypes.has(a.type)) {
      errors.push({
        code: "TASK_TYPE_UNREGISTERED",
        message: `task type "${a.type}" is not registered`,
        activityKey: a.key,
      });
    }
    if (a.kind !== "HUMAN" && a.kind !== "SYSTEM") {
      errors.push({ code: "TASK_KIND", message: "kind must be HUMAN or SYSTEM", activityKey: a.key });
    }
    if (a.condition && !conditions.has(a.condition)) {
      errors.push({
        code: "CONDITION_UNREGISTERED",
        message: `condition "${a.condition}" is not registered`,
        activityKey: a.key,
      });
    }
    if (a.kind === "HUMAN" && requireForms) {
      const ref = activityFormRef(a);
      if (!ref) {
        errors.push({
          code: "FORM_MISSING",
          message: `HUMAN activity "${a.key}" requires assetRef { type: "FORM", id, version }`,
          activityKey: a.key,
        });
      } else if (publishedForms) {
        const k = assetKey(ref);
        if (!publishedForms.has(k)) {
          errors.push({
            code: "FORM_ASSET_UNPUBLISHED",
            message: `HUMAN activity "${a.key}" references unpublished or missing form ${k}`,
            activityKey: a.key,
          });
        }
      } else if (ref.version < 1) {
        errors.push({
          code: "FORM_ASSET_VERSION",
          message: `HUMAN activity "${a.key}" assetRef.version must be a concrete published version (≥ 1)`,
          activityKey: a.key,
        });
      }
    }
    if (a.kind === "HUMAN" && requirePermissions) {
      const complete = a.permissions?.complete ?? (a.roleHint ? [a.roleHint] : []);
      if (complete.length === 0) {
        errors.push({
          code: "PERMISSIONS",
          message: `HUMAN activity "${a.key}" needs permissions.complete or roleHint`,
          activityKey: a.key,
        });
      }
    }
  }

  for (const e of def.edges) {
    if (!keys.has(e.from)) {
      errors.push({ code: "EDGE_FROM", message: `edge.from "${e.from}" is not an activity` });
    }
    if (!keys.has(e.to)) {
      errors.push({ code: "EDGE_TO", message: `edge.to "${e.to}" is not an activity` });
    }
    if (e.condition && !conditions.has(e.condition)) {
      errors.push({
        code: "EDGE_CONDITION",
        message: `edge condition "${e.condition}" is not registered`,
      });
    }
  }

  if (hasCycle(def)) {
    errors.push({ code: "CYCLE", message: "workflow graph contains a cycle" });
  }

  const starts = startNodes(def);
  if (starts.length === 0) {
    errors.push({ code: "NO_START", message: "exactly one start node is required (found 0)" });
  } else if (starts.length > 1) {
    errors.push({
      code: "MULTI_START",
      message: `exactly one start node is required (found ${starts.length}: ${starts.join(", ")})`,
    });
  }

  const ends = endNodes(def);
  if (ends.length === 0) {
    errors.push({ code: "NO_END", message: "at least one end/terminal node is required" });
  }

  const reachable = reachableFromStarts(def);
  for (const a of def.activities) {
    if (!reachable.has(a.key)) {
      errors.push({
        code: "ORPHAN",
        message: `activity "${a.key}" is not reachable from the start node`,
        activityKey: a.key,
      });
    }
  }

  // Mandatory activities should be reachable — already covered by ORPHAN.
  // Warn if optional activity has no condition
  for (const a of def.activities) {
    if (a.optional && !a.condition) {
      warnings.push({
        code: "OPTIONAL_NO_CONDITION",
        message: `optional activity "${a.key}" has no condition — it will always activate when deps met`,
        activityKey: a.key,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
