"use client";

import { useMemo, useRef, useState } from "react";
import { AutoStudioShell, StudioProvider } from "@erp/ui";
import { ProgressiveSuggestionsProvider } from "./useProgressiveSuggestions";
import { createProductDomain, type CreatePlan } from "./ProductDomain";
import { ProductMetaProvider } from "./ProductMeta";
import { productStudioRegistry } from "./registry";
import { createProductFormSchema, defaultCreateProductValues } from "./schema";

/**
 * Product Studio — first consumer of the ERP Studio Framework.
 * Host injects AutoStudioShell (Desktop | Mobile renderer by breakpoint).
 */
export function ProductStudio({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState<CreatePlan | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  const domain = useMemo(
    () =>
      createProductDomain({
        getPlan: () => planRef.current,
        setPlan,
        onCreated: () => {
          onDone();
          onClose();
        },
      }),
    [onClose, onDone]
  );

  return (
    <StudioProvider
      schema={createProductFormSchema}
      defaultValues={defaultCreateProductValues}
      registry={productStudioRegistry}
      domain={domain}
    >
      <ProductMetaProvider plan={plan} setPlan={setPlan}>
        <ProgressiveSuggestionsProvider>
          <AutoStudioShell onClose={onClose} variant="page" />
        </ProgressiveSuggestionsProvider>
      </ProductMetaProvider>
    </StudioProvider>
  );
}

/** Stable mount name for products page. */
export { ProductStudio as CreateProductEditor };
