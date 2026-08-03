"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkflowFormsPanel } from "@erp/process-forms";
import { Shell } from "@/components/Shell";
import { getAccessToken, getProcessTenant, processApi } from "@/lib/api";

export default function PlatformFormsPage() {
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
        <WorkflowFormsPanel
          api={apiFn}
          detailHref={(id) => `/process/forms/${id}`}
          onOpenForm={(id) => router.push(`/process/forms/${id}`)}
          LinkComponent={({ href, children, className }) => (
            <Link href={href} className={className}>
              {children}
            </Link>
          )}
        />      </div>
    </Shell>
  );
}
