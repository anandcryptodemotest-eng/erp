import { NextResponse } from "next/server";
import { getPublishedFormForAudience } from "@/lib/form-catalog";
import { CUSTOMER_BUILTIN_FORMS } from "@/lib/customer-forms";
import { withFormId, type FormDefinition } from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

const BUILTIN: Record<string, FormDefinition> = Object.fromEntries(
  CUSTOMER_BUILTIN_FORMS.map((f) => [f.id ?? f.key, f])
);

async function ensureCustomerForm(tenantId: string, formId: string) {
  const builtin = BUILTIN[formId];
  if (!builtin) return;
  const definition = withFormId(builtin) as unknown as Prisma.InputJsonValue;
  const existing = await prisma.workflowFormVersion.findFirst({
    where: { tenantId, formId, lifecycle: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!existing) {
    await prisma.workflowFormVersion.create({
      data: {
        tenantId,
        formId,
        version: 1,
        lifecycle: "PUBLISHED",
        name: builtin.title ?? formId,
        definition,
        publishedAt: new Date(),
      },
    });
    return;
  }
  // Keep published customer builtins in sync with code (dev / seed drift).
  await prisma.workflowFormVersion.update({
    where: { id: existing.id },
    data: {
      name: builtin.title ?? formId,
      definition,
    },
  });
}

/**
 * GET /api/workflow-forms/published?formId=&audience=CUSTOMER
 * Host-facing published form resolution (ADR 0012).
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const formId = url.searchParams.get("formId");
  const audience = url.searchParams.get("audience") ?? "ADMIN";
  if (!formId) {
    return NextResponse.json({ error: "formId required" }, { status: 400 });
  }

  if (audience === "CUSTOMER" && BUILTIN[formId]) {
    await ensureCustomerForm(tenantId, formId);
  }

  const published = await getPublishedFormForAudience(tenantId, formId, audience);
  if (published) {
    return NextResponse.json({
      data: {
        formId: published.ref.id,
        version: published.ref.version,
        definition: published.definition,
        recordId: published.recordId,
      },
    });
  }

  const builtin = BUILTIN[formId];
  if (builtin && (builtin.audiences ?? ["ADMIN"]).includes(audience)) {
    return NextResponse.json({
      data: {
        formId,
        version: 0,
        definition: withFormId(builtin),
        recordId: null,
        meta: { builtin: true },
      },
    });
  }

  return NextResponse.json({ error: "Published form not found for audience" }, { status: 404 });
}
