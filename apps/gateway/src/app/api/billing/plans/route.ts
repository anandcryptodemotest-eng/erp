import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { requireTenantUser } from "@/lib/billing-auth";
import { prisma } from "@/lib/prisma";
import {
  BILLING_INTERVALS,
  BillingHttpError,
  createBillingPlan,
  ensureBillingCatalog,
  mergePlanFeatureCodes,
} from "@/lib/billing-core";

const intervalSchema = z.enum(BILLING_INTERVALS);

const createPlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "code must start with a letter and use lowercase letters, digits, or underscores"),
  name: z.string().min(2).max(80),
  billingInterval: intervalSchema,
  amountPaise: z.number().int().min(0),
  currency: z.literal("INR").optional().default("INR"),
  includedSeats: z.number().int().min(1).max(10_000),
  isActive: z.boolean().optional().default(true),
  featureCodes: z.array(z.string().min(1)).min(1),
});

const patchPlanSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  amountPaise: z.number().int().min(0).optional(),
  includedSeats: z.number().int().min(1).max(10_000).optional(),
  billingInterval: intervalSchema.optional(),
  currency: z.literal("INR").optional(),
  isActive: z.boolean().optional(),
  featureCodes: z.array(z.string()).optional(),
});

function serializePlan<T extends { features: { feature: { code: string } }[] }>(plan: T) {
  return {
    ...plan,
    featureCodes: plan.features.map((f) => f.feature.code),
  };
}

/** GET /api/billing/plans */
export async function GET(request: Request) {
  const auth = await requireTenantUser(request);
  let platform = false;
  if (auth instanceof NextResponse) {
    const gate = await requirePlatformAuth(request, "readAll");
    if (gate instanceof NextResponse) return auth;
    platform = true;
  }
  await ensureBillingCatalog();
  const plans = await prisma.billingPlan.findMany({
    where: platform ? {} : { isActive: true },
    include: { features: { include: { feature: true } } },
    orderBy: { amountPaise: "asc" },
  });
  return NextResponse.json({
    data: plans.map(serializePlan),
  });
}

/** POST /api/billing/plans — platform creates a catalog plan (does not mutate in-period snapshots) */
export async function POST(request: Request) {
  const gate = await requirePlatformAuth(request, "manageLicenses");
  if (gate instanceof NextResponse) return gate;
  const body = await request.json().catch(() => ({}));
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const plan = await createBillingPlan(parsed.data);
    return NextResponse.json({ data: serializePlan(plan) }, { status: 201 });
  } catch (err) {
    if (err instanceof BillingHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

/** PATCH /api/billing/plans — platform updates catalog (does not mutate in-period snapshots) */
export async function PATCH(request: Request) {
  const gate = await requirePlatformAuth(request, "manageLicenses");
  if (gate instanceof NextResponse) return gate;
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const parsed = patchPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const plan = await prisma.billingPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  await prisma.billingPlan.update({
    where: { id },
    data: {
      name: parsed.data.name,
      amountPaise: parsed.data.amountPaise,
      includedSeats: parsed.data.includedSeats,
      billingInterval: parsed.data.billingInterval,
      currency: parsed.data.currency,
      isActive: parsed.data.isActive,
    },
  });
  if (parsed.data.featureCodes) {
    const codes = mergePlanFeatureCodes(parsed.data.featureCodes);
    const features = await prisma.saasFeature.findMany({ where: { code: { in: codes } } });
    await prisma.billingPlanFeature.deleteMany({ where: { planId: id } });
    await prisma.billingPlanFeature.createMany({
      data: features.map((f) => ({ planId: id, featureId: f.id })),
    });
  }
  const fresh = await prisma.billingPlan.findUnique({
    where: { id },
    include: { features: { include: { feature: true } } },
  });
  return NextResponse.json({ data: fresh ? serializePlan(fresh) : fresh });
}
