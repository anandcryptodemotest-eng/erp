/**
 * Canonical form definition validation — shared by Sales, Gateway, Platform, Forms Studio.
 */

import type { FormDefinition, FormFieldDefinition } from "../types/definition";

export type FormValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type FormValidationResult = {
  errors: FormValidationIssue[];
  warnings: FormValidationIssue[];
  canSave: boolean;
  canPublish: boolean;
};

function issue(code: string, message: string, path?: string): FormValidationIssue {
  return { code, message, path };
}

export function validateFields(fields: FormFieldDefinition[] | undefined): {
  errors: FormValidationIssue[];
  warnings: FormValidationIssue[];
} {
  const errors: FormValidationIssue[] = [];
  const warnings: FormValidationIssue[] = [];
  const seen = new Set<string>();

  for (const f of fields ?? []) {
    const path = `fields.${f.key || "?"}`;
    if (!f.key?.trim()) {
      errors.push(issue("FIELD_KEY_REQUIRED", "Field key is required", path));
    } else if (seen.has(f.key)) {
      errors.push(issue("FIELD_KEY_DUPLICATE", `Duplicate field key "${f.key}"`, path));
    } else {
      seen.add(f.key);
    }
    if (!f.label?.trim()) {
      errors.push(issue("FIELD_LABEL_REQUIRED", `Field "${f.key || "?"}" needs a label`, path));
    }
    if (f.required && f.type === "readonly") {
      warnings.push(
        issue("FIELD_READONLY_REQUIRED", `Field "${f.key}" is required but readonly`, path)
      );
    }
    if ((f.type === "select" || f.type === "radio") && !(f.options?.length)) {
      warnings.push(
        issue("FIELD_OPTIONS_EMPTY", `Field "${f.key}" has no options`, path)
      );
    }
  }

  return { errors, warnings };
}

export function validateLayout(def: FormDefinition): {
  errors: FormValidationIssue[];
  warnings: FormValidationIssue[];
} {
  const errors: FormValidationIssue[] = [];
  const warnings: FormValidationIssue[] = [];
  const layout = def.layout ?? [];

  if (layout.length === 0) {
    warnings.push(
      issue(
        "LAYOUT_EMPTY",
        "No layout widgets — task review needs Form Fields + Action Buttons before publish",
        "layout"
      )
    );
  } else {
    const ids = layout.map((w) => w.widget);
    if (!ids.includes("FormFields") && (def.fields?.length ?? 0) > 0) {
      warnings.push(
        issue(
          "LAYOUT_MISSING_FORM_FIELDS",
          "Layout has fields defined but no Form Fields widget",
          "layout"
        )
      );
    }
    if (!ids.includes("ActionButtons")) {
      warnings.push(
        issue("LAYOUT_MISSING_ACTIONS", "Layout has no Action Buttons widget", "layout")
      );
    }
  }

  return { errors, warnings };
}

export function validateForm(def: FormDefinition): FormValidationResult {
  const errors: FormValidationIssue[] = [];
  const warnings: FormValidationIssue[] = [];

  if (!def.key?.trim() && !def.id?.trim()) {
    errors.push(issue("FORM_KEY_REQUIRED", "Form key or id is required", "key"));
  }
  if (def.renderer === "custom" && !def.component?.trim()) {
    errors.push(issue("CUSTOM_COMPONENT_REQUIRED", "Custom renderer requires component id", "component"));
  }

  const fields = validateFields(def.fields);
  errors.push(...fields.errors);
  warnings.push(...fields.warnings);

  const layout = validateLayout(def);
  errors.push(...layout.errors);
  warnings.push(...layout.warnings);

  const canSave = errors.length === 0;
  return { errors, warnings, canSave, canPublish: false };
}

/** Publish-time checks (stricter than draft save). */
export function validatePublish(def: FormDefinition): FormValidationResult {
  const base = validateForm(def);
  const errors = [...base.errors];
  const warnings = [...base.warnings];

  if (!(def.layout?.length)) {
    errors.push(
      issue(
        "PUBLISH_LAYOUT_REQUIRED",
        "Publish requires at least one layout widget",
        "layout"
      )
    );
  }

  const canPublish = errors.length === 0;
  return {
    errors,
    warnings,
    canSave: base.canSave,
    canPublish,
  };
}

/** Convenience: validate for the given lifecycle intent. */
export function validateFormDefinition(
  def: FormDefinition,
  intent: "save" | "publish" = "save"
): FormValidationResult {
  return intent === "publish" ? validatePublish(def) : validateForm(def);
}
