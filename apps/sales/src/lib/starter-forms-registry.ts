import type { FormDefinition } from "@erp/workflow";
import {
  classifyStarterFormHash,
  hashFormDefinition,
  type StarterUpgradeStatus,
} from "@erp/workflow/starter-hash";
import {
  SO_STANDARD_FORMS,
  SO_STANDARD_FORMS_REV1,
  SO_STANDARD_FORMS_REV2,
  SO_STANDARD_FORMS_REV3,
  SO_STANDARD_FORMS_REV4,
  STARTER_FORM_LATEST_REVISION,
} from "@/workflow-templates";
import {
  CUSTOMER_BUILTIN_FORMS,
  CUSTOMER_CHECKOUT_FORM,
  CUSTOMER_CHECKOUT_FORM_REV1,
} from "@/lib/customer-forms";

export { STARTER_FORM_LATEST_REVISION };

/** Latest starter bodies used for seed + confirmed upgrade. */
export function latestStarterForms(): FormDefinition[] {
  return [...SO_STANDARD_FORMS, ...CUSTOMER_BUILTIN_FORMS];
}

/**
 * formId → { revision → hash }
 * Built from frozen rev1/rev2 snapshots + latest starter bodies.
 */
export function buildStarterHashRegistry(): Record<string, Record<number, string>> {
  const registry: Record<string, Record<number, string>> = {};

  function add(rev: number, forms: FormDefinition[]) {
    for (const form of forms) {
      const formId = form.id ?? form.key;
      registry[formId] ??= {};
      registry[formId][rev] = hashFormDefinition(form);
    }
  }

  add(1, SO_STANDARD_FORMS_REV1);
  add(1, [CUSTOMER_CHECKOUT_FORM_REV1]);
  for (const form of CUSTOMER_BUILTIN_FORMS) {
    const formId = form.id ?? form.key;
    if (formId === "customer-checkout") continue;
    registry[formId] ??= {};
    registry[formId][1] = hashFormDefinition(form);
  }

  add(2, SO_STANDARD_FORMS_REV2);
  // Customer checkout unchanged across rev2→3: same body as latest for non-checkout already hashed at 1
  add(2, [CUSTOMER_CHECKOUT_FORM]);
  for (const form of CUSTOMER_BUILTIN_FORMS) {
    const formId = form.id ?? form.key;
    if (formId === "customer-checkout") continue;
    registry[formId] ??= {};
    registry[formId][2] = hashFormDefinition(form);
  }

  add(3, SO_STANDARD_FORMS_REV3);
  add(3, [CUSTOMER_CHECKOUT_FORM]);
  for (const form of CUSTOMER_BUILTIN_FORMS) {
    const formId = form.id ?? form.key;
    if (formId === "customer-checkout") continue;
    registry[formId] ??= {};
    registry[formId][3] = hashFormDefinition(form);
  }

  add(4, SO_STANDARD_FORMS_REV4);
  add(4, [CUSTOMER_CHECKOUT_FORM]);
  for (const form of CUSTOMER_BUILTIN_FORMS) {
    const formId = form.id ?? form.key;
    if (formId === "customer-checkout") continue;
    registry[formId] ??= {};
    registry[formId][4] = hashFormDefinition(form);
  }

  add(STARTER_FORM_LATEST_REVISION, SO_STANDARD_FORMS);
  add(STARTER_FORM_LATEST_REVISION, [CUSTOMER_CHECKOUT_FORM]);
  for (const form of CUSTOMER_BUILTIN_FORMS) {
    const formId = form.id ?? form.key;
    if (formId === "customer-checkout") continue;
    registry[formId] ??= {};
    registry[formId][STARTER_FORM_LATEST_REVISION] = hashFormDefinition(form);
  }

  return registry;
}

export function classifyPublishedStarter(
  formId: string,
  definition: FormDefinition | null
): StarterUpgradeStatus {
  const registry = buildStarterHashRegistry();
  const revisionHashes = registry[formId];
  if (!revisionHashes) {
    return definition ? "customized" : "missing";
  }
  const publishedHash = definition ? hashFormDefinition(definition) : null;
  return classifyStarterFormHash(publishedHash, revisionHashes, STARTER_FORM_LATEST_REVISION);
}

export function getLatestStarterBody(formId: string): FormDefinition | null {
  return latestStarterForms().find((f) => (f.id ?? f.key) === formId) ?? null;
}
