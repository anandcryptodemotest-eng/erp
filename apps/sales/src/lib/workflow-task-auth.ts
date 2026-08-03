/**
 * Task API authorization — Role Check before lease / complete.
 * Kept separate from workbench to avoid circular imports with runtime.
 */

import type { TaskPermissions, WorkflowDefinition } from "@erp/workflow";

const ADMIN_OVERRIDE_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
]);

export class WorkflowAuthError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "WorkflowAuthError";
  }
}

export function rolesMatch(taskRole: string, callerRole: string | null): boolean {
  if (!callerRole) return false;
  if (taskRole === callerRole) return true;
  const sales = new Set(["SALES_EXECUTIVE", "SALES_REP"]);
  return sales.has(taskRole) && sales.has(callerRole);
}

function roleAllowed(
  allowed: string[] | undefined,
  callerRole: string | null,
  fallbackRole: string
): boolean {
  if (!callerRole) return false;
  if (ADMIN_OVERRIDE_ROLES.has(callerRole)) return true;
  const list = allowed?.length ? allowed : [fallbackRole];
  return list.some((r) => rolesMatch(r, callerRole));
}

export function activityPermissionsFromSnapshot(
  snapshot: unknown,
  stepKey: string
): TaskPermissions | null {
  const def = snapshot as WorkflowDefinition | null;
  const activity = def?.activities?.find((a) => a.key === stepKey);
  return activity?.permissions ?? null;
}

/**
 * Enforce Role Check → Lease → Complete on the task API path.
 * SYSTEM actor may complete SYSTEM tasks only.
 */
export function assertWorkflowTaskAction(opts: {
  task: {
    assignedRole: string;
    assignedUserId: string | null;
    kind: string | null;
    status: string;
    leaseExpiresAt?: Date | null;
  };
  action: "claim" | "complete" | "renew" | "release";
  role: string | null | undefined;
  userId: string;
  permissions?: TaskPermissions | null;
}): void {
  const role = opts.role ?? null;
  const isSystemActor = opts.userId === "system" || role === "SYSTEM";

  if (isSystemActor) {
    if (opts.task.kind === "SYSTEM" && (opts.action === "complete" || opts.action === "claim")) {
      return;
    }
    throw new WorkflowAuthError("SYSTEM actor can only complete SYSTEM tasks");
  }

  if (role && ADMIN_OVERRIDE_ROLES.has(role)) {
    return;
  }

  if (opts.action === "claim") {
    if (
      !roleAllowed(opts.permissions?.claim ?? opts.permissions?.complete, role, opts.task.assignedRole)
    ) {
      throw new WorkflowAuthError(`Claim requires role ${opts.task.assignedRole}`);
    }
    return;
  }

  if (opts.action === "complete") {
    if (!roleAllowed(opts.permissions?.complete, role, opts.task.assignedRole)) {
      throw new WorkflowAuthError(`Complete requires role ${opts.task.assignedRole}`);
    }
    if (
      opts.task.assignedUserId &&
      opts.task.assignedUserId !== opts.userId &&
      opts.task.status === "CLAIMED" &&
      opts.task.leaseExpiresAt &&
      opts.task.leaseExpiresAt.getTime() > Date.now()
    ) {
      throw new WorkflowAuthError("Task is claimed by another user");
    }
    return;
  }

  if (opts.action === "renew" || opts.action === "release") {
    if (opts.task.assignedUserId && opts.task.assignedUserId !== opts.userId) {
      throw new WorkflowAuthError(
        opts.action === "renew"
          ? "Only the claim holder can renew the lease"
          : "Only the claim holder can release"
      );
    }
  }
}

export { ADMIN_OVERRIDE_ROLES };
