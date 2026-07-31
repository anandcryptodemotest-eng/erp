"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkflowTemplatesPanel } from "@erp/process-designer";
import { Shell } from "@/components/Shell";
import { getAccessToken, getProcessTenant, processApi } from "@/lib/api";

export default function PlatformWorkflowsPage() {
  const router = useRouter();
  const tenant = typeof window !== "undefined" ? getProcessTenant() : null;

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
    else if (!getProcessTenant()) router.replace("/process");
  }, [router]);

  const apiFn = useCallback(
    (path: string, options?: RequestInit) => processApi(path, options),
    []
  );

  return (
    <Shell>
      <div className="space-y-4 max-w-4xl">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/process" className="text-[var(--accent)] underline">
            Process Studio
          </Link>
          {tenant ? ` · ${tenant.name}` : null}
        </p>
        <WorkflowTemplatesPanel
          api={apiFn}
          detailHref={(id) => `/process/workflows/${id}`}
          LinkComponent={({ href, children, className }) => (
            <Link href={href} className={className}>
              {children}
            </Link>
          )}
        />
      </div>
    </Shell>
  );
}
