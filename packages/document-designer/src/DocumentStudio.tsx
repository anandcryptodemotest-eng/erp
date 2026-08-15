"use client";

import { useMemo } from "react";
import type { DocumentBindingSchema, DocumentDefinition } from "@erp/documents";
import { bindingSchemaForDocumentType, listBindingLeaves } from "@erp/documents";
import { DocumentDesigner } from "./DocumentDesigner";
import { DocumentStepStudio } from "./DocumentStepStudio";
import { GUIDED_STEPS, STUDIO_LEVELS, patchStudio, studioLevel } from "./studio-model";
import { BindingPicker } from "./BindingPicker";
import { SimulateFeedToolbar, type SimulateInvoiceOption } from "./SimulateFeedToolbar";
import { addItemToDefinition, fieldFromSchemaLeaf, nextPlacementY, tableFromCollection } from "./from-schema";
import type { SimulateFeed } from "./types";
import "./document-designer.css";

export type StudioTab = "design" | "data" | "preview" | "publish";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "data", label: "Data" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

export type DocumentStudioProps = {
  definition: DocumentDefinition;
  previewHtml?: string;
  readOnly?: boolean;
  bindingSchema?: DocumentBindingSchema;
  feed: SimulateFeed;
  invoices?: SimulateInvoiceOption[];
  onChange?: (definition: DocumentDefinition) => void;
  onFeedChange?: (feed: SimulateFeed) => void;
  onSave?: () => void;
  onPublish?: () => void;
  onDownloadPdf?: () => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  className?: string;
};

export function DocumentStudio({
  definition,
  previewHtml = "",
  readOnly = false,
  bindingSchema,
  feed,
  invoices = [],
  onChange,
  onFeedChange,
  onSave,
  onPublish,
  onDownloadPdf,
  onUploadImage,
  className,
}: DocumentStudioProps) {
  const schema = bindingSchema ?? bindingSchemaForDocumentType(definition.documentType);
  const tab: StudioTab = definition.studio?.tab ?? "design";
  const guided = definition.studio?.mode === "guided";
  const level = studioLevel(definition);
  const leaves = useMemo(() => listBindingLeaves(schema), [schema]);

  const setTab = (next: StudioTab) => {
    onChange?.(patchStudio(definition, { tab: next }));
  };

  const startGuided = () =>
    onChange?.(patchStudio(definition, { mode: "guided", step: 0, tab: "design" }));
  const exitGuided = () => onChange?.(patchStudio(definition, { mode: "design", tab: "design" }));

  return (
    <div className={`erp-doc-studio${className ? ` ${className}` : ""}`}>
      <header className="erp-doc-studio__chrome">
        <div className="erp-doc-studio__brand">
          <p className="erp-doc-studio__eyebrow">Print template</p>
          <h2 className="erp-doc-studio__title">{definition.name || "Document Studio"}</h2>
        </div>
        <div className="erp-doc-studio__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "erp-doc-studio__tab erp-doc-studio__tab--active" : "erp-doc-studio__tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="erp-doc-studio__levels">
          {STUDIO_LEVELS.map((lv) => (
            <button
              key={lv.id}
              type="button"
              className={
                level === lv.id
                  ? "erp-doc-studio__pill erp-doc-studio__pill--active"
                  : "erp-doc-studio__pill"
              }
              onClick={() => onChange?.(patchStudio(definition, { level: lv.id }))}
            >
              {lv.label}
            </button>
          ))}
        </span>
        {tab === "design" && !readOnly && (
          <button
            type="button"
            className="erp-doc-studio__tab-aux"
            onClick={guided ? exitGuided : startGuided}
          >
            {guided ? "Freeform canvas" : "Guided setup"}
          </button>
        )}
      </header>

      {tab === "design" && guided && (
        <DocumentStepStudio
          definition={definition}
          schema={schema}
          previewHtml={previewHtml}
          readOnly={readOnly}
          feed={feed}
          invoices={invoices}
          onChange={(d) => onChange?.({ ...d, studio: { ...definition.studio, ...d.studio } })}
          onPublish={onPublish}
          onFeedChange={onFeedChange}
          onFinishPreview={() => onChange?.(patchStudio(definition, { mode: "design", tab: "preview" }))}
        />
      )}

      {tab === "design" && !guided && (
        <DocumentDesigner
          definition={definition}
          readOnly={readOnly}
          bindingSchema={schema}
          level={level}
          onChange={(def) => onChange?.({ ...def, studio: definition.studio })}
          onUploadImage={onUploadImage}
        />
      )}

      {tab === "data" && (
        <div className="erp-doc-studio__data">
          <p className="erp-doc-studio__lede">
            Paths belong to this document’s payload. Click a row to place a bound field or table on
            the page, then return to Design.
          </p>
          <table className="erp-doc-studio__schema-table">
            <thead>
              <tr>
                <th>Friendly name</th>
                <th>Path</th>
                <th>Kind</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((f) => (
                <tr key={f.path}>
                  <td>{f.label}</td>
                  <td>
                    <code>{f.path}</code>
                  </td>
                  <td>{f.collection ? "collection" : f.formatter || "text"}</td>
                  <td>
                    {!readOnly && (
                      <button
                        type="button"
                        className="erp-doc-designer__palette-btn"
                        onClick={() => {
                          const item = f.collection
                            ? tableFromCollection(f, nextPlacementY(definition))
                            : fieldFromSchemaLeaf(f, { y: nextPlacementY(definition) });
                          onChange?.(
                            patchStudio(addItemToDefinition(definition, item), { tab: "design" })
                          );
                        }}
                      >
                        Add to page
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {level === "developer" && (
            <BindingPicker
              schema={schema}
              readOnly
              onSelect={() => undefined}
              onFormatterChange={() => undefined}
            />
          )}
        </div>
      )}

      {tab === "preview" && (
        <div className="erp-doc-studio__preview">
          <div className="erp-doc-studio__preview-bar">
            {onFeedChange && <SimulateFeedToolbar feed={feed} invoices={invoices} onChange={onFeedChange} />}
            {onDownloadPdf && (
              <button type="button" className="erp-doc-studio__download" onClick={() => void onDownloadPdf()}>
                Download PDF
              </button>
            )}
          </div>
          <p className="erp-doc-studio__hint" style={{ paddingLeft: 0 }}>
            Preview and download use the selected feed (Sample payload by default).
          </p>
          <iframe title="document-preview" className="erp-doc-designer__preview-frame" srcDoc={previewHtml} />
        </div>
      )}

      {tab === "publish" && (
        <div className="erp-doc-studio__publish-panel">
          <h3>Publish</h3>
          <p>
            Publishing makes this version immutable. Runtime generate uses the published snapshot.
            Drafts never execute.
          </p>
          {onSave && !readOnly && (
            <button type="button" className="erp-doc-designer__palette-btn" onClick={onSave}>
              Save draft
            </button>
          )}
          {onPublish && !readOnly && (
            <button type="button" className="erp-doc-studio__publish" onClick={onPublish}>
              Publish
            </button>
          )}
          {readOnly && <p>This version is already published. Clone to draft to edit.</p>}
        </div>
      )}

      {tab === "design" && guided && (
        <p className="erp-doc-studio__hint">
          Guided: {GUIDED_STEPS[Math.min(GUIDED_STEPS.length - 1, definition.studio?.step ?? 0)]?.label}
        </p>
      )}
    </div>
  );
}
