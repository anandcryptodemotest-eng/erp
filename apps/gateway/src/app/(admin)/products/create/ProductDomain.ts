import type { StudioDomain, WorkflowValidationResult } from "@erp/ui";
import { api, getTenantId } from "@/lib/admin-api";
import type { CreateProductForm } from "./schema";
import { buildCreatePayload } from "./payload";

export type CreatePlan = {
  total: number;
  create: number;
  skip: number;
  invalid: number;
  warnings: string[];
  products: {
    index: number;
    status: "willCreate" | "alreadyExists" | "invalid";
    sku: string;
    name: string;
    unitPrice: number | null;
  }[];
};

function draftKey() {
  return `create-product-studio-draft:${getTenantId() || "default"}`;
}

export type ProductDomainOptions = {
  getPlan: () => CreatePlan | null;
  setPlan: (plan: CreatePlan | null) => void;
  onCreated: () => void;
};

export function createProductDomain(opts: ProductDomainOptions): StudioDomain<CreateProductForm> {
  return {
    async saveDraft(values) {
      const savedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      sessionStorage.setItem(draftKey(), JSON.stringify({ ...values, savedAt }));
    },
    async restoreDraft() {
      try {
        const raw = sessionStorage.getItem(draftKey());
        if (!raw) return null;
        return JSON.parse(raw) as Partial<CreateProductForm>;
      } catch {
        return null;
      }
    },
    async preview(values) {
      if (!values.categoryId || !Object.values(values.selected ?? {}).some((v) => v.length)) {
        opts.setPlan(null);
        return null;
      }
      const r = await api("/api/products/preview", {
        method: "POST",
        body: JSON.stringify(buildCreatePayload(values)),
      });
      const plan = (r.data as CreatePlan) ?? null;
      opts.setPlan(plan);
      return plan;
    },
    validateWorkflow(values): WorkflowValidationResult {
      const plan = opts.getPlan();
      if (!values.categoryId) {
        return { ok: false, errors: [{ id: "category", message: "Category required" }] };
      }
      if (!plan || plan.create <= 0) {
        return {
          ok: false,
          errors: [{ id: "plan", message: "No products to create — check configuration" }],
        };
      }
      if (plan.invalid > 0) {
        return {
          ok: false,
          errors: [{ id: "invalid", message: `${plan.invalid} invalid product(s)` }],
        };
      }
      return { ok: true };
    },
    async submit(values) {
      const plan = opts.getPlan();
      if (!plan || plan.create === 0) throw new Error("Nothing to create");
      const body = buildCreatePayload(values);
      const r = await api("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const createdRows = (r.data?.created ?? []) as { id: string }[];
      const opening = body.openingStock != null ? Number(body.openingStock) : 0;
      if (opening > 0 && createdRows.length > 0) {
        try {
          const list = await api("/api/warehouses?limit=20");
          let warehouseId = ((list.data ?? []) as { id: string }[])[0]?.id;
          if (!warehouseId) {
            const created = await api("/api/warehouses", {
              method: "POST",
              body: JSON.stringify({ name: "Main Warehouse", location: "Primary" }),
            });
            warehouseId = created.data?.id as string;
          }
          if (warehouseId) {
            await api("/api/stock/receive", {
              method: "POST",
              body: JSON.stringify({
                items: createdRows.map((p) => ({
                  productId: p.id,
                  warehouseId,
                  quantity: opening,
                })),
                reference: "INITIAL",
              }),
            });
          }
        } catch (e) {
          console.warn("Opening stock receive failed", e);
        }
      }
      try {
        sessionStorage.removeItem(draftKey());
      } catch {
        /* ignore */
      }
      opts.onCreated();
    },
  };
}
