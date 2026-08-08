# ADR 0017: Communication as a Platform Capability

**Date:** 2026-03-08
**Status:** Accepted

## Context

The ERP platform needs enterprise communication (WhatsApp-like messaging) integrated with business entities and workflow tasks. The initial proposal considered a standalone microservice (`apps/communication`), but the architecture review established that Communication should be a **platform capability** alongside Identity, Workflow, Forms, Documents, and Notification.

Key architectural decisions were refined through four review iterations (v1 → v4):

1. **Not a microservice** — Communication is a platform capability deployed in the Gateway for v1, extractable later without API changes.
2. **Asset is first-class** — A generic `Asset` model is shared by Communication, Documents, Products, and future modules. No capability owns another's data.
3. **Extensible context** — Conversations attach to ERP entities via `module + entity + entityId` (not a growing enum).
4. **Search is separate** — Communication contributes searchable content via events; Search is its own future capability.
5. **Collaboration umbrella** — Communication (realtime chat) is the first piece of a future Collaboration capability (Comments, Activity, Followers).
6. **Namespaced events** — `Communication.MessageCreated` etc. — other capabilities subscribe.
7. **AI-ready** — Conversation summaries, suggested replies, and decision extraction designed from day one.

## Decision

### Deployment: Gateway-hosted for v1

Communication APIs live in `apps/gateway/src/app/api/communication/`. Data models live in the gateway's Prisma schema. The API contract (`/api/communication/*`) never exposes whether Communication is inside Gateway or deployed separately.

```
Platform Capability: Communication
Deployment:
  v1  → Gateway module (APIs in gateway, models in gateway DB)
  v2+ → Dedicated deployment (only if scale requires; no API changes)
```

This mirrors the Documents strategy (ADR 0001).

### Shared packages

- `packages/asset` — AssetRef types, asset constants (first-class platform capability)
- `packages/communication` — Types, constants, namespaced events, SSE client, message utilities

### Data models (gateway Prisma)

- `Asset` — Generic platform asset store (DOCUMENT, MEDIA, IMAGE, VIDEO, VOICE, FILE, REPORT)
- `Conversation` — With lifecycle states (OPEN, ARCHIVED, LOCKED, DELETED) and extensible context (module + entity + entityId)
- `ConversationParticipant` — Generalized (participantType: USER | TEAM | ROLE | SYSTEM)
- `Message` — All WhatsApp-like message types, reply/forward, edit/delete, per-message context
- `MessageAttachment` — Uses strongly typed AssetRef (not raw URLs)
- `MessageReaction`, `MessageReadReceipt` — Reactions and read receipts
- `Presence` — Online/away/offline (v1 in Communication; future: Identity)
- `ConversationSummary` — AI summaries and decision extraction

### Event architecture

Communication publishes namespaced platform events:
- `Communication.MessageCreated`
- `Communication.MessageUpdated`
- `Communication.MessageDeleted`
- `Communication.ReactionAdded` / `Communication.ReactionRemoved`
- `Communication.PresenceChanged`
- `Communication.TypingStarted` / `Communication.TypingStopped`
- `Communication.SearchIndexed`

Subscribers:
- **Notification** — decides push/email/toast delivery
- **Search** (future) — indexes content
- **Collaboration** (future) — builds activity feeds

### Communication ↔ Notification boundary

Communication owns: conversations, messages, attachments, presence, reactions, typing, read receipts.
Notification owns: push (FCM), email, SMS, browser notifications, in-app toast.

Communication publishes `Communication.MessageCreated` → Notification decides delivery.

### Presence ownership boundary

Presence API (`/api/communication/presence`) is generic. v1 implemented in Communication. Future migration to Identity is transparent (no API changes).

### Comments ≠ Conversations

Comments (persistent, threaded, entity-owned) are a future Collaboration concept, not Messages. They may share infrastructure but are separate domain concepts.

## Consequences

- **Positive:** Communication is deeply integrated with ERP entities and workflow tasks. Reuses existing patterns (AssetRef, AdminShell, Notification, upload infrastructure). No new microservice, database, or Docker service.
- **Positive:** Extensible context model allows any future ERP module to have conversations without code changes.
- **Positive:** AI capabilities (summaries, decision extraction) designed from day one.
- **Negative:** Gateway schema grows with Communication models. Acceptable for v1; can be extracted if scale requires.
- **Risk:** SSE in Next.js requires careful connection management. Mitigated by heartbeat + auto-reconnect.