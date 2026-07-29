import {
  defaultAdapterRegistry,
  defaultTaskTypeRegistry,
} from "@erp/workflow";
import { SO_TASK_TYPES } from "@/workflow-templates";
import { registerDefaultSalesHandlers, salesOrderAdapter } from "./sales-order-adapter";

let bootstrapped = false;

/** Call once from sales API routes that use the platform engine. */
export function bootstrapSalesWorkflowPlatform() {
  if (bootstrapped) return;
  for (const t of SO_TASK_TYPES) {
    defaultTaskTypeRegistry.registerType(t.type, { label: t.label, kind: t.kind });
  }
  registerDefaultSalesHandlers();
  defaultAdapterRegistry.register("SALES_ORDER", salesOrderAdapter);
  bootstrapped = true;
}

export { salesOrderAdapter };
