"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkflowDesigner } from "@erp/process-designer";
import { Shell } from "@/components/Shell";
import {
  getAccessToken,
  getProcessTenant,
  processApi,
  type ProcessTenantRef,
} from "@/lib/api";

export default function PlatformWorkflowDetailPage() {
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
    setReady(true);
  }, [router]);

  const api = useCallback(
    (path: string, options?: RequestInit) => processApi(path, options),
    []
  );

  if (!ready || !tenant) {
    return (
      <Shell>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-2 mb-3">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/process/workflows" className="text-[var(--accent)] underline">
            Workflows
          </Link>
          {` · ${tenant.name}`}
        </p>
      </div>
      <WorkflowDesigner
        templateId={id}
        api={api}
        tenantId={tenant.id}
        workflowsHref="/process/workflows"
        formsHref="/process/forms"
        LinkComponent={({ href, children, className }) => (
          <Link href={href} className={className}>
            {children}
          </Link>
        )}
        onOpenTemplate={(newId) => router.push(`/process/workflows/${newId}`)}
      />
    </Shell>
  );
}
