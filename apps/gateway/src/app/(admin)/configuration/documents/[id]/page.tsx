"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, downloadAuthenticatedDocument } from "@/lib/admin-api";
import { Button, PageScaffold, StatusBadge } from "@erp/ui";
import type { DocumentDefinition } from "@erp/documents";
import { DocumentStudio, patchStudio, type SimulateFeed } from "@erp/document-designer";

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
  const [feed, setFeed] = useState<SimulateFeed>({ kind: "sample" });
  const [invoices, setInvoices] = useState<{ id: string; number: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const definitionRef = useRef<DocumentDefinition | null>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;

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

  useEffect(() => {
    void api<{ data: { id: string; number: string }[] }>(`/api/invoices?type=RECEIVABLE&limit=30`)
      .then((r) => setInvoices(r.data ?? []))
      .catch(() => setInvoices([]));
  }, []);

  const readOnly = row?.lifecycle !== "DRAFT";

  const runPreview = useCallback(
    async (def: DocumentDefinition) => {
      try {
        const r = await api<{ data: { html: string } }>(
          `/api/workflow-documents/${id}?action=preview`,
          {
            method: "POST",
            body: JSON.stringify({ definition: def, interactive: false, feed: feedRef.current }),
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

  useEffect(() => {
    const def = definitionRef.current;
    if (def) void runPreview(def);
  }, [feed, runPreview]);

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

  async function downloadPdf() {
    const def = definitionRef.current;
    if (!def) return;
    setBusy(true);
    setError(null);
    try {
      const stem = (def.name || "document").replace(/[^\w.-]+/g, "-");
      const suffix = feed.kind === "invoice" ? "live" : "sample";
      await downloadAuthenticatedDocument(
        `/api/workflow-documents/${id}?action=pdf`,
        `${stem}-${suffix}.pdf`,
        {
          body: JSON.stringify({ definition: def, feed: feedRef.current }),
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (!row || !definition) {
    return (
      <PageScaffold hero={{ title: "Document" }}>
        {error ? <p className="text-[var(--danger)]">{error}</p> : <p>Loading…</p>}
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      className="!max-w-none"
      hero={{
        title: row.name ?? row.documentId,
        description: `Document Studio · ${row.documentId} · v${row.version}`,
        badge: <StatusBadge status={row.lifecycle} />,
        actions: (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const def = definitionRef.current;
                if (def) onDefinitionChange(patchStudio(def, { tab: "preview" }));
              }}
            >
              Preview
            </Button>
            {readOnly ? (
              <Button type="button" disabled={busy} onClick={() => void cloneToDraft()}>
                Clone to draft
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
                  Save draft
                </Button>
                <Button type="button" disabled={busy} onClick={() => void publish()}>
                  Publish
                </Button>
              </>
            )}
          </div>
        ),
      }}
      ahead={
        <div className="mb-3 space-y-2">
          <Link href="/configuration/documents" className="text-xs text-[var(--brand)] underline">
            ← Documents
          </Link>
          {readOnly && (
            <p
              className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warning)_35%,var(--line))] bg-[color-mix(in_srgb,var(--warning)_10%,white)] px-4 py-2 text-sm text-[var(--warning)]"
              role="status"
            >
              View only — published versions are immutable. Clone to draft to edit this template.
            </p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </div>
      }
    >
      <div className="min-h-[calc(100vh-12rem)]">
        <DocumentStudio
          key={studioKey}
          definition={definition}
          readOnly={readOnly}
          previewHtml={previewHtml}
          feed={feed}
          invoices={invoices}
          onChange={onDefinitionChange}
          onFeedChange={setFeed}
          onSave={() => void save()}
          onPublish={() => void publish()}
          onDownloadPdf={() => void downloadPdf()}
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
    </PageScaffold>
  );
}
