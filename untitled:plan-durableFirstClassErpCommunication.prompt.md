## Plan: Durable First-Class ERP Communication

Make Communication a durable ERP platform capability with clear ownership, tenant isolation, secure media storage, predictable data lifecycle, and a path to scale without prematurely creating another microservice. Keep v1 in Gateway, but make the API, events, Asset references, and storage adapter boundaries extraction-ready.

**Target architecture**
- Gateway hosts Communication APIs and Prisma models in v1; portals and ERP modules consume the contract, never the Prisma schema.
- PostgreSQL stores conversations, participants, message metadata/text, reactions, read receipts, presence, delivery state, audit records, retention holds, and outbox events.
- Object storage stores binary content: images, voice, files, video, thumbnails, and exports. Use local disk only for development; use MinIO or S3-compatible storage for deployment.
- `Asset` is the shared platform metadata record. `MessageAttachment` stores an immutable `AssetRef { type, id, version }`, never a storage path or public URL as the source of truth.
- A storage adapter hides local/MinIO/S3 implementations. A signed/authenticated download endpoint resolves asset ownership and conversation membership before serving content.
- Communication publishes durable outbox events after successful database transactions. SSE, notifications, search, analytics, and future workers consume events without coupling to route handlers.
- An explicit `ConversationContext` links discussions to ERP objects such as customers, sales orders, purchase orders, deliveries, invoices, projects, tickets, employees, and workflow tasks. The existing `contextModule/contextEntity/contextId` fields remain the compatibility representation.
- An event bus is the integration boundary after the transactional outbox: Communication publishes once, while Notifications, Search, Analytics, Audit, AI, and future capabilities subscribe independently.
- All records and events are tenant-scoped. Cross-service participant references remain IDs plus participant type; no cross-service Prisma relations.

**Steps**

### Phase 0: Architecture and invariants
1. Confirm ownership in `docs/adr/0017-communication-platform-capability.md`: Communication owns conversations/messages; Asset owns file metadata; Notification owns delivery; Search owns indexing; portals are clients.
2. Write a communication/storage capability guide defining invariants: every business row has `tenantId`, every query starts with tenant scope, every message access requires active membership, every asset download requires tenant plus asset authorization, and no external WhatsApp integration.
3. Define canonical lifecycle states and API contracts in `packages/communication` and `packages/asset` before changing routes.
4. Establish operational targets: default message retention, maximum attachment sizes by type, tenant quota, SSE connection limit, message rate limits, backup RPO/RTO, and audit retention. Recommended defaults: 5-year message metadata retention unless tenant policy says otherwise, 25 MB general attachment limit, 100 MB video limit when enabled, 30-day trash grace period, and 30-day object recovery window.
5. Define `ConversationContext` as a shared contract with `module`, `entity`, `entityId`, display label, and authorization resolver. Context must be informational only unless the owning module confirms that the caller can access the referenced ERP object.

### Phase 1: Data model foundation and migration
1. Audit and preserve existing `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `MessageReaction`, `MessageReadReceipt`, `Presence`, `ConversationSummary`, and `Asset` data in `apps/gateway/prisma/schema.prisma`.
2. Add or verify tenant fields and indexes on every communication-owned business table. Add compound indexes for conversation timelines, unread queries, participant lookup, asset state, outbox delivery, and retention scans.
3. Normalize persisted enum-like values as application constants with compatibility for legacy `USER`, `TEAM`, and `ROLE` participants; do not break existing conversations.
4. Promote the existing context fields to an explicit `ConversationContext` application contract. Add a normalized context index and optional context display snapshot so ERP screens can reliably offer `Open Discussion` without querying the owning service during every render.
5. Evolve `Asset` with lifecycle metadata: `status` (`PENDING`, `READY`, `QUARANTINED`, `DELETED`, `PURGED`), checksum, storage key, storage provider, version, encryption/key reference if needed, retention/delete timestamps, scan status, and uploaded-by identity. Keep internal storage paths out of client responses.
6. Add an explicit asset ownership/reference model or a safe reference-count strategy so an asset is not deleted while referenced by a message, document, product, or workflow. Prefer an `AssetLink` table with `assetId`, `ownerType`, `ownerId`, `tenantId`, and purpose over relying only on JSON references.
7. Add `ConversationPolicy` with tenant-scoped policy data for visibility, allowed participant types, send/edit/delete/close permissions, retention override, export rules, and context-specific authorization. Policies supplement role permissions; they do not bypass tenant or membership checks.
8. Add extensible message plugin fields such as `pluginType` and validated `pluginPayload` JSON, or an equivalent typed event payload, for `WORKFLOW`, `DOCUMENT`, `APPROVAL`, and future ERP-native messages. Keep `type` for broad rendering categories and validate plugin payloads by registered schema.
9. Add `CommunicationOutboxEvent`, `CommunicationAuditLog`, and tenant retention-policy records. Add idempotency keys for message creation and upload finalization.
10. Add broadcast entities only after the core lifecycle is stable: `Broadcast`, `BroadcastRecipient`, consent/opt-out state, delivery attempts, and scheduling fields. Broadcasts are not oversized groups.
11. Generate additive Prisma migrations, backfill asset records for existing attachment files where possible, and retain a legacy URL/path adapter until migration verification is complete.

### Phase 2: Asset and binary storage service
1. Create a shared storage service boundary, for example `packages/asset/src/storage.ts` plus Gateway implementation wiring. Define `put`, `head`, `getStream`, `delete`, `copy`, `createDownloadUrl`, and `createUploadUrl` operations.
2. Implement adapters in this order: local filesystem for development/tests, MinIO/S3-compatible adapter for staging and self-hosted production, and an optional cloud S3 adapter without changing callers.
3. Replace direct `writeFile` usage in `apps/gateway/src/app/api/uploads/attachment/route.ts` with an upload session: authenticate, validate tenant/quota/MIME/size, stream to quarantine, calculate checksum, create `Asset(PENDING)`, scan/process, then transition to `READY`.
4. Store object keys as opaque tenant-scoped keys such as `tenants/{tenantId}/assets/{assetId}/v{version}/original`; never derive keys from user filenames or expose filesystem paths.
5. Persist metadata in `Asset`: original filename, sanitized display filename, MIME, size, checksum, dimensions, duration, thumbnail reference, provider, object key, creator, timestamps, and status.
6. Add authenticated `GET /api/assets/:id/download` or an equivalent redirect-to-signed-URL endpoint. Verify JWT, tenant, asset status, and authorization through the owning message/document/product link. Never serve `/uploads/...` publicly in production.
7. Add attachment finalization and unlink/delete APIs. Use soft deletion first; physical object deletion is a worker responsibility after grace period, no references, and no legal/audit hold.
8. Add image thumbnail generation and media metadata extraction asynchronously. Add antivirus/content scanning before `READY`; quarantined assets must not be downloadable or attachable.
9. Add per-tenant quotas, per-user rate limits, MIME allowlists, decompression-bomb protection, filename normalization, checksum deduplication policy, and upload timeout/size enforcement.

### Phase 3: Communication write/read correctness
1. Centralize access checks in a Gateway communication authorization helper: tenant, active participant, role/permission, conversation status, participant type, and context ownership.
2. Make message creation transactional: validate idempotency key, create Message and MessageAttachment links, validate ConversationContext and ConversationPolicy, update conversation timestamp/read state, and insert one outbox event in the same transaction.
3. Keep message bodies append-oriented. Edits update text plus `editedAt` and write an audit record; deletes set soft-delete fields and preserve audit history. Per-user hiding uses `deletedFor`; physical purge follows retention policy.
4. Ensure message reads use cursor pagination and stable ordering. Add unread aggregation based on `lastReadAt` and receipts without loading entire conversations.
5. Validate every referenced asset belongs to the same tenant, is `READY`, and is not already deleted/quarantined. Never trust client-provided asset URLs, tenant IDs, uploader IDs, or storage metadata.
6. Add replies, forwarding, reactions, read receipts, typing, archive/mute/pin, edit/delete, and unread routes on the same authorization foundation. Treat typing, online state, and last-seen as ephemeral presence data rather than durable message history.
7. Add message and conversation idempotency handling so retries cannot duplicate messages, attachments, reactions, or outbox events.
8. Render plugin messages through registered client/server handlers. Unknown or unauthorized plugin types must degrade to a safe summary instead of executing arbitrary payload content.

### Phase 4: Eventing and real time
1. Implement an outbox worker or reliable polling publisher that marks events `PENDING`, `PUBLISHED`, or `FAILED` with retry count and next-attempt time.
2. Publish outbox records to the repository event-bus boundary. Communication publishes once; Notifications, Search, Analytics, Audit, AI, and future capabilities subscribe independently.
3. Emit events for message creation/update/delete, attachment readiness, reactions, receipts, typing, presence, conversation changes, group membership, broadcast delivery, asset deletion, and context changes.
4. Add an AI-safe projection event such as `Communication.ConversationUpdated` with tenant, context, message IDs, timestamps, participant roles, redaction metadata, and approved content classification. AI consumers must not receive raw attachments, secrets, or unrestricted PII by default.
5. Implement `/api/communication/sse` using the existing `CommunicationSSEClient` contract. Authenticate before streaming, scope by tenant and active participant conversations, send heartbeats, enforce connection limits, and support `Last-Event-ID` replay from a bounded event log where feasible.
6. Keep SSE payloads minimal and omit message content or asset URLs unless the recipient is authorized. Clients fetch canonical message/asset data when needed.
7. Connect Communication events to in-app notifications, optional FCM/browser notifications, Search indexing, telemetry, audit, and AI consumers through adapters, not direct cross-module Prisma writes.

### Phase 5: Participants, permissions, and portals
1. Keep identity separate from business entities. Staff use identity IDs; customers, suppliers, partners, and future entities use typed business IDs resolved through service APIs.
2. Add communication permission keys: `VIEW_MESSAGES`, `MESSAGE_STAFF`, `MESSAGE_CUSTOMERS`, `CREATE_GROUP`, `MANAGE_GROUP`, `SEND_BROADCAST`, `DELETE_MESSAGE`, `VIEW_HISTORY`, `DOWNLOAD_ASSET`, and `EXPORT_CONVERSATION`.
3. Add normalized phone fields and ranked tenant-scoped contact search in the owning services, using phone/email/customer number/company/name. Phone is a lookup attribute, never an authorization key.
4. Make context-aware entry points available to ERP modules: customer, sales order, purchase order, delivery, invoice, project, ticket, employee, and workflow screens can open or create the authorized discussion for that context.
5. Finish Admin Messages UI with live SSE updates, secure attachment previews/downloads, reactions, receipts, typing, replies, edit/delete, group controls, unread badges, search, plugin rendering, and clear participant display fallback: name, then mobile, then email.
6. Add a customer portal Inbox/Support page using the authenticated customer-to-Sales mapping. Customers may access only authorized support conversations and explicitly allowed support groups; they cannot search arbitrary customers or staff.
7. Add supplier/partner participation through adapters when those portals and permissions exist. Do not create fake users or cross-service foreign keys.

### Phase 6: Groups and broadcasts
1. Add group membership operations with admin/member roles, join/leave timestamps, immediate revocation, mute/archive/pin, participant limits, and support-group restrictions for customers.
2. Enforce `ConversationPolicy` for group membership, support closure, project membership, customer visibility, retention, and export behavior.
3. Add broadcast draft, preview, audience evaluation, consent/opt-out filtering, schedule/cancel/send, retry, per-recipient delivery state, and audit history.
4. Process broadcasts asynchronously. The HTTP send endpoint creates a job and returns a tracking ID; workers create recipient records in batches and publish delivery events.
5. Do not expose recipient lists to recipients. Store only the minimum audience information required for delivery and audit, with configurable retention for recipient records.

### Phase 7: Data lifecycle, privacy, and operations
1. Define message lifecycle: `ACTIVE` → `EDITED` or `SOFT_DELETED` → `PURGE_ELIGIBLE` → `PURGED`; legal/audit holds pause purge.
2. Define asset lifecycle: `UPLOADING` → `PENDING_SCAN` → `READY` or `QUARANTINED` → `UNLINKED` → `DELETED` → `PURGED`. Failed uploads and abandoned pending assets expire automatically.
3. Define conversation lifecycle: `OPEN` → `ARCHIVED` → `LOCKED` → `DELETED`, with locked conversations readable according to permission and no new messages.
4. Define presence as an ephemeral capability boundary. Keep online/offline/typing/last-seen in a dedicated Presence/Realtime store or adapter when scale requires it; Communication consumes presence events and does not write high-frequency state into message history.
5. Implement scheduled workers for abandoned uploads, virus-scan retries, thumbnails, outbox retries, notification retries, retention marking, asset garbage collection, and export generation.
6. Support tenant-configurable retention with platform minimums, legal holds, export-before-delete, customer erasure workflows, and audit records that retain only necessary identifiers.
7. Encrypt database backups and object storage, enable object versioning/immutability where required, restrict bucket access to the application, rotate secrets, and redact message content/assets from logs and telemetry.
8. Add operational metrics: messages sent/failed, upload failures, asset scan latency, storage usage/quota, outbox lag, notification delivery, SSE connections/reconnects, unread counts, response time, purge backlog, and authorization failures.
9. Document backup and restore: PostgreSQL point-in-time recovery plus object-storage versioned backups; test restoring database and objects together so attachment references remain valid.

### Phase 8: Search, export, and extraction readiness
1. Publish sanitized `Communication.SearchIndexed` events and index message text/context asynchronously in the Search capability; do not run broad unbounded SQL `LIKE` scans in the message API.
2. Add authorized conversation export with a manifest of messages, participants, timestamps, audit data, and asset references; generate export files asynchronously and protect them with the same Asset lifecycle.
3. Add service contract tests that run against Gateway v1 and a future standalone Communication deployment. Keep portals dependent only on API/shared package contracts.
4. Define extraction criteria: sustained load, independent scaling needs, SSE connection volume, deployment isolation, or team ownership. Extract only after event/API/storage contracts are stable.

**Relevant files**
- `/home/erp/apps/gateway/prisma/schema.prisma` — communication models, shared `Asset`, outbox, audit, retention, and indexes.
- `/home/erp/packages/asset/src/types.ts` and `/home/erp/packages/asset/src/constants.ts` — canonical `AssetRef`, asset types, MIME mapping, and limits.
- `/home/erp/packages/communication/src/types.ts`, `events.ts`, `constants.ts`, `sse-client.ts`, and `message-utils.ts` — shared API/event/lifecycle contracts.
- `/home/erp/packages/communication/src/context.ts` — `ConversationContext` builders and ERP context authorization metadata.
- `/home/erp/apps/gateway/src/app/api/uploads/attachment/route.ts` — replace direct local writes with asset upload orchestration.
- `/home/erp/apps/gateway/src/app/api/communication/**` — authorization, message transactions, attachments, download, events, SSE, groups, broadcasts, search, and unread routes.
- `/home/erp/apps/gateway/src/(lib)` or the existing Gateway library area — storage adapter, authorization helper, outbox publisher, lifecycle workers, and media processing.
- `/home/erp/apps/gateway/src/app/(admin)/messages/page.tsx` — admin messenger client and live interaction states.
- `/home/erp/apps/customer/src` — customer Inbox/Support client and customer identity mapping.
- `/home/erp/apps/sales/prisma/schema.prisma` and customer search routes — normalized phone and contact search.
- `/home/erp/apps/procurement/prisma/schema.prisma` and `/home/erp/apps/hr/prisma/schema.prisma` — future supplier/employee directory adapters.
- `/home/erp/apps/gateway/src/app/api/notifications/**` — notification adapter integration.
- `/home/erp/docs/adr/0017-communication-platform-capability.md`, `/home/erp/docs/adr/0001-assetref.md`, and a new communication lifecycle guide — architecture, storage, retention, extraction, ConversationContext, ConversationPolicy, event-bus, presence, plugin, and AI projection decisions.
- `/home/erp/docker-compose.yml`, `/home/erp/data/uploads`, and deployment configuration — local MinIO/S3-compatible storage, volumes, backup, and environment settings.

**Parallel work**
- Asset adapter contract, communication authorization helper, and shared lifecycle/event types can be designed in parallel.
- Prisma migration design and UI contract work can proceed in parallel after Phase 0 invariants are approved.
- Storage adapter implementation and outbox/event contract can proceed in parallel, but message transaction changes depend on the outbox schema.
- Portal UI, admin UI, and notification consumer can proceed in parallel once API contracts and SSE event shapes are fixed.
- Broadcast UI must wait for broadcast schema and async worker semantics.
- Context entry points can proceed in parallel by module once the `ConversationContext` contract and authorization resolver are fixed.
- Plugin renderers and AI-safe event projections can proceed in parallel after the message plugin schema and redaction policy are approved.

**Verification**
1. Run Prisma format, validation, generated-client checks, additive migrations, and Gateway focused diagnostics after each schema/API phase.
2. Test two tenants with identical IDs, participants, messages, and asset names; prove no list, message, event, download, search, export, or notification crosses tenant boundaries.
3. Test authorization for staff, customer, supplier-future adapter, non-member, removed member, locked conversation, wrong tenant, missing permission, expired token, and asset from another conversation.
4. Upload every supported media type through local and MinIO/S3 adapters; verify checksum, metadata, scan status, thumbnail, signed download, range/stream behavior, quotas, and rejection of spoofed MIME/content.
5. Exercise retries and crashes at upload, message transaction, outbox publish, notification delivery, broadcast batch, and purge stages; verify idempotency and no orphaned or prematurely deleted data.
6. Verify message lifecycle, edit/delete audit, retention marking, legal hold, customer erasure, asset unlinking, garbage collection, and database/object restore together.
7. Verify SSE authentication, tenant/member filtering, heartbeat, reconnect, event ordering, `Last-Event-ID` behavior, connection limits, and fallback reload.
8. Verify staff-to-customer support, customer reply, group membership, reactions, read receipts, typing, presence, attachments, unread counts, search, and export flows.
9. Verify context-aware conversations for customer, sales order, purchase order, delivery, invoice, project, ticket, employee, and workflow references, including unauthorized context access.
10. Verify policy overrides, plugin validation and safe fallback rendering, event-bus retries, AI projection redaction, and presence behavior under reconnect/load.
11. Load test message writes, timeline reads, attachment downloads, outbox lag, and SSE connections with realistic tenant distribution; establish alert thresholds.
12. Run the existing Gateway typecheck and record unrelated baseline failures separately; add focused tests for every new route and lifecycle worker.

**Decisions**
- Use PostgreSQL for communication metadata and object storage for binaries; never store file blobs in message rows.
- Use the existing `Asset` model as the canonical asset metadata boundary and evolve it rather than creating Communication-specific file storage.
- Use local filesystem only for development/test; use MinIO or S3-compatible storage for staging/production.
- Use authenticated or short-lived signed downloads; remove public static attachment access from production.
- Keep Communication in Gateway for v1; preserve an extractable API/event contract rather than launching a second service now.
- Use transactional outbox events for reliable realtime, notifications, search, audit, and analytics integration.
- Treat the event bus, fed by the transactional outbox, as the integration boundary for Notifications, Search, Analytics, Audit, AI, and future capabilities.
- Make `ConversationContext` first-class so every ERP module can open an authorized discussion around its business objects.
- Use policy-driven conversation authorization in addition to role permissions.
- Use extensible, validated message plugins for workflow, document, and approval messages instead of adding one-off message types and UI branches.
- Keep high-frequency presence state separate from durable Communication data when scale requires it; Communication consumes presence events.
- Use soft deletion plus asynchronous purge, legal holds, configurable retention, and auditable erasure.
- Keep in-app messaging only in scope; WhatsApp, SMS, email, and push are future adapters and not core message storage.
- Broadcasts are separate campaign/delivery entities; customer-to-customer discovery is excluded initially.
- Keep message content out of logs, public URLs, and unrestricted telemetry.

**Scope boundaries**
- Included: durable communication data model, Asset lifecycle, local/MinIO/S3 storage abstraction, secure downloads, attachments/media processing, tenant isolation, permissions, messages, groups, broadcasts, realtime events, notifications, search events, audit, retention, deletion, export, monitoring, backup/restore, and extraction readiness.
- Excluded: WhatsApp Business API, external channel delivery, immediate standalone Communication service, customer-to-customer discovery, vendor portal creation before vendor identity/auth exists, and unrelated ERP refactors.

**Risks and mitigations**
- Local files are lost when a container is replaced: use MinIO/S3 and backup/restore tests before production.
- Public URLs leak tenant data: route all downloads through authorization and signed URLs.
- Database and object storage diverge: use asset states, transactional metadata, reconciliation jobs, and orphan cleanup.
- SSE does not scale in-process: enforce connection limits initially and move pub/sub to Redis/NATS before service extraction when metrics demand it.
- Retention deletes required records: implement legal holds, export-before-delete, dry-run reports, and delayed purge.
- Existing legacy attachments lack Asset rows: backfill where possible and retain a time-limited compatibility reader with migration metrics.
- Context identifiers can become stale or unauthorized: store display snapshots for resilience, but revalidate ownership and authorization through the owning module on access.
- Plugin payloads can become unsafe or unrenderable: validate against registered schemas, version payloads, and provide a safe summary fallback.
- AI consumers can receive sensitive ERP data: publish redacted projections by default, apply tenant/purpose authorization, and retain provenance for generated summaries.
- High-frequency presence writes can overload PostgreSQL: use TTL/heartbeat storage and move presence to Redis or another realtime store when metrics justify it.
