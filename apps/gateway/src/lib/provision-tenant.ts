import { serviceClient } from "@erp/config";
import type { ModuleId } from "@erp/types";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/identity/password";
import { attachFreeSubscription } from "@/lib/billing-core";
import { createLogger } from "@erp/logger";

const log = createLogger({ service: "gateway-provision" });

/**
 * Per-vertical onboarding recipe: which modules to license, the default order
 * workflow template to apply (in the sales service), and whether to seed a
 * default warehouse (in the inventory service).
 */
export const VERTICAL_RECIPES: Record<
  string,
  { modules: ModuleId[]; workflowTemplate: string; seedWarehouse: boolean }
> = {
  // Fruits & vegetables / grocery cart: online storefront + delivery + stock.
  grocery: {
    modules: ["core", "inventory", "sales", "delivery"],
    workflowTemplate: "workflow.grocery_delivery",
    seedWarehouse: true,
  },
  // Default B2B trading recipe.
  general: {
    modules: ["core", "inventory", "sales"],
    workflowTemplate: "workflow.oms_trading",
    seedWarehouse: true,
  },
  // Mobile cart / van / field retail: counter sales (POS = accounting bills + shifts)
  // over multiple moving stock locations, restocked from a central warehouse.
  // Generic across fruit carts, FMCG vans, kiosks, field sales — configured per tenant.
  mobile_retail: {
    modules: ["core", "inventory", "sales", "accounting", "delivery"],
    workflowTemplate: "workflow.oms_trading",
    seedWarehouse: true,
  },
};

export type Vertical = keyof typeof VERTICAL_RECIPES;

export function validHostname(value: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}

export function tenantLoginUrl(slug: string): string {
  const base = (process.env.TENANT_ADMIN_PUBLIC_URL || "http://localhost:3010/admin").replace(/\/$/, "");
  return `${base}/login?tenant=${encodeURIComponent(slug)}`;
}

/**
 * Fire any PENDING reconciliation records for a freshly onboarded tenant against
 * their target services. Best-effort: each record is marked SUCCEEDED/FAILED
 * independently and a FAILED record stays retryable via
 * POST /api/reconciliation/:id/retry. Never throws.
 */
export async function drainOnboardingReconciliation(
  tenantId: string,
  opts: { requestId?: string } = {}
): Promise<void> {
  const pending = await prisma.reconciliationRecord.findMany({
    where: { tenantId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  for (const record of pending) {
    try {
      const result = await serviceClient.call(record.targetService as ModuleId, record.path, {
        method: record.method,
        tenantId,
        // System provisioning acts as tenant ADMIN; downstream routes gate on this role.
        role: "ADMIN",
        body: record.payload ?? undefined,
        requestId: opts.requestId,
      });
      const succeeded = result.status >= 200 && result.status < 300;
      await prisma.reconciliationRecord.update({
        where: { id: record.id },
        data: {
          attempts: { increment: 1 },
          status: succeeded ? "SUCCEEDED" : "FAILED",
          lastError: succeeded ? null : result.error ?? `Downstream status ${result.status}`,
          nextRetryAt: succeeded ? null : new Date(Date.now() + 60_000),
        },
      });
    } catch (err) {
      await prisma.reconciliationRecord
        .update({
          where: { id: record.id },
          data: {
            attempts: { increment: 1 },
            status: "FAILED",
            lastError: err instanceof Error ? err.message : "Cross-service call failed",
            nextRetryAt: new Date(Date.now() + 60_000),
          },
        })
        .catch(() => undefined);
    }
  }
}

export type ProvisionTenantInput = {
  name: string;
  slug: string;
  plan?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword: string;
  vertical?: Vertical;
  domains?: { hostname: string; portalType: string }[];
  /** Platform-operator id for the audit log; omit for self-serve signup. */
  auditOperatorId?: string;
  audit?: { ip?: string; userAgent?: string };
};

export type ProvisionTenantResult = {
  tenant: { id: string; slug: string; name: string };
  adminEmail: string;
  loginUrl: string;
};

export class ProvisionTenantError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ProvisionTenantError";
    this.status = status;
  }
}

/**
 * Create a fully provisioned, immediately-usable tenant: tenant row + domains +
 * base settings + default branch + admin user/credential + module licenses +
 * cross-service reconciliation (order workflow, default warehouse). Shared by
 * the platform-operator route AND self-serve signup so no path can create a
 * half-provisioned tenant that can't run the OMS.
 *
 * Runs the gateway-owned writes in one transaction, then fires cross-service
 * setup best-effort after commit.
 */
export async function provisionTenant(
  input: ProvisionTenantInput,
  opts: { requestId?: string } = {}
): Promise<ProvisionTenantResult> {
  const slug = input.slug.trim().toLowerCase();
  const vertical: Vertical = input.vertical ?? "general";
  const recipe = VERTICAL_RECIPES[vertical] ?? VERTICAL_RECIPES.general;
  const adminEmail = input.adminEmail.toLowerCase();

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) throw new ProvisionTenantError("Slug already taken", 409);

  const domainInputs = (input.domains ?? []).filter((d) => d.hostname);
  if (domainInputs.some((d) => !validHostname(d.hostname))) {
    throw new ProvisionTenantError("Domains must be valid hostnames without protocol or path", 400);
  }

  const passwordHash = await hashPassword(input.adminPassword);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.name, slug, plan: input.plan ?? "starter", isActive: true },
    });

    if (domainInputs.length > 0) {
      await tx.tenantDomain.createMany({
        data: domainInputs.map((d) => ({
          tenantId: tenant.id,
          hostname: d.hostname.trim().toLowerCase().replace(/\.$/, ""),
          portalType: d.portalType,
          isPrimary: true,
        })),
      });
    }

    await tx.tenantSetting.createMany({
      data: [
        { tenantId: tenant.id, key: "currency", value: "INR" },
        { tenantId: tenant.id, key: "timezone", value: "Asia/Kolkata" },
        { tenantId: tenant.id, key: "brand.displayName", value: input.name },
        { tenantId: tenant.id, key: "onboarding.vertical", value: vertical },
        // Mobile-retail defaults: the customer-visible label for a stock location
        // and the cash-handover policy live in tenant settings (configuration, not
        // code), so "Fruit Cart" vs "Delivery Van" is a per-tenant choice.
        ...(vertical === "mobile_retail"
          ? [
              { tenantId: tenant.id, key: "retail.locationLabel", value: "Cart" },
              { tenantId: tenant.id, key: "retail.cashHandoverRequired", value: "true" },
            ]
          : []),
      ],
    });

    await tx.branch.create({
      data: { tenantId: tenant.id, code: "MAIN", name: "Main", isDefault: true, isActive: true },
    });

    let user = await tx.user.findUnique({ where: { email: adminEmail } });
    if (!user) {
      user = await tx.user.create({
        data: { email: adminEmail, name: input.adminName ?? adminEmail.split("@")[0], isActive: true },
      });
      await tx.authCredential.create({ data: { userId: user.id, type: "PASSWORD", passwordHash } });
    } else {
      const cred = await tx.authCredential.findFirst({ where: { userId: user.id, type: "PASSWORD" } });
      if (cred) {
        await tx.authCredential.update({ where: { id: cred.id }, data: { passwordHash } });
      } else {
        await tx.authCredential.create({ data: { userId: user.id, type: "PASSWORD", passwordHash } });
      }
    }

    await tx.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: "ADMIN", isActive: true },
    });

    await tx.moduleLicense.createMany({
      data: recipe.modules.map((moduleId) => ({
        tenantId: tenant.id,
        moduleId,
        plan: "basic",
        isActive: true,
      })),
    });

    await tx.reconciliationRecord.create({
      data: {
        tenantId: tenant.id,
        operation: "APPLY_ORDER_WORKFLOW",
        targetService: "sales",
        path: "/api/order-workflows",
        method: "POST",
        payload: { templateId: recipe.workflowTemplate, setDefault: true },
        idempotencyKey: `onboard:${tenant.id}:workflow`,
        status: "PENDING",
      },
    });

    if (recipe.seedWarehouse) {
      await tx.reconciliationRecord.create({
        data: {
          tenantId: tenant.id,
          operation: "SEED_DEFAULT_WAREHOUSE",
          targetService: "inventory",
          path: "/api/warehouses",
          method: "POST",
          payload: { name: "Main", location: input.name },
          idempotencyKey: `onboard:${tenant.id}:warehouse`,
          status: "PENDING",
        },
      });
    }

    if (input.auditOperatorId) {
      await tx.platformAuditLog.create({
        data: {
          operatorId: input.auditOperatorId,
          action: "TENANT_CREATED",
          entityType: "Tenant",
          entityId: tenant.id,
          metadata: { slug: tenant.slug, plan: tenant.plan, vertical, modules: recipe.modules, adminEmail },
          ip: input.audit?.ip,
          userAgent: input.audit?.userAgent,
        },
      });
    }

    return { tenant };
  });

  await attachFreeSubscription(result.tenant.id).catch((err) =>
    log.warn("attach_free_subscription_failed", { tenantId: result.tenant.id, err })
  );

  await drainOnboardingReconciliation(result.tenant.id, { requestId: opts.requestId });

  return {
    tenant: { id: result.tenant.id, slug: result.tenant.slug, name: result.tenant.name },
    adminEmail,
    loginUrl: tenantLoginUrl(result.tenant.slug),
  };
}
