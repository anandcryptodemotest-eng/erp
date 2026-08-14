import { createHash } from "node:crypto";
import { createLogger } from "@erp/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger({ service: "gateway-billing" });

export const PLATFORM_CONFIG_ID = "platform";
export const PRODUCT_CODE = "SANKALP_ERP";
export const FREE_PLAN_CODE = "free_once";
export const FREE_FEATURES = ["dashboard", "organization", "users"] as const;
export const BILLING_INTERVALS = ["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export class BillingHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "BillingHttpError";
  }
}

export const RENEWAL_NOTICE_KIND = "SAAS_RENEWAL_REMINDER";
const UNPAID_STATUSES = ["OPEN", "PARTIALLY_PAID", "OVERDUE"];
const MS_DAY = 24 * 60 * 60 * 1000;

export type EntitlementResult = {
  licensed: boolean;
  reason: string;
  status: string;
  features: string[];
};

const FEATURES: { code: string; name: string; kind: string; mapsTo: string }[] = [
  { code: "dashboard", name: "Dashboard", kind: "FLOW", mapsTo: "core" },
  { code: "organization", name: "Organization settings", kind: "FLOW", mapsTo: "core" },
  { code: "users", name: "Users", kind: "FLOW", mapsTo: "core" },
  { code: "oms", name: "Order Desk / OMS", kind: "FLOW", mapsTo: "sales" },
  { code: "quick_bill", name: "Quick Bill", kind: "FLOW", mapsTo: "sales" },
  { code: "inventory", name: "Inventory", kind: "MODULE", mapsTo: "inventory" },
  { code: "accounting", name: "Accounting", kind: "MODULE", mapsTo: "accounting" },
  { code: "gst", name: "India GST pack", kind: "CAPABILITY", mapsTo: "indiaGst" },
  { code: "ar", name: "AR workbench", kind: "FLOW", mapsTo: "accounting" },
  { code: "process_studio", name: "Process Studio", kind: "CAPABILITY", mapsTo: "processStudio" },
  { code: "portal", name: "Customer portal", kind: "FLOW", mapsTo: "sales" },
  { code: "procurement", name: "Procurement", kind: "MODULE", mapsTo: "procurement" },
  { code: "delivery", name: "Delivery", kind: "MODULE", mapsTo: "delivery" },
  { code: "hr", name: "HR", kind: "MODULE", mapsTo: "hr" },
];

const PLAN_DEFS: {
  code: string;
  name: string;
  billingInterval: string;
  amountPaise: number;
  includedSeats: number;
  features: string[];
}[] = [
  {
    code: FREE_PLAN_CODE,
    name: "Free",
    billingInterval: "ONCE",
    amountPaise: 0,
    includedSeats: 5,
    features: [...FREE_FEATURES],
  },
  {
    code: "starter_monthly",
    name: "Starter",
    billingInterval: "MONTHLY",
    amountPaise: 10_000,
    includedSeats: 5,
    features: [...FREE_FEATURES, "oms", "inventory", "portal"],
  },
  {
    code: "growth_monthly",
    name: "Growth",
    billingInterval: "MONTHLY",
    amountPaise: 50_000,
    includedSeats: 15,
    features: [...FREE_FEATURES, "oms", "quick_bill", "inventory", "accounting", "gst", "ar", "procurement", "portal"],
  },
  {
    code: "lifetime_once",
    name: "Lifetime",
    billingInterval: "ONCE",
    amountPaise: 500_000,
    includedSeats: 25,
    features: [...FREE_FEATURES, "oms", "quick_bill", "inventory", "accounting", "gst", "ar", "procurement", "portal"],
  },
];

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_DAY);
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function billingPeriodKey(interval: string, start: Date, end: Date, planCode?: string): string {
  const span = interval === "ONCE" ? `ONCE_${ymd(start)}` : `${ymd(start)}_${ymd(end)}`;
  return planCode ? `${planCode}:${span}` : span;
}

export function periodLengthDays(interval: string): number {
  if (interval === "YEARLY") return 365;
  if (interval === "QUARTERLY") return 90;
  if (interval === "WEEKLY") return 7;
  if (interval === "ONCE") return 0;
  return 30;
}

export function freeEntitlement(reason = "free", status = "NONE"): EntitlementResult {
  return { licensed: true, reason, status, features: [...FREE_FEATURES] };
}

export function computeEntitlement(input: {
  subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    featureCodes: string[];
    planCode?: string;
  } | null;
  graceDays: number;
  now?: Date;
}): EntitlementResult {
  const now = input.now ?? new Date();
  if (!input.subscription) return freeEntitlement("free_fallback", "NONE");

  const { status, currentPeriodEnd, featureCodes, planCode } = input.subscription;
  const features = featureCodes.length ? featureCodes : [...FREE_FEATURES];

  if (status === "INITIATED") return freeEntitlement("initiated", status);

  if (status === "ACTIVE") {
    if (currentPeriodEnd && now >= addDays(currentPeriodEnd, input.graceDays)) {
      return freeEntitlement("period_ended_free", status);
    }
    if (planCode === FREE_PLAN_CODE || !features.includes("oms")) {
      return { licensed: true, reason: "free", status, features };
    }
    return { licensed: true, reason: "SUBSCRIBED", status, features };
  }

  if (status === "PAST_DUE") {
    if (currentPeriodEnd && now < addDays(currentPeriodEnd, input.graceDays)) {
      return { licensed: true, reason: "grace", status, features };
    }
    return freeEntitlement("past_due_grace_ended", status);
  }

  if (status === "CANCELLED" || status === "EXPIRED") return freeEntitlement("cancelled", status);
  return freeEntitlement("unknown_status", status);
}

export function hasFeature(entitlement: EntitlementResult, code: string): boolean {
  if (!entitlement.licensed) return false;
  return entitlement.features.includes("*") || entitlement.features.includes(code);
}

function isUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

export async function ensureBillingCatalog() {
  const cfg =
    (await prisma.paymentPlatformConfig.findUnique({ where: { id: PLATFORM_CONFIG_ID } })) ??
    (await prisma.paymentPlatformConfig.create({
      data: { id: PLATFORM_CONFIG_ID, mode: "DEMO", graceDays: 3, reminderDays: 2 },
    }));

  const product = await prisma.saasProduct.upsert({
    where: { code: PRODUCT_CODE },
    create: { code: PRODUCT_CODE, name: "Sankalp ERP", isActive: true },
    update: {},
  });

  for (const f of FEATURES) {
    await prisma.saasFeature.upsert({
      where: { code: f.code },
      create: f,
      update: { name: f.name, kind: f.kind, mapsTo: f.mapsTo },
    });
  }

  const featureRows = await prisma.saasFeature.findMany();
  const byCode = Object.fromEntries(featureRows.map((r) => [r.code, r.id]));

  for (const p of PLAN_DEFS) {
    const plan = await prisma.billingPlan.upsert({
      where: { code: p.code },
      create: {
        productId: product.id,
        code: p.code,
        name: p.name,
        billingInterval: p.billingInterval,
        amountPaise: p.amountPaise,
        includedSeats: p.includedSeats,
        isActive: true,
      },
      update: {},
    });
    for (const code of p.features) {
      const featureId = byCode[code];
      if (!featureId) continue;
      await prisma.billingPlanFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId } },
        create: { planId: plan.id, featureId },
        update: {},
      });
    }
  }

  return cfg;
}

export function mergePlanFeatureCodes(featureCodes: string[]): string[] {
  return [...new Set([...FREE_FEATURES, ...featureCodes])];
}

export async function createBillingPlan(input: {
  code: string;
  name: string;
  billingInterval: string;
  amountPaise: number;
  currency?: string;
  includedSeats: number;
  isActive?: boolean;
  featureCodes: string[];
}) {
  await ensureBillingCatalog();
  const product = await prisma.saasProduct.findUnique({ where: { code: PRODUCT_CODE } });
  if (!product) throw new BillingHttpError("Sankalp product catalog is missing", 500);

  const requested = mergePlanFeatureCodes(input.featureCodes);
  const features = await prisma.saasFeature.findMany({ where: { code: { in: requested } } });
  const known = new Set(features.map((f) => f.code));
  const unknown = requested.filter((c) => !known.has(c));
  if (unknown.length) {
    throw new BillingHttpError(`Unknown feature codes: ${unknown.join(", ")}`, 400);
  }

  try {
    return await prisma.billingPlan.create({
      data: {
        productId: product.id,
        code: input.code,
        name: input.name,
        billingInterval: input.billingInterval,
        amountPaise: input.amountPaise,
        currency: input.currency ?? "INR",
        includedSeats: input.includedSeats,
        isActive: input.isActive ?? true,
        features: { create: features.map((f) => ({ featureId: f.id })) },
      },
      include: { features: { include: { feature: true } } },
    });
  } catch (err) {
    if (isUnique(err)) throw new BillingHttpError("Plan code already exists", 409);
    throw err;
  }
}

async function featureCodesForPlan(planId: string): Promise<string[]> {
  const links = await prisma.billingPlanFeature.findMany({
    where: { planId },
    include: { feature: true },
  });
  return links.map((l) => l.feature.code);
}

async function nextInvoiceNumber(): Promise<string> {
  const count = await prisma.billingInvoice.count();
  return `INV-SANKALP-${String(count + 1).padStart(6, "0")}`;
}

async function freePlanRow() {
  await ensureBillingCatalog();
  const plan = await prisma.billingPlan.findUnique({ where: { code: FREE_PLAN_CODE } });
  if (!plan) throw new Error("Free plan missing");
  return plan;
}

export async function getTenantEntitlement(tenantId: string, now = new Date()): Promise<EntitlementResult> {
  const cfg = await ensureBillingCatalog();
  const sub = await prisma.billingSubscription.findUnique({
    where: { tenantId },
    select: { status: true, currentPeriodEnd: true, featureCodes: true, plan: { select: { code: true } } },
  });
  return computeEntitlement({
    subscription: sub ? { ...sub, planCode: sub.plan.code } : null,
    graceDays: cfg.graceDays,
    now,
  });
}

export async function attachFreeSubscription(tenantId: string, now = new Date()) {
  const plan = await freePlanRow();
  const codes = await featureCodesForPlan(plan.id);
  const existing = await prisma.billingSubscription.findUnique({ where: { tenantId } });
  if (existing) return existing;

  const sub = await prisma.billingSubscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: "ACTIVE",
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      nextBillingDate: null,
      pendingPlanId: null,
      seatLimit: plan.includedSeats,
      featureCodes: codes,
    },
  });
  await prisma.billingSchedule.create({
    data: { subscriptionId: sub.id, frequency: "ONCE", status: "COMPLETED", nextRunAt: null },
  });
  return sub;
}

export async function downgradeToFree(subscriptionId: string, now = new Date()) {
  const plan = await freePlanRow();
  const codes = await featureCodesForPlan(plan.id);
  const sub = await prisma.billingSubscription.update({
    where: { id: subscriptionId },
    data: {
      planId: plan.id,
      pendingPlanId: null,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: null,
      nextBillingDate: null,
      seatLimit: plan.includedSeats,
      featureCodes: codes,
      lastError: null,
    },
  });
  await prisma.billingSchedule.updateMany({
    where: { subscriptionId },
    data: { frequency: "ONCE", status: "COMPLETED", nextRunAt: null, lastRunAt: now },
  });
  await projectEntitlements(sub.tenantId, codes);
  return sub;
}

async function voidUnpaidInvoices(subscriptionId: string) {
  const open = await prisma.billingInvoice.findMany({
    where: { subscriptionId, status: { in: UNPAID_STATUSES } },
  });
  for (const inv of open) {
    await prisma.billingInvoice.update({
      where: { id: inv.id },
      data: {
        status: "VOID",
        billingPeriodKey: `VOID:${inv.id}:${inv.billingPeriodKey}`.slice(0, 180),
      },
    });
  }
  return open.length;
}

async function ensurePeriodInvoice(input: {
  subscriptionId: string;
  tenantId: string;
  plan: { id: string; code: string; name: string; amountPaise: number; currency: string; billingInterval: string };
  periodStart: Date;
  periodEnd: Date;
  billingPeriodKey: string;
  dueDate: Date;
}) {
  const existing = await prisma.billingInvoice.findUnique({
    where: {
      subscriptionId_billingPeriodKey: {
        subscriptionId: input.subscriptionId,
        billingPeriodKey: input.billingPeriodKey,
      },
    },
  });
  if (existing) return existing;

  try {
    return await prisma.billingInvoice.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: input.subscriptionId,
        planId: input.plan.id,
        invoiceNumber: await nextInvoiceNumber(),
        billingPeriodKey: input.billingPeriodKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        subtotalPaise: input.plan.amountPaise,
        taxPaise: 0,
        totalPaise: input.plan.amountPaise,
        currency: input.plan.currency,
        status: "OPEN",
        dueDate: input.dueDate,
        lines: {
          create: {
            description: input.plan.name,
            quantity: 1,
            unitPricePaise: input.plan.amountPaise,
            amountPaise: input.plan.amountPaise,
          },
        },
      },
    });
  } catch (err) {
    if (isUnique(err)) {
      const again = await prisma.billingInvoice.findUnique({
        where: {
          subscriptionId_billingPeriodKey: {
            subscriptionId: input.subscriptionId,
            billingPeriodKey: input.billingPeriodKey,
          },
        },
      });
      if (again) return again;
    }
    throw err;
  }
}

/** Upgrade or change plan: keep current entitlement until the new invoice is PAID. */
export async function subscribeTenant(input: { tenantId: string; planId: string; now?: Date }) {
  const now = input.now ?? new Date();
  await ensureBillingCatalog();
  const plan = await prisma.billingPlan.findFirst({
    where: { id: input.planId, isActive: true },
  });
  if (!plan) return { ok: false as const, status: 404, error: "Plan not found" };

  let sub = await prisma.billingSubscription.findUnique({ where: { tenantId: input.tenantId } });
  if (!sub) sub = await attachFreeSubscription(input.tenantId, now);

  if (plan.code === FREE_PLAN_CODE) {
    const updated = await downgradeToFree(sub.id, now);
    return { ok: true as const, subscription: updated, invoice: null, plan };
  }

  const days = periodLengthDays(plan.billingInterval);
  const periodStart = now;
  const periodEnd = days === 0 ? now : addDays(now, days);
  const key = billingPeriodKey(plan.billingInterval, periodStart, periodEnd, plan.code);

  await voidUnpaidInvoices(sub.id);
  sub = await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { pendingPlanId: plan.id, lastError: null },
  });

  const invoice = await ensurePeriodInvoice({
    subscriptionId: sub.id,
    tenantId: input.tenantId,
    plan,
    periodStart,
    periodEnd,
    billingPeriodKey: key,
    dueDate: periodEnd,
  });

  return { ok: true as const, subscription: sub, invoice, plan };
}

/** Apply a captured payment to an OPEN invoice. Invoice.planId is the source of truth. */
export async function applyCapturedPayment(input: {
  invoiceId: string;
  tenantId: string;
  amountPaise: number;
  provider: string;
  providerPaymentId: string;
  providerOrderId?: string;
  providerEventId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    include: { plan: true, subscription: { include: { plan: true } } },
  });
  if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found" };
  if (invoice.status === "VOID") return { ok: false as const, status: 409, error: "Invoice is void" };
  const amount = input.amountPaise > 0 ? input.amountPaise : invoice.totalPaise;

  try {
    await prisma.paymentProviderTransaction.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        providerPaymentId: input.providerPaymentId,
        providerOrderId: input.providerOrderId,
        eventType: "payment.captured",
        payloadHash: createHash("sha256").update(input.providerEventId).digest("hex"),
        status: "PROCESSED",
      },
    });
  } catch (err) {
    if (isUnique(err)) {
      const paid = await prisma.billingInvoice.findUnique({
        where: { id: invoice.id },
        include: { plan: true, subscription: { include: { plan: true } } },
      });
      // Idempotent capture must still heal subscriptions stuck on Free after a prior PAID invoice
      // (e.g. grant/demo-pay replay when plan activate was skipped or later downgraded incorrectly).
      if (paid?.status === "PAID" && paid.subscription.planId !== paid.planId) {
        const codes = await featureCodesForPlan(paid.planId);
        const periodEnd = paid.plan.billingInterval === "ONCE" ? null : paid.periodEnd;
        const healed = await prisma.billingSubscription.update({
          where: { id: paid.subscriptionId },
          data: {
            planId: paid.planId,
            pendingPlanId: null,
            status: "ACTIVE",
            currentPeriodStart: paid.periodStart,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            seatLimit: paid.plan.includedSeats,
            featureCodes: codes,
            lastError: null,
          },
          include: { plan: true },
        });
        await projectEntitlements(paid.tenantId, codes);
        return {
          ok: true as const,
          duplicate: true,
          invoice: paid,
          subscription: healed,
        };
      }
      return {
        ok: true as const,
        duplicate: true,
        invoice: paid,
        subscription: paid?.subscription ?? invoice.subscription,
      };
    }
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    let payment = await tx.billingPayment.findFirst({
      where: { provider: input.provider, providerPaymentId: input.providerPaymentId },
    });
    if (!payment) {
      payment = await tx.billingPayment.create({
        data: {
          tenantId: input.tenantId,
          subscriptionId: invoice.subscriptionId,
          amountPaise: amount,
          currency: invoice.currency,
          status: "CAPTURED",
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          providerOrderId: input.providerOrderId,
          paidAt: now,
        },
      });
    }

    try {
      await tx.billingPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amountPaise: Math.min(amount, invoice.totalPaise),
        },
      });
    } catch (err) {
      if (!isUnique(err)) throw err;
    }

    const allocated = await tx.billingPaymentAllocation.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amountPaise: true },
    });
    const paidSum = allocated._sum.amountPaise ?? 0;
    const fullyPaid = paidSum >= invoice.totalPaise;
    const updatedInvoice = await tx.billingInvoice.update({
      where: { id: invoice.id },
      data: fullyPaid ? { status: "PAID", paidAt: now } : { status: "PARTIALLY_PAID" },
    });

    let sub = invoice.subscription;
    if (fullyPaid) {
      const paidPlan = invoice.plan;
      const codes = await featureCodesForPlan(paidPlan.id);
      const periodEnd = paidPlan.billingInterval === "ONCE" ? null : invoice.periodEnd;
      sub = await tx.billingSubscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          planId: paidPlan.id,
          pendingPlanId: null,
          status: "ACTIVE",
          currentPeriodStart: invoice.periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
          seatLimit: paidPlan.includedSeats,
          featureCodes: codes,
          lastError: null,
        },
        include: { plan: true },
      });
      if (paidPlan.billingInterval === "ONCE") {
        await tx.billingSchedule.updateMany({
          where: { subscriptionId: sub.id },
          data: { status: "COMPLETED", nextRunAt: null, lastRunAt: now },
        });
      } else {
        await tx.billingSchedule.upsert({
          where: { subscriptionId: sub.id },
          create: {
            subscriptionId: sub.id,
            frequency: paidPlan.billingInterval,
            nextRunAt: invoice.periodEnd,
            lastRunAt: now,
            status: "ACTIVE",
          },
          update: {
            frequency: paidPlan.billingInterval,
            nextRunAt: invoice.periodEnd,
            lastRunAt: now,
            status: "ACTIVE",
          },
        });
      }
    }

    return { payment, invoice: updatedInvoice, subscription: sub, fullyPaid };
  });

  if (result.fullyPaid) {
    void projectEntitlements(invoice.subscription.tenantId, result.subscription.featureCodes).catch((err) => {
      log.error("billing_projection_failed", { err, tenantId: invoice.subscription.tenantId });
    });
  }

  return { ok: true as const, duplicate: false, ...result };
}

export async function projectEntitlements(tenantId: string, featureCodes: string[]) {
  const features = await prisma.saasFeature.findMany({ where: { code: { in: featureCodes } } });
  const modules = new Set<string>(["core"]);
  const capabilities: string[] = [];
  for (const f of features) {
    if (f.kind === "CAPABILITY") capabilities.push(f.mapsTo);
    else if (f.mapsTo && f.mapsTo !== "core") modules.add(f.mapsTo);
  }
  for (const moduleId of modules) {
    await prisma.moduleLicense.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      create: { tenantId, moduleId, plan: "basic", isActive: true },
      update: { isActive: true },
    });
  }
  for (const key of capabilities) {
    await prisma.tenantCapability.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, enabled: true },
      update: { enabled: true },
    });
  }
}

export async function demoPayInvoice(input: { tenantId: string; invoiceId: string; now?: Date }) {
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
  });
  if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found" };
  if (invoice.status === "VOID") return { ok: false as const, status: 409, error: "Invoice is void" };
  const payId = `pay_demo_${invoice.id}`;
  return applyCapturedPayment({
    invoiceId: invoice.id,
    tenantId: input.tenantId,
    amountPaise: invoice.totalPaise,
    provider: "DEMO",
    providerPaymentId: payId,
    providerEventId: `evt_demo_${payId}`,
    now: input.now,
  });
}

export async function grantPaidPlanDemo(input: { tenantId: string; planCode: string; now?: Date }) {
  const cfg = await ensureBillingCatalog();
  if (cfg.mode === "LIVE") return { ok: false as const, status: 409, error: "grant is blocked in LIVE mode" };
  const plan = await prisma.billingPlan.findUnique({ where: { code: input.planCode } });
  if (!plan) return { ok: false as const, status: 404, error: "Plan not found" };
  const sub = await subscribeTenant({ tenantId: input.tenantId, planId: plan.id, now: input.now });
  if (!sub.ok) return sub;
  if (!sub.invoice) return { ok: true as const, subscription: sub.subscription, invoice: null };
  return demoPayInvoice({ tenantId: input.tenantId, invoiceId: sub.invoice.id, now: input.now });
}

async function emitRenewalNotice(sub: { id: string; tenantId: string; currentPeriodEnd: Date }) {
  const periodKey = ymd(sub.currentPeriodEnd);
  try {
    await prisma.billingNotice.create({
      data: {
        kind: RENEWAL_NOTICE_KIND,
        subscriptionId: sub.id,
        periodKey,
      },
    });
  } catch (err) {
    if (isUnique(err)) return false;
    throw err;
  }
  const admins = await prisma.tenantUser.findMany({
    where: { tenantId: sub.tenantId, isActive: true, role: { in: ["ADMIN", "ORG_ADMIN", "SUPER_ADMIN"] } },
    select: { userId: true },
  });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        tenantId: sub.tenantId,
        userId: a.userId,
        type: RENEWAL_NOTICE_KIND,
        title: "Sankalp subscription renews soon",
        body: `Pay your open invoice to keep your current plan. Period ends ${periodKey}.`,
      })),
    });
  }
  return true;
}

export async function runBilling(now = new Date()) {
  const cfg = await ensureBillingCatalog();
  const run = await prisma.billingRun.create({ data: { runDate: now, status: "RUNNING" } });
  const leadEnd = addDays(now, cfg.reminderDays);

  const due = await prisma.billingSubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      currentPeriodEnd: { not: null, lte: leadEnd },
      schedule: { status: "ACTIVE" },
    },
    include: { plan: true, schedule: true },
  });

  for (const sub of due) {
    try {
      if (sub.plan.code === FREE_PLAN_CODE || sub.plan.billingInterval === "ONCE") {
        await prisma.billingRunItem.create({
          data: { billingRunId: run.id, subscriptionId: sub.id, status: "SKIPPED" },
        });
        continue;
      }
      const start = sub.currentPeriodEnd ?? now;
      const days = periodLengthDays(sub.plan.billingInterval);
      if (days === 0) {
        await prisma.billingRunItem.create({
          data: { billingRunId: run.id, subscriptionId: sub.id, status: "SKIPPED" },
        });
        continue;
      }
      const end = addDays(start, days);
      const key = billingPeriodKey(sub.plan.billingInterval, start, end, sub.plan.code);
      const invoice = await ensurePeriodInvoice({
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        plan: sub.plan,
        periodStart: start,
        periodEnd: end,
        billingPeriodKey: key,
        dueDate: start,
      });

      if (sub.currentPeriodEnd) {
        await emitRenewalNotice({
          id: sub.id,
          tenantId: sub.tenantId,
          currentPeriodEnd: sub.currentPeriodEnd,
        });
      }

      const periodEnded = sub.currentPeriodEnd && now >= sub.currentPeriodEnd && invoice.status !== "PAID";
      if (periodEnded && sub.status === "ACTIVE") {
        await prisma.billingSubscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" },
        });
      }
      const graceEnded =
        sub.currentPeriodEnd && now >= addDays(sub.currentPeriodEnd, cfg.graceDays) && invoice.status !== "PAID";
      if (graceEnded) {
        await downgradeToFree(sub.id, now);
      }

      await prisma.billingRunItem.create({
        data: {
          billingRunId: run.id,
          subscriptionId: sub.id,
          status: "SUCCESS",
          invoiceId: invoice.id,
        },
      });
    } catch (err) {
      if (isUnique(err)) {
        await prisma.billingRunItem.create({
          data: { billingRunId: run.id, subscriptionId: sub.id, status: "SKIPPED" },
        });
        continue;
      }
      log.error("billing_run_item_failed", { err, subscriptionId: sub.id });
      try {
        await prisma.billingRunItem.create({
          data: {
            billingRunId: run.id,
            subscriptionId: sub.id,
            status: "FAILED",
            error: err instanceof Error ? err.message : "failed",
          },
        });
      } catch {
        /* unique skip */
      }
    }
  }

  await prisma.billingRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return prisma.billingRun.findUnique({
    where: { id: run.id },
    include: { items: true },
  });
}

export async function assertSeatAvailable(tenantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sub = await prisma.billingSubscription.findUnique({ where: { tenantId } });
  if (!sub || sub.status === "CANCELLED" || sub.status === "EXPIRED") return { ok: true };
  const count = await prisma.tenantUser.count({ where: { tenantId, isActive: true } });
  if (count >= sub.seatLimit) {
    return { ok: false, error: `Seat limit reached (${sub.seatLimit})` };
  }
  return { ok: true };
}

export async function backfillMissingSubscriptions() {
  await ensureBillingCatalog();
  const tenants = await prisma.tenant.findMany({
    where: { billingSubscription: null },
    include: { licenses: { where: { isActive: true, moduleId: "sales" } } },
  });
  const growth = await prisma.billingPlan.findUnique({ where: { code: "growth_monthly" } });
  for (const t of tenants) {
    if (t.licenses.length && growth) {
      await grantPaidPlanDemo({ tenantId: t.id, planCode: "growth_monthly" });
    } else {
      await attachFreeSubscription(t.id);
    }
  }
  return tenants.length;
}
