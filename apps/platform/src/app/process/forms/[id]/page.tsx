"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FormDesigner } from "@erp/process-forms";
import {
  bootstrapAdminRuntime,
  designerLayoutOptions,
  FormTaskSimulator,
  adminWidgetCatalog,
} from "@erp/admin-ui-host";
import { Shell } from "@/components/Shell";
import { getAccessToken, getProcessTenant, processApi, type ProcessTenantRef } from "@/lib/api";

export default function PlatformFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<ProcessTenantRef | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    const t = getProcessTenant();
    if (!t) {
      router.replace("/process");
      return;
    }
    setTenant(t);
    bootstrapAdminRuntime({ catalog: adminWidgetCatalog });
    setReady(true);
  }, [router]);

  const api = useCallback((path: string, options?: RequestInit) => processApi(path, options), []);
  const layoutWidgetOptions = useMemo(() => designerLayoutOptions(adminWidgetCatalog), []);

  if (!ready || !tenant) {
    return (
      <Shell>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-3 text-sm text-[var(--muted)]">{tenant.name}</div>
      <FormDesigner
        formRowId={id}
        api={api}
        formsHref="/process/forms"
        LinkComponent={({ href, children, className }) => (
          <Link href={href} className={className}>
            {children}
          </Link>
        )}
        onOpenForm={(newId) => router.push(`/process/forms/${newId}`)}
        layoutWidgetOptions={layoutWidgetOptions}
        previewSlot={({ definition, readOnly, onApplyRecommendedLayout }) => (
          <FormTaskSimulator
            screen={definition}
            mode={readOnly ? "published" : "draft"}
            onApplyRecommendedLayout={onApplyRecommendedLayout}
          />
        )}
      />
    </Shell>
  );
}
