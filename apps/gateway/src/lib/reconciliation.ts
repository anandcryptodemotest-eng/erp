import type { ModuleId } from "@erp/types";
import type { Prisma } from "../generated/prisma";
import { prisma } from "./prisma";

export type ReconciliationInput = {
  tenantId: string;
  operation: string;
  targetService: ModuleId;
  path: string;
  method?: string;
  payload?: Prisma.InputJsonValue;
  idempotencyKey: string;
};

export function recordReconciliation(input: ReconciliationInput) {
  return prisma.reconciliationRecord.upsert({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    create: {
      tenantId: input.tenantId,
      operation: input.operation,
      targetService: input.targetService,
      path: input.path,
      method: input.method ?? "POST",
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    },
    update: {},
  });
}