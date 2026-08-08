"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/admin-api";
import { PageHeader, StatusBadge } from "@erp/ui";
import type { DocumentDefinition } from "@erp/documents";
import { DocumentDesigner } from "@erp/document-designer";

type DocRow = {
  id: string;
  documentId: string;
  version: number;
  lifecycle: string;
  name: string | null;
  documentType: string;
  definition: DocumentDefinition;
};

export default function DocumentStudioPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [row, setRow] = useState<DocRow | null>(null);
  const [definition, setDefinition] = useState<DocumentDefinition | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const definitionRef = useRef<DocumentDefinition | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`);
      setRow(r.data);
      setDefinition(r.data.definition);
      definitionRef.current = r.data.definition;
      setStudioKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = row?.lifecycle !== "DRAFT";

  const runPreview = useCallback(
    async (def: DocumentDefinition) => {
      try {
        const r = await api<{ data: { html: string } }>(
          `/api/workflow-documents/${id}?action=preview`,
          {
            method: "POST",
            body: JSON.stringify({ definition: def, interactive: false }),
          }
        );
        setPreviewHtml(r.data?.html ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preview failed");
      }
    },
    [id]
  );

  const onDefinitionChange = useCallback(
    (def: DocumentDefinition) => {
      definitionRef.current = def;
      setDefinition(def);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void runPreview(def), 400);
    },
    [runPreview]
  );

  useEffect(() => {
    if (definition) void runPreview(definition);
  }, [studioKey]); // eslint-disable-line react-hooks/exhaustive-deps -- preview on load only

  async function save() {
    const def = definitionRef.current;
    if (!def || readOnly) return;
    setBusy(true);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ definition: def, name: def.name }),
      });
      setRow(r.data);
      setDefinition(r.data.definition);
      definitionRef.current = r.data.definition;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "publish" }),
      });
      setRow(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function cloneToDraft() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "clone-to-draft" }),
      });
      if (r.data?.id) router.push(`/configuration/documents/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone to draft failed");
    } finally {
      setBusy(false);
    }
  }

  if (!row || !definition) {
    return (
      <div className="p-4 md:p-8">
        {error ? <p className="text-red-600">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-3">
        <div>
          <Link href="/configuration/documents" className="text-xs text-emerald-800 underline">
            ← Documents
          </Link>
          <PageHeader title={row.name ?? row.documentId} />
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ink-soft)]">
            <span>
              {row.documentId} · v{row.version}
            </span>
            <StatusBadge status={row.lifecycle} />
          </div>
        </div>
        <div className="flex gap-2">
          {readOnly ? (
            <button
              type="button"
              className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white"
              disabled={busy}
              onClick={() => void cloneToDraft()}
            >
              Clone to draft
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                disabled={busy}
                onClick={() => void save()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white"
                disabled={busy}
                onClick={() => void publish()}
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>
      {readOnly && (
        <p className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
          View only — published versions are immutable. Clone to draft to edit this template.
        </p>
      )}
      {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
      <div className="min-h-0 flex-1">
        <DocumentDesigner
          key={studioKey}
          definition={definition}
          readOnly={readOnly}
          previewHtml={previewHtml}
          onChange={onDefinitionChange}
          onUploadImage={async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            const r = await api<{ data: { url: string } }>("/api/uploads/attachment", {
              method: "POST",
              body: fd,
            });
            if (!r.data?.url) throw new Error("Upload returned no URL");
            return r.data.url;
          }}
        />
      </div>
    </div>
  );
}
