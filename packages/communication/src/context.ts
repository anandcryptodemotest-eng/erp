/**
 * Conversation context — extensible module + entity + entityId triple.
 * Replaces a growing enum; any ERP module can attach conversations without code changes.
 */
export interface ConversationContext {
  /** Source module: "sales" | "procurement" | "accounting" | "hr" | "inventory" | "workflow" | "general" */
  module: string;
  /** Entity type: "SalesOrder" | "PurchaseOrder" | "Invoice" | "TaskInstance" | "Customer" | ... */
  entity: string;
  /** Entity ID: "SO-10012" | "PO-5001" | "task-instance-id" | ... */
  entityId: string | null;
  /** Optional display label captured when the conversation is created. */
  displayLabel?: string | null;
  /** Optional owning-module authorization key for context access checks. */
  authorizationKey?: string | null;
}

/** Default context for general conversations (no business entity) */
export const GENERAL_CONTEXT: ConversationContext = {
  module: "general",
  entity: "General",
  entityId: null,
  displayLabel: null,
  authorizationKey: null,
};

/** Policy values stored with a conversation and enforced in addition to roles. */
export interface ConversationPolicy {
  visibility?: "PARTICIPANTS" | "TENANT" | "CONTEXT_MEMBERS";
  allowedParticipantTypes?: string[];
  canSend?: string[];
  canEdit?: string[];
  canDelete?: string[];
  canClose?: string[];
  retentionDays?: number | null;
  allowExport?: boolean;
}

/** Build a context for a workflow task */
export function workflowTaskContext(taskId: string): ConversationContext {
  return { module: "workflow", entity: "TaskInstance", entityId: taskId };
}

/** Build a context for a sales order */
export function salesOrderContext(orderNumber: string): ConversationContext {
  return { module: "sales", entity: "SalesOrder", entityId: orderNumber };
}

/** Build a context for a purchase order */
export function purchaseOrderContext(orderNumber: string): ConversationContext {
  return { module: "procurement", entity: "PurchaseOrder", entityId: orderNumber };
}

/** Build a context for an invoice */
export function invoiceContext(invoiceNumber: string): ConversationContext {
  return { module: "accounting", entity: "Invoice", entityId: invoiceNumber };
}

/** Build a context for a customer */
export function customerContext(customerId: string): ConversationContext {
  return { module: "sales", entity: "Customer", entityId: customerId };
}

/** Build a context for a vendor */
export function vendorContext(vendorId: string): ConversationContext {
  return { module: "procurement", entity: "Vendor", entityId: vendorId };
}

/** Build a context for an employee */
export function employeeContext(employeeId: string): ConversationContext {
  return { module: "hr", entity: "Employee", entityId: employeeId };
}

/** Build a context for a product */
export function productContext(productId: string): ConversationContext {
  return { module: "inventory", entity: "Product", entityId: productId };
}

/** Format a context for display (e.g. "sales / SalesOrder / SO-10012") */
export function formatContext(ctx: ConversationContext): string {
  if (!ctx.entityId) return `${ctx.module} / ${ctx.entity}`;
  return `${ctx.module} / ${ctx.entity} / ${ctx.entityId}`;
}

/** Build a stable context payload from legacy API fields. */
export function conversationContext(
  module: string,
  entity: string,
  entityId: string | null,
  options?: Pick<ConversationContext, "displayLabel" | "authorizationKey">
): ConversationContext {
  return { module, entity, entityId, ...options };
}