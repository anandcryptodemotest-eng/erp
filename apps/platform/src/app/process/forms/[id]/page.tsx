"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getAccessToken, getProcessTenant, processApi } from "@/lib/api";

type Row = {
  id: string;
  name: string | null;
  formId: string;
  version: number;
  lifecycle: string;
  definition: unknown;
};

export default function PlatformFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await processApi<{ data: Row }>(`/api/workflow-forms/${id}`);
      setRow(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [id]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (!getProcessTenant()) {
      router.replace("/process");
      return;
    }
    void load();
  }, [router, load]);

  return (
    <Shell>
      <div className="space-y-4 max-w-4xl">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/process/forms" className="text-[var(--accent)] underline">
            Forms
          </Link>
        </p>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        {!row ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold">{row.name || row.formId}</h2>
            <p className="font-mono text-sm text-[var(--muted)]">
              {row.formId} · v{row.version} · {row.lifecycle}
            </p>
            <pre className="overflow-auto rounded-xl border border-[var(--line)] bg-black/30 p-4 text-xs max-h-[480px]">
              {JSON.stringify(row.definition, null, 2)}
            </pre>
          </>
        )}
      </div>
    </Shell>
  );
}
