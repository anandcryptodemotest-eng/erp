import {
  validateWorkflowDefinition,
  defaultConditionRegistry,
  type WorkflowDefinition,
} from "@erp/workflow";
import {
  SO_STANDARD_V5,
  SO_STANDARD_FORMS,
  SO_TASK_TYPES,
} from "@/workflow-templates";

export function validationContext(previousVersion?: number) {
  return {
    registeredTaskTypes: SO_TASK_TYPES.map((t) => t.type),
    registeredConditions: defaultConditionRegistry.keys(),
    previousVersion,
    requireForms: true,
    requirePermissions: true,
  };
}

export function validateDefinition(def: WorkflowDefinition, previousVersion?: number) {
  const custom = (def.customTaskTypes ?? []).map((t) => t.type);
  return validateWorkflowDefinition(def, {
    registeredTaskTypes: [...SO_TASK_TYPES.map((t) => t.type), ...custom],
    registeredConditions: defaultConditionRegistry.keys(),
    previousVersion,
    requireForms: true,
    requirePermissions: true,
  });
}

export { SO_STANDARD_V5, SO_TASK_TYPES, SO_STANDARD_FORMS };
