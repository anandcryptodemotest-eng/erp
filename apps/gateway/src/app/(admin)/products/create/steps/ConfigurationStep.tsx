"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ActionGroup, Button, SquarePen } from "@erp/ui";
import { AttributeEditPanel, InlineAttributeCreates } from "../InlineQuickCreate";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";
import { optionList } from "../utils";

const iconSm = { width: "var(--icon-sm)", height: "var(--icon-sm)" } as const;

export function ConfigurationStep() {
  const { watch, setValue } = useFormContext<CreateProductForm>();
  const { attrs, plan, previewing, categories, refreshAttrs } = useProductMeta();
  const categoryId = watch("categoryId");
  const selected = watch("selected") ?? {};
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const [editingId, setEditingId] = useState<string | null>(null);

  const configurable = attrs.filter(
    (a) =>
      optionList(a.options).length > 0 ||
      a.dataType === "SELECT" ||
      a.dataType === "MULTI_SELECT" ||
      a.dataType === "NUMBER" ||
      a.isIdentity
  );

  const editing = editingId ? attrs.find((a) => a.id === editingId) : null;

  function toggle(key: string, value: string) {
    const cur = selected[key] ?? [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    setValue("selected", { ...selected, [key]: next }, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      <InlineAttributeCreates />

      <div>
        {!categoryId ? (
          <p className="text-sm text-[var(--ink-soft)]">Select a category on Identity first.</p>
        ) : configurable.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No configuration options yet — use New attribute above.</p>
        ) : (
          <div className="space-y-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Attributes{categoryName ? ` · ${categoryName}` : ""}
            </div>
            {configurable.map((a) => {
              const opts = optionList(a.options);
              return (
                <div key={a.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[var(--ink)]">
                      {a.label}
                      <span className="ml-2 text-[11px] font-normal text-[var(--ink-soft)]">
                        {a.dataType}
                        {a.unit ? ` · ${a.unit}` : ""}
                      </span>
                    </div>
                    <ActionGroup aria-label="Row actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit attribute ${a.label}`}
                        title="Edit attribute"
                        onClick={() => setEditingId(a.id)}
                      >
                        <SquarePen style={iconSm} aria-hidden />
                      </Button>
                    </ActionGroup>
                  </div>
                  {editingId === a.id && editing ? (
                    <AttributeEditPanel
                      attr={editing}
                      categoryId={categoryId}
                      onClose={() => setEditingId(null)}
                      onSaved={() => void refreshAttrs(categoryId)}
                    />
                  ) : opts.length === 0 ? (
                    <p className="text-xs text-[var(--ink-soft)]">
                      No values yet — use Edit to set allowed values
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {opts.map((opt) => {
                        const on = (selected[a.key] ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(a.key, opt)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                              on
                                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                                : "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)] hover:border-[var(--brand-mid)]"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[var(--ink)]">Products to Create</h4>
            <p className="text-xs text-[var(--ink-soft)]">
              {previewing ? "Updating preview…" : "Live cartesian result of your attribute selections."}
            </p>
          </div>
          {plan ? (
            <span className="text-xs tabular-nums text-[var(--ink-soft)]">{plan.total} total</span>
          ) : null}
        </div>
        {!plan || plan.products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-soft)]">
            Select configuration options to see the product family.
          </div>
        ) : (
          <ul className="max-h-[240px] overflow-y-auto divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
            {plan.products.map((p) => (
              <li key={p.index} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-center font-semibold">
                  {p.status === "willCreate" ? (
                    <span className="text-emerald-600">✓</span>
                  ) : p.status === "alreadyExists" ? (
                    <span className="text-[var(--ink-soft)]">○</span>
                  ) : (
                    <span className="text-amber-600">⚠</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug text-[var(--ink)]">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                    {p.status === "willCreate"
                      ? "Will create"
                      : p.status === "alreadyExists"
                        ? "Already exists"
                        : "Invalid"}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan && plan.products.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-4">
          <h4 className="mb-2 text-sm font-semibold text-[var(--ink)]">Variant Matrix</h4>
          <div className="flex flex-wrap gap-2">
            {plan.products.map((p) => (
              <span
                key={p.index}
                className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  p.status === "willCreate"
                    ? "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]"
                    : p.status === "alreadyExists"
                      ? "border-[var(--line)] bg-[var(--mist)] text-[var(--ink-soft)]"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
