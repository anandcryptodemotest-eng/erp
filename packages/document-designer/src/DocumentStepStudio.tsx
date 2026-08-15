"use client";

import type { BindingSchemaLeaf, DocumentBindingSchema, DocumentDefinition } from "@erp/documents";
import { listBindingLeaves, listCollectionLeaves } from "@erp/documents";
import { defaultAreaContainer, defaultItem, defaultPageNumberItem } from "./defaultItem";
import { GUIDED_STEPS, patchStudio } from "./studio-model";
import type { SimulateFeed } from "./types";
import { SimulateFeedToolbar, type SimulateInvoiceOption } from "./SimulateFeedToolbar";
import {
  addItemToDefinition,
  fieldFromSchemaLeaf,
  itemNames,
  nextPlacementY,
  notesTextItem,
  tableFromCollection,
  titleTextItem,
} from "./from-schema";

export { GUIDED_STEPS, patchStudio } from "./studio-model";

function scalarLeaves(schema: DocumentBindingSchema): BindingSchemaLeaf[] {
  return listBindingLeaves(schema).filter((f) => !f.collection);
}

function imageLeaf(schema: DocumentBindingSchema): BindingSchemaLeaf | undefined {
  return listBindingLeaves(schema).find(
    (f) => /logoUrl|imageUrl|image/i.test(f.path) || /logo|image/i.test(f.label)
  );
}

export function DocumentStepStudio({
  definition,
  schema,
  previewHtml,
  readOnly,
  feed,
  invoices,
  onChange,
  onPublish,
  onFeedChange,
  onFinishPreview,
}: {
  definition: DocumentDefinition;
  schema: DocumentBindingSchema;
  previewHtml: string;
  readOnly?: boolean;
  feed: SimulateFeed;
  invoices: SimulateInvoiceOption[];
  onChange: (def: DocumentDefinition) => void;
  onPublish?: () => void;
  onFeedChange?: (feed: SimulateFeed) => void;
  onFinishPreview?: () => void;
}) {
  const step = Math.min(GUIDED_STEPS.length - 1, Math.max(0, definition.studio?.step ?? 0));
  const collections = listCollectionLeaves(schema);
  const scalars = scalarLeaves(schema);
  const names = itemNames(definition);
  const setStep = (next: number) =>
    onChange(patchStudio(definition, { mode: "guided", step: next, tab: "design" }));

  const push = (item: ReturnType<typeof defaultItem>) => {
    if (readOnly) return;
    onChange(addItemToDefinition(definition, item));
  };

  const addBoundField = (leaf: BindingSchemaLeaf, area?: "header" | "footer") => {
    if (readOnly) return;
    push(
      fieldFromSchemaLeaf(leaf, {
        area,
        y: nextPlacementY(definition, area),
      })
    );
  };

  const page = definition.page;
  const margin = page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const img = imageLeaf(schema);

  return (
    <div className="erp-doc-studio__guided">
      <ol className="erp-doc-studio__steps">
        {GUIDED_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={i === step ? "erp-doc-studio__step-btn erp-doc-studio__step-btn--active" : "erp-doc-studio__step-btn"}
              onClick={() => setStep(i)}
            >
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="erp-doc-studio__guided-body">
        <div className="erp-doc-studio__guided-form">
          {step === 0 && (
            <>
              <h3>Page</h3>
              <p>Choose the paper. Bindings come later — this is only size and margins.</p>
              <label className="erp-doc-designer__field">
                Size
                <select
                  disabled={readOnly}
                  value={page.size}
                  onChange={(e) =>
                    onChange({
                      ...definition,
                      page: { ...page, size: e.target.value as "A4" | "Letter" },
                    })
                  }
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </label>
              <label className="erp-doc-designer__field">
                Orientation
                <select
                  disabled={readOnly}
                  value={page.orientation ?? "portrait"}
                  onChange={(e) =>
                    onChange({
                      ...definition,
                      page: { ...page, orientation: e.target.value as "portrait" | "landscape" },
                    })
                  }
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <label key={side} className="erp-doc-designer__field">
                  Margin {side}
                  <input
                    type="number"
                    disabled={readOnly}
                    value={margin[side]}
                    onChange={(e) =>
                      onChange({
                        ...definition,
                        page: { ...page, margin: { ...margin, [side]: Number(e.target.value) } },
                      })
                    }
                  />
                </label>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <h3>Header</h3>
              <p>A band at the top of every page: image, title, or a bound field.</p>
              {!readOnly && (
                <div className="erp-doc-studio__add-row">
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => push(defaultAreaContainer("header"))}
                  >
                    Header band
                  </button>
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() =>
                      push(
                        titleTextItem(definition.name || "Document", {
                          area: "header",
                          y: nextPlacementY(definition, "header"),
                        })
                      )
                    }
                  >
                    Title
                  </button>
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => {
                      const image = defaultItem("Image");
                      image.placement.area = "header";
                      image.placement.y = nextPlacementY(definition, "header");
                      if (img) image.binding = { path: img.path, fallback: "" };
                      push(image);
                    }}
                  >
                    Image
                  </button>
                </div>
              )}
              {scalars.slice(0, 4).length > 0 && (
                <>
                  <p className="erp-doc-studio__field-caption">Bind a header field</p>
                  <div className="erp-doc-studio__add-row">
                    {scalars.slice(0, 4).map((leaf) => (
                      <button
                        key={leaf.path}
                        type="button"
                        className="erp-doc-designer__palette-btn"
                        disabled={readOnly}
                        onClick={() => addBoundField(leaf, "header")}
                      >
                        {leaf.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h3>Content</h3>
              <p>Add blocks, then bind them to this document’s data. Names come from the schema, not from Studio.</p>
              {!readOnly && (
                <div className="erp-doc-studio__add-row">
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => {
                      const t = defaultItem("Text");
                      t.placement.y = nextPlacementY(definition);
                      push(t);
                    }}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => {
                      const c = defaultItem("Container");
                      c.placement.y = nextPlacementY(definition);
                      push(c);
                    }}
                  >
                    Container
                  </button>
                </div>
              )}
              <p className="erp-doc-studio__field-caption">Fields from data</p>
              <div className="erp-doc-studio__add-row">
                {scalars.map((leaf) => (
                  <button
                    key={leaf.path}
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    disabled={readOnly}
                    onClick={() => addBoundField(leaf)}
                  >
                    {leaf.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3>Collections</h3>
              <p>Tables repeat rows from a collection path on the payload.</p>
              {collections.length > 0 ? (
                <div className="erp-doc-studio__add-row">
                  {collections.map((leaf) => (
                    <button
                      key={leaf.path}
                      type="button"
                      className="erp-doc-designer__palette-btn"
                      disabled={readOnly}
                      onClick={() => push(tableFromCollection(leaf, nextPlacementY(definition)))}
                    >
                      {leaf.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="erp-doc-designer__palette-btn"
                  disabled={readOnly}
                  onClick={() => {
                    const t = defaultItem("Table");
                    t.placement.y = nextPlacementY(definition);
                    push(t);
                  }}
                >
                  Table
                </button>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h3>Summary</h3>
              <p>Amounts, notes, or any remaining scalar fields.</p>
              <div className="erp-doc-studio__add-row">
                {scalars
                  .filter((l) => /total|sum|amount|note/i.test(l.path) || /total|amount|note/i.test(l.label))
                  .concat(
                    scalars.filter(
                      (l) =>
                        !/total|sum|amount|note/i.test(l.path) && !/total|amount|note/i.test(l.label)
                    ).slice(-3)
                  )
                  .filter((leaf, i, arr) => arr.findIndex((x) => x.path === leaf.path) === i)
                  .slice(0, 6)
                  .map((leaf) => (
                    <button
                      key={leaf.path}
                      type="button"
                      className="erp-doc-designer__palette-btn"
                      disabled={readOnly}
                      onClick={() => addBoundField(leaf)}
                    >
                      {leaf.label}
                    </button>
                  ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h3>Footer</h3>
              <p>Notes, page number, or a closing field.</p>
              {!readOnly && (
                <div className="erp-doc-studio__add-row">
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => push(defaultAreaContainer("footer"))}
                  >
                    Footer band
                  </button>
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() =>
                      push(notesTextItem({ area: "footer", y: nextPlacementY(definition, "footer") }))
                    }
                  >
                    Notes
                  </button>
                  <button
                    type="button"
                    className="erp-doc-designer__palette-btn"
                    onClick={() => {
                      const p = defaultPageNumberItem();
                      p.placement.area = "footer";
                      p.placement.y = nextPlacementY(definition, "footer");
                      push(p);
                    }}
                  >
                    Page No.
                  </button>
                </div>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <h3>Preview</h3>
              <p>Check the rendered page with sample or live data, then publish.</p>
              {onFeedChange && (
                <SimulateFeedToolbar feed={feed} invoices={invoices} onChange={onFeedChange} />
              )}
              <div className="erp-doc-studio__add-row">
                {onFinishPreview && (
                  <button type="button" className="erp-doc-designer__palette-btn" onClick={onFinishPreview}>
                    Open Preview tab
                  </button>
                )}
                {!readOnly && onPublish && (
                  <button type="button" className="erp-doc-studio__publish" onClick={onPublish}>
                    Publish
                  </button>
                )}
              </div>
            </>
          )}

          {names.length > 0 && (
            <p className="erp-doc-studio__hint" style={{ paddingLeft: 0, marginTop: 12 }}>
              On the page: {names.slice(0, 8).join(" · ")}
              {names.length > 8 ? ` · +${names.length - 8}` : ""}
            </p>
          )}

          <div className="erp-doc-studio__nav">
            <button type="button" className="erp-doc-designer__palette-btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </button>
            {step < GUIDED_STEPS.length - 1 ? (
              <button type="button" className="erp-doc-designer__palette-btn" onClick={() => setStep(step + 1)}>
                Next
              </button>
            ) : (
              <button
                type="button"
                className="erp-doc-designer__palette-btn"
                onClick={() => onFinishPreview?.()}
              >
                Done
              </button>
            )}
          </div>
        </div>
        <iframe title="document-preview" className="erp-doc-designer__preview-frame" srcDoc={previewHtml} />
      </div>
    </div>
  );
}
