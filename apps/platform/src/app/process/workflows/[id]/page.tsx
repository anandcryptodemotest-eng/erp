"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getAccessToken, getProcessTenant, processApi } from "@/lib/api";

type Row = {
  id: string;
  name: string | null;
  templateCode: string;
  version: number;
  lifecycle: string;
  definition: unknown;
};

export default function PlatformWorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tenant = typeof window !== "undefined" ? getProcessTenant() : null;

  const load = useCallback(async () => {
    try {
      const r = await processApi<{ data: Row }>(`/api/workflow-templates/${id}`);
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

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await processApi(`/api/workflow-templates/${id}/publish`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-4 max-w-4xl">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/process/workflows" className="text-[var(--accent)] underline">
            Workflows
          </Link>
          {tenant ? ` · ${tenant.name}` : null}
        </p>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        {!row ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{row.name || row.templateCode}</h2>
                <p className="font-mono text-sm text-[var(--muted)]">
                  {row.templateCode} · v{row.version} · {row.lifecycle}
                </p>
              </div>
              {row.lifecycle === "DRAFT" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void publish()}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Publishing…" : "Publish"}
                </button>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">
              Visual graph editing remains in the shared designer package evolution; platform operators
              can seed, clone, and publish here. Full canvas editing is available to tenants when
              Process Studio capability is enabled.
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
