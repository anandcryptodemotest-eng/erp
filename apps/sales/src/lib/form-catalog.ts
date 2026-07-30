/**
 * Design-time Form Catalog — Draft → Validate → Publish → Archive.
 * Runtime never queries drafts; startWorkflow pins published bodies into snapshot.
 *
 * Auto-seed is OFF by default (ADR 0009 / authoring UX). Call
 * `ensureFormCatalogSeed(tenantId, { force: true })` or POST action=seed to restore starters.
 */

import {
  assetKey,
  withFormId,
  type AssetRef,
  type FormDefinition,
  type WorkflowDefinition,
} from "@erp/workflow";
import { SO_STANDARD_FORMS } from "@/workflow-templates";
import { CUSTOMER_BUILTIN_FORMS } from "@/lib/customer-forms";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

/** Seed published SO_STANDARD + customer forms only when force: true (never auto on list/get). */
export async function ensureFormCatalogSeed(
  tenantId: string,
  opts: { force?: boolean } = {}
) {
  if (!opts.force) return;
  const forms = [...SO_STANDARD_FORMS, ...CUSTOMER_BUILTIN_FORMS];
  for (const form of forms) {
    const formId = form.id ?? form.key;
    const existing = await prisma.workflowFormVersion.findFirst({
      where: { tenantId, formId },
    });
    if (existing) continue;
    await prisma.workflowFormVersion.create({
      data: {
        tenantId,
        formId,
        version: 1,
        lifecycle: "PUBLISHED",
        name: form.title ?? formId,
        definition: withFormId(form) as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
  }
}

export async function listFormVersions(
  tenantId: string,
  opts: { formId?: string; lifecycle?: string; audience?: string } = {}
) {
  const rows = await prisma.workflowFormVersion.findMany({
    where: {
      tenantId,
      ...(opts.formId ? { formId: opts.formId } : {}),
      ...(opts.lifecycle ? { lifecycle: opts.lifecycle } : {}),
    },
    orderBy: [{ formId: "asc" }, { version: "desc" }],
  });
  if (!opts.audience) return rows;
  return rows.filter((row) => {
    const def = row.definition as unknown as FormDefinition;
    const audiences = def.audiences?.length ? def.audiences : ["ADMIN"];
    return audiences.includes(opts.audience!);
  });
}

/** Published form for a Host audience (ADR 0012). */
export async function getPublishedFormForAudience(
  tenantId: string,
  formId: string,
  audience: string
): Promise<{ ref: AssetRef; definition: FormDefinition; recordId: string } | null> {
  const published = await getPublishedForm(tenantId, formId);
  if (!published) return null;
  const audiences = published.definition.audiences?.length
    ? published.definition.audiences
    : ["ADMIN"];
  if (!audiences.includes(audience)) return null;
  return published;
}

export async function getPublishedForm(
  tenantId: string,
  formId: string,
  version?: number
): Promise<{ ref: AssetRef; definition: FormDefinition; recordId: string } | null> {
  const row = version
    ? await prisma.workflowFormVersion.findFirst({
        where: { tenantId, formId, version, lifecycle: "PUBLISHED" },
      })
    : await prisma.workflowFormVersion.findFirst({
        where: { tenantId, formId, lifecycle: "PUBLISHED" },
        orderBy: { version: "desc" },
      });
  if (!row) return null;
  return {
    ref: { type: "FORM", id: row.formId, version: row.version },
    definition: withFormId(row.definition as unknown as FormDefinition),
    recordId: row.id,
  };
}

export async function publishedFormAssetKeys(tenantId: string): Promise<Set<string>> {
  const rows = await prisma.workflowFormVersion.findMany({
    where: { tenantId, lifecycle: "PUBLISHED" },
    select: { formId: true, version: true },
  });
  return new Set(rows.map((r) => assetKey({ type: "FORM", id: r.formId, version: r.version })));
}

export function validateFormDefinition(def: FormDefinition): {
  ok: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!def.key?.trim() && !def.id?.trim()) {
    errors.push("form key or id is required");
  }
  if (def.renderer === "custom" && !def.component?.trim()) {
    errors.push("custom renderer requires component id");
  }
  for (const f of def.fields ?? []) {
    if (!f.key?.trim()) errors.push("field key is required");
    if (!f.label?.trim()) errors.push(`field "${f.key}" needs a label`);
    if (f.required && f.type === "readonly") {
      warnings.push(`field "${f.key}" is required but readonly`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Resolve each activity assetRef to a concrete published form; refuse missing. */
export async function resolveAndValidateWorkflowForms(
  tenantId: string,
  def: WorkflowDefinition
): Promise<{
  ok: boolean;
  errors: { code: string; message: string; activityKey?: string }[];
  resolved: Map<string, { ref: AssetRef; definition: FormDefinition }>;
  /** Definition with concrete assetRefs (no latest) */
  normalized: WorkflowDefinition;
}> {
  const errors: { code: string; message: string; activityKey?: string }[] = [];
  const resolved = new Map<string, { ref: AssetRef; definition: FormDefinition }>();
  const activities = [...def.activities];

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (a.kind !== "HUMAN") continue;

    let formId = a.assetRef?.type === "FORM" ? a.assetRef.id : null;
    let wantVersion = a.assetRef?.version;
    if (!formId && a.formKey) {
      formId = a.formKey.replace(/_form$/, "").replace(/_/g, "-");
    }
    if (!formId) {
      // try embedded forms[]
      const embedded = (def.forms ?? []).find((f) => f.key === a.formKey);
      if (embedded) {
        formId = embedded.id ?? embedded.key.replace(/_form$/, "").replace(/_/g, "-");
      }
    }
    if (!formId) {
      errors.push({
        code: "FORM_MISSING",
        message: `HUMAN activity "${a.key}" has no FORM assetRef`,
        activityKey: a.key,
      });
      continue;
    }

    const published = await getPublishedForm(tenantId, formId, wantVersion);
    if (!published) {
      errors.push({
        code: "FORM_ASSET_UNPUBLISHED",
        message: `Form "${formId}"@${wantVersion ?? "latest published"} is not published`,
        activityKey: a.key,
      });
      continue;
    }

    const formVal = validateFormDefinition(published.definition);
    if (!formVal.ok) {
      errors.push({
        code: "FORM_INVALID",
        message: `Form "${formId}" v${published.ref.version}: ${formVal.errors.join("; ")}`,
        activityKey: a.key,
      });
      continue;
    }

    const k = assetKey(published.ref);
    resolved.set(k, { ref: published.ref, definition: published.definition });
    activities[i] = {
      ...a,
      assetRef: published.ref,
      formKey: a.formKey ?? published.definition.key,
    };
  }

  return {
    ok: errors.length === 0,
    errors,
    resolved,
    normalized: { ...def, activities },
  };
}

export async function rewriteWorkflowDependencies(
  tenantId: string,
  template: {
    id: string;
    templateCode: string;
    version: number;
  },
  refs: AssetRef[]
) {
  await prisma.workflowAssetDependency.deleteMany({
    where: {
      tenantId,
      consumerType: "WORKFLOW",
      consumerId: template.templateCode,
      consumerVersion: template.version,
    },
  });
  for (const ref of refs) {
    await prisma.workflowAssetDependency.create({
      data: {
        tenantId,
        assetType: ref.type,
        assetId: ref.id,
        assetVersion: ref.version,
        consumerType: "WORKFLOW",
        consumerId: template.templateCode,
        consumerVersion: template.version,
        consumerRecordId: template.id,
      },
    });
  }
}

export async function getFormReferencedBy(tenantId: string, formId: string) {
  return prisma.workflowAssetDependency.findMany({
    where: { tenantId, assetType: "FORM", assetId: formId },
    orderBy: [{ consumerId: "asc" }, { consumerVersion: "desc" }],
  });
}
