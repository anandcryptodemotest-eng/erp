"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import {
  api,
  getAccessToken,
  getProcessTenant,
  type ProcessTenantRef,
} from "@/lib/api";
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

export default function PlatformDocumentStudioPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [tenant, setTenant] = useState<ProcessTenantRef | null>(null);
  const [row, setRow] = useState<DocRow | null>(null);
  const [definition, setDefinition] = useState<DocumentDefinition | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const definitionRef = useRef<DocumentDefinition | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    const t = getProcessTenant();
    if (!t?.id) {
      setError("Select a source tenant on the Documents list first.");
      return;
    }
    setTenant(t);
  }, [router]);

  const load = useCallback(async () => {
    const t = getProcessTenant();
    if (!t?.id || !id) return;
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        headers: { "x-tenant-id": t.id },
      });
      setRow(r.data);
      setDefinition(r.data.definition);
      definitionRef.current = r.data.definition;
      setStudioKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [id]);

  useEffect(() => {
    if (tenant?.id) void load();
  }, [tenant, load]);

  const readOnly = row?.lifecycle !== "DRAFT";

  const runPreview = useCallback(
    async (def: DocumentDefinition) => {
      const t = getProcessTenant();
      if (!t?.id) return;
      try {
        const r = await api<{ data: { html: string } }>(
          `/api/workflow-documents/${id}?action=preview`,
          {
            method: "POST",
            headers: { "x-tenant-id": t.id },
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
    const t = getProcessTenant();
    const def = definitionRef.current;
    if (!t?.id || !def || readOnly) return;
    setBusy(true);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        headers: { "x-tenant-id": t.id },
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
    const t = getProcessTenant();
    if (!t?.id) return;
    setBusy(true);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        headers: { "x-tenant-id": t.id },
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
    const t = getProcessTenant();
    if (!t?.id || !id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: DocRow }>(`/api/workflow-documents/${id}`, {
        method: "PATCH",
        headers: { "x-tenant-id": t.id },
        body: JSON.stringify({ action: "clone-to-draft" }),
      });
      if (r.data?.id) router.push(`/process/documents/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone to draft failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-3">
          <div>
            <Link href="/process/documents" className="text-xs text-emerald-800 underline">
              ← Documents
            </Link>
            <h1 className="text-lg font-semibold">{row?.name ?? row?.documentId ?? "Document"}</h1>
            <p className="text-xs text-stone-500">
              {tenant ? `${tenant.name} · ` : ""}
              {row ? `${row.documentId} · v${row.version} · ${row.lifecycle}` : "Loading…"}
            </p>
          </div>
          <div className="flex gap-2">
            {readOnly ? (
              <button
                type="button"
                className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
                disabled={busy || !row}
                onClick={() => void cloneToDraft()}
              >
                Clone to draft
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-xs font-semibold"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
                  disabled={busy}
                  onClick={() => void publish()}
                >
                  Publish
                </button>
              </>
            )}
          </div>
        </div>
        {readOnly && row && (
          <p className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
            View only — published versions are immutable. Clone to draft (same tenant) to edit. Assign
            is a separate flow for copying to another tenant.
          </p>
        )}
        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
        {!row || !definition ? (
          <p className="p-6 text-sm text-stone-500">Loading template…</p>
        ) : (
          <div className="min-h-0 flex-1">
            <DocumentDesigner
              key={studioKey}
              definition={definition}
              readOnly={readOnly}
              previewHtml={previewHtml}
              onChange={onDefinitionChange}
              onUploadImage={async (file) => {
                const t = getProcessTenant();
                if (!t?.id) throw new Error("Select a tenant first");
                const fd = new FormData();
                fd.append("file", file);
                const r = await api<{ data: { url: string } }>("/api/uploads/attachment", {
                  method: "POST",
                  headers: { "x-tenant-id": t.id },
                  body: fd,
                });
                if (!r.data?.url) throw new Error("Upload returned no URL");
                return r.data.url;
              }}
            />
          </div>
        )}
      </div>
    </Shell>
  );
}
