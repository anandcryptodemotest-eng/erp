# Create a form field type

**ADR:** [0009 UI Composition](../adr/0009-ui-composition.md)

Field types extend **FormFields**. They are **not** widgets.

## Steps

1. Add the type to `FormFieldType` in [`packages/workflow/src/types/definition.ts`](../../packages/workflow/src/types/definition.ts).
2. Render it in the FormFields widget (`apps/gateway/src/lib/ui-runtime/oms-widgets.tsx`).
3. Add it to `FIELD_TYPES` in Configuration → Forms designer.
4. Prefer field types for date, checkbox, currency, email, etc. before proposing a new Input widget.

Target: ~15–20 field types platform-wide.
