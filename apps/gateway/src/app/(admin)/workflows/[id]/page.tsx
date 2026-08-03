"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { WorkflowDesigner } from "@erp/process-designer";
import { api, getTenantId } from "@/lib/admin-api";

export default function WorkflowDesignerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  return (
    <WorkflowDesigner
      templateId={id}
      api={api}
      tenantId={getTenantId()}
      workflowsHref="/workflows"
      formsHref="/configuration/forms"
      LinkComponent={({ href, children, className }) => (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
      onOpenTemplate={(newId) => router.push(`/workflows/${newId}`)}
    />
  );
}
