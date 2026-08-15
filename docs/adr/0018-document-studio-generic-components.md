# ADR 0018: Document Studio is industry-neutral

**Status:** Approved  
**Date:** 2026-08-14  
**Gate level:** L1 / L2 (Documents capability — catalog semantics)  
**Depends on:** ADR 0001 (AssetRef), ADR 0006 (metadata lifecycle)

## Context

Document Studio must serve any business document (ERP invoice, school receipt, hospital bill, delivery note) without forking the designer per industry. Encoding Seller, Buyer, Invoice, Student, or GST into the component catalog would make the Studio an ERP invoice tool.

## Decision

**Document Studio must not encode industry or document-type semantics into its component catalog. Components are generic presentation primitives. Business semantics enter exclusively through the document payload and data bindings.**

```text
ANY INDUSTRY
     │
Business payload
     ▼
Document template (generic primitives + bindings + layout)
     ▼
HTML / PDF
```

Studio owns: layout, presentation, components, bindings, typography, spacing, tables, images, preview, publishing.

Studio does **not** own: invoice, seller, buyer, student, patient, supplier, GST, sales order, purchase order.

The same UX (Design | Data | Preview | Publish) works for every domain. Only `bindingSchemaForDocumentType` / `payloadBuilder` change.

Reusable compositions (e.g. `doc.seller`, `doc.lineItems` from BL-026) are an **optional invoice starter pack**, not the primary palette.

## Consequences

- Primary palette is generic (BL-028 Business catalog: Text, Field, Image, Table, Container, Box, Line, Header, Footer, Page No.). QR is Power+, not Business.
- BindingPicker shows whatever schema the document type provides (ERP invoice may still use `seller` / `lines` / `totals`).
- New industries add a payload schema, not new Studio components.
- Guided setup steps are generic (Page, Header, Content, Collections, Summary, Footer, Preview), not Logo → Seller → Buyer.

## Addendum (2026-08-14) — BL-028 chrome levels

`definition.studio.level` is `"business" | "power" | "developer"` (default `business`). It is editor chrome only.

`renderDocument()` / `renderDocumentHtml()` see `DocumentDefinition` + payload and ignore `studio.level`, `studio.tab`, `studio.step`, and `studio.mode`.

Business is the default working experience, not a limited editor. Switching Business → Power → Developer does not change the template.

Business catalog: Text, Field, Image, Table, Container, Box, Line, Header, Footer, Page No. QR and the invoice starter pack are Power+. JSON and technical properties are Developer.

Sankalp Document Studio is a general-purpose business document designer. ERP invoice is only the first payload / use case.

## Related

- BL-026 print-widget compositions (`packages/documents/src/print-widgets.ts`)
- BL-027 Generic Document Studio UX
- BL-028 Business-first Studio chrome
