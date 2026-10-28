import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@erp/config";
import type { ModuleId } from "@erp/types";
import type { ProvisionTenantResponse } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";
import { hashPassword } from "@/lib/identity/password";
import { attachFreeSubscription } from "@/lib/billing-core";

/**
 * Per-vertical onboarding recipe: which modules to license, the default order
 * workflow template to apply (in the sales service), and whether to seed a
 * default warehouse (in the inventory service).
 */
const VERTICAL_RECIPES: Record<
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
    modules: ["core"],
    workflowTemplate: "workflow.oms_trading",
    seedWarehouse: false,
  },
};

const createSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), {
      message: "Slug must be lowercase letters, numbers, and hyphens (e.g. acme-corp)",
    }),
  plan: z.string().default("starter"),
  adminEmail: z.string().email(),
  adminName: z.string().optional(),
  adminPassword: z.string().min(8),
  customerDomain: z.string().max(253).optional(),
  adminDomain: z.string().max(253).optional(),
  /** Onboarding recipe — selects modules, order workflow, and warehouse seeding. */
  vertical: z.enum(["grocery", "general"]).default("general"),
});

function tenantLoginUrl(slug: string) {
  const base = (process.env.TENANT_ADMIN_PUBLIC_URL || "http://localhost:3010/admin").replace(/\/$/, "");
  return `${base}/login?tenant=${encodeURIComponent(slug)}`;
}

function validHostname(value: string) {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}

/**
 * Fire any PENDING reconciliation records for a freshly onboarded tenant against their
 * target services. Best-effort: each record is marked SUCCEEDED/FAILED independently and
 * a FAILED record stays retryable via POST /api/reconciliation/:id/retry. Never throws.
 */
async function drainOnboardingReconciliation(
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

// GET /api/platform/tenants
export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: { where: { isActive: true }, select: { moduleId: true, plan: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({
    data: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      isActive: t.isActive,
      createdAt: t.createdAt,
      users: t._count.users,
      modules: t.licenses.map((l) => l.moduleId),
      lastLogin: null as string | null,
      storage: null as string | null,
      apiUsage: null as string | null,
    })),
  });
}

// POST /api/platform/tenants — transactional provision
export async function POST(request: Request) {
  const gate = await requirePlatformAuth(request, "provisionTenant");
  if (gate instanceof NextResponse) return gate;

  try {
    const body = createSchema.parse(await request.json());
    const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const domainInputs = [
      { hostname: body.customerDomain?.trim().toLowerCase().replace(/\.$/, ""), portalType: "CUSTOMER" },
      { hostname: body.adminDomain?.trim().toLowerCase().replace(/\.$/, ""), portalType: "ADMIN" },
    ].filter((domain) => domain.hostname);
    if (domainInputs.some((domain) => !validHostname(domain.hostname!))) {
      return NextResponse.json({ error: "Domains must be valid hostnames without protocol or path" }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.adminPassword);
    const meta = clientMeta(request);
    const recipe = VERTICAL_RECIPES[body.vertical] ?? VERTICAL_RECIPES.general;

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: body.name,
          slug: body.slug,
          plan: body.plan,
          isActive: true,
        },
      });

      if (domainInputs.length > 0) {
        await tx.tenantDomain.createMany({
          data: domainInputs.map((domain) => ({
            tenantId: tenant.id,
            hostname: domain.hostname!,
            portalType: domain.portalType,
            isPrimary: true,
          })),
        });
      }

      await tx.tenantSetting.createMany({
        data: [
          { tenantId: tenant.id, key: "currency", value: "INR" },
          { tenantId: tenant.id, key: "timezone", value: "Asia/Kolkata" },
          { tenantId: tenant.id, key: "brand.displayName", value: body.name },
          { tenantId: tenant.id, key: "onboarding.vertical", value: body.vertical },
        ],
      });

      // Default branch (gateway-owned). Cross-service setup (warehouse, order
      // workflow) is enqueued as reconciliation records below.
      await tx.branch.create({
        data: {
          tenantId: tenant.id,
          code: "MAIN",
          name: "Main",
          isDefault: true,
          isActive: true,
        },
      });

      let user = await tx.user.findUnique({ where: { email: body.adminEmail.toLowerCase() } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: body.adminEmail.toLowerCase(),
            name: body.adminName ?? body.adminEmail.split("@")[0],
            isActive: true,
          },
        });
        await tx.authCredential.create({
          data: { userId: user.id, type: "PASSWORD", passwordHash },
        });
      } else {
        const existing = await tx.authCredential.findFirst({
          where: { userId: user.id, type: "PASSWORD" },
        });
        if (existing) {
          await tx.authCredential.update({ where: { id: existing.id }, data: { passwordHash } });
        } else {
          await tx.authCredential.create({
            data: { userId: user.id, type: "PASSWORD", passwordHash },
          });
        }
      }

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "ADMIN",
          isActive: true,
        },
      });

      // License the modules this vertical needs (always includes "core").
      await tx.moduleLicense.createMany({
        data: recipe.modules.map((moduleId) => ({
          tenantId: tenant.id,
          moduleId,
          plan: "basic",
          isActive: true,
        })),
      });

      // Cross-service setup can't run in this (gateway) DB transaction. Enqueue
      // durable, retryable reconciliation records; they're fired best-effort after
      // commit and can be re-driven via POST /api/reconciliation/:id/retry.
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
            payload: { name: "Main", location: body.name },
            idempotencyKey: `onboard:${tenant.id}:warehouse`,
            status: "PENDING",
          },
        });
      }

      await tx.platformAuditLog.create({
        data: {
          operatorId: gate.claims.sub,
          action: "TENANT_CREATED",
          entityType: "Tenant",
          entityId: tenant.id,
          metadata: {
            slug: tenant.slug,
            plan: tenant.plan,
            vertical: body.vertical,
            modules: recipe.modules,
            adminEmail: body.adminEmail.toLowerCase(),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      return { tenant, adminEmail: body.adminEmail.toLowerCase() };
    });

    await attachFreeSubscription(result.tenant.id);

    // Best-effort cross-service provisioning. Any failure leaves the reconciliation
    // record PENDING/FAILED for later retry — the tenant is already usable.
    await drainOnboardingReconciliation(result.tenant.id, {
      requestId: request.headers.get("x-request-id") ?? undefined,
    });

    const payload: ProvisionTenantResponse = {
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      adminEmail: result.adminEmail,
      loginUrl: tenantLoginUrl(result.tenant.slug),
    };
    return NextResponse.json({ data: payload }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      const path = first?.path?.join(".") || "input";
      return NextResponse.json(
        { error: `${path}: ${first?.message ?? "Invalid request"}` },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (/Unique constraint|P2002/i.test(msg)) {
      return NextResponse.json({ error: "Tenant or admin already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
