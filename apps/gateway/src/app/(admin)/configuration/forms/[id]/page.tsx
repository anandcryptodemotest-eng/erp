"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormDesigner } from "@erp/process-forms";
import {
  bootstrapAdminRuntime,
  designerLayoutOptions,
  FormTaskSimulator,
  adminWidgetCatalog,
} from "@erp/admin-ui-host";
import { api } from "@/lib/admin-api";

export default function FormDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    bootstrapAdminRuntime({ catalog: adminWidgetCatalog });
  }, []);

  const apiFn = useCallback((path: string, options?: RequestInit) => api(path, options), []);

  const layoutWidgetOptions = useMemo(() => designerLayoutOptions(adminWidgetCatalog), []);

  return (
    <FormDesigner
      formRowId={id}
      api={apiFn}
      formsHref="/configuration/forms"
      LinkComponent={({ href, children, className }) => (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
      onOpenForm={(newId) => router.push(`/configuration/forms/${newId}`)}
      layoutWidgetOptions={layoutWidgetOptions}
      previewSlot={({ definition, readOnly, onApplyRecommendedLayout }) => (
        <FormTaskSimulator
          screen={definition}
          mode={readOnly ? "published" : "draft"}
          onApplyRecommendedLayout={onApplyRecommendedLayout}
        />
      )}
    />
  );
}
