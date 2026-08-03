"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

export type ProcessApi = (
  path: string,
  options?: RequestInit
) => Promise<{ data?: unknown; error?: string; [k: string]: unknown }>;

export type TemplateRow = {
  id: string;
  templateCode: string;
  version: number;
  lifecycle: string;
  name: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

type Props = {
  api: ProcessApi;
  /** Base path for designer links, e.g. `/workflows` or `/process/workflows` */
  detailHref: (id: string) => string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
};

export function WorkflowTemplatesPanel({ api, detailHref, LinkComponent }: Props) {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/api/workflow-templates");
      setRows((r.data as TemplateRow[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clone(sourceId: string) {
    setBusy(sourceId);
    try {
      await api("/api/workflow-templates", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(null);
    }
  }

  async function restoreStarter() {
    setBusy("seed");
    setError(null);
    try {
      await api("/api/workflow-templates", {
        method: "POST",
        body: JSON.stringify({ action: "seed" }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Workflow templates</h2>
          <p className="text-sm text-[var(--muted)]">
            Published templates are read-only. Clone a draft to edit, then publish.
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "seed"}
          onClick={() => void restoreStarter()}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === "seed" ? "Seeding…" : "Restore starter"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <LinkComponent href={detailHref(row.id)} className="font-semibold hover:underline">
                  {row.name || row.templateCode}
                </LinkComponent>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {row.templateCode} · v{row.version} · {row.lifecycle}
                </p>
              </div>
              <div className="flex gap-2">
                <LinkComponent
                  href={detailHref(row.id)}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                >
                  Open
                </LinkComponent>
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void clone(row.id)}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Clone draft
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-6 text-sm text-[var(--muted)]">No templates yet — restore starter.</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ProcessStudioHub(props: {
  workflowsHref: string;
  formsHref: string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
}) {
  const { LinkComponent, workflowsHref, formsHref } = props;
  const cards = [
    { href: workflowsHref, title: "Workflows", body: "Design and publish order workflows" },
    { href: formsHref, title: "Forms", body: "Task and capture forms used by workflows" },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Process Studio</h2>
      <p className="text-sm text-[var(--muted)]">
        Configure how work runs for the selected tenant. Draft → Validate → Publish.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <LinkComponent
            key={c.href}
            href={c.href}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]"
          >
            <div className="font-semibold">{c.title}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{c.body}</div>
          </LinkComponent>
        ))}
      </div>
    </div>
  );
}

export {
  WorkflowDesigner,
  type WorkflowDesignerProps,
  type WorkflowDesignerApi,
} from "./WorkflowDesigner";
