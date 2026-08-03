import type { FieldValues } from "react-hook-form";
import type { ZodTypeAny } from "zod";
import type { StudioDomain, WorkflowValidationResult } from "../core/types";

export function validateWithSchema(schema: ZodTypeAny, values: unknown): { ok: boolean; message?: string } {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true };
  const issue = parsed.error.issues[0];
  return { ok: false, message: issue?.message ?? "Invalid" };
}

export async function runWorkflowValidation<T extends FieldValues>(
  domain: StudioDomain<T>,
  values: T
): Promise<WorkflowValidationResult> {
  if (!domain.validateWorkflow) return { ok: true };
  return domain.validateWorkflow(values);
}
