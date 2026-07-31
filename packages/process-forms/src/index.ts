"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

export type ProcessApi = (
  path: string,
  options?: RequestInit
) => Promise<{ data?: unknown; [k: string]: unknown }>;

type FormRow = {
  id: string;
  formId: string;
  version: number;
  lifecycle: string;
  name: string | null;
};

type Props = {
  api: ProcessApi;
  detailHref: (id: string) => string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
};

export function WorkflowFormsPanel({ api, detailHref, LinkComponent }: Props) {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/api/workflow-forms");
      setRows((r.data as FormRow[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Forms</h2>
      <p className="text-sm text-[var(--muted)]">Form catalog for workflow tasks.</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <LinkComponent href={detailHref(row.id)} className="font-semibold hover:underline">
                  {row.name || row.formId}
                </LinkComponent>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {row.formId} · v{row.version} · {row.lifecycle}
                </p>
              </div>
              <LinkComponent
                href={detailHref(row.id)}
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
              >
                Open
              </LinkComponent>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-6 text-sm text-[var(--muted)]">No forms for this tenant.</li>
          )}
        </ul>
      )}
    </div>
  );
}
