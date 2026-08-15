# ADR 0019: Notification as a Platform Capability

**Date:** 2026-08-14
**Status:** Accepted
**Depends on:** ADR 0016 (Gateway boundaries), ADR 0017 (Communication), ADR 0020 (Service SRP)

## Context

Domain services need a single outbound notification path for WhatsApp, Telegram, SMS, email, in-app, and FCM. Creating `apps/notification` as a twelfth microservice would contradict ADR 0016 (no big-bang service splits) and ADR 0017 (Notification is a platform capability alongside Communication, not a chat product).

WhatsApp already exists in Gateway as:

- Identity OTP (Fast2SMS AUTH / SMS OTP)
- Two-way Conversations (Communication)
- Outbound session/utility messages (this capability)

Those must not be collapsed into one API.

## Decision

### Deployment: Gateway-hosted for v1

Notification APIs live in `apps/gateway/src/app/api/notifications/`. Persistence is the gateway Prisma database (`Notification`, `FCMToken`, `NotificationDelivery`). The HTTP contract does not expose whether Notification is inside Gateway or extracted later.

```
Platform Capability: Notification
Deployment:
  v1  → Gateway module (APIs + models in gateway DB)
  v2+ → Dedicated deployment only if scale requires; no API changes
```

Shared package: `packages/notifications` — versioned send command, channel types, template render, dispatch/retry.

### Command contract (v1)

`POST /api/notifications/send` accepts:

```ts
{
  version: 1,
  type: string,
  title: string,
  body: string,
  channels?: Array<"IN_APP" | "FCM" | "EMAIL" | "SMS" | "WHATSAPP" | "TELEGRAM">,
  recipients: Array<{ userId?: string; email?: string; phone?: string; telegramChatId?: string }>,
  variables?: Record<string, string>,
  metadata?: object,
  idempotencyKey?: string
}
```

Default channel when omitted: `IN_APP`. Tenant policy can disable channels. `idempotencyKey` replays the prior delivery set.

### Channel ownership

| Channel | Owner | LIVE provider | DEMO |
|---------|-------|---------------|------|
| IN_APP | Notification | Gateway `Notification` row | Same (always persisted) |
| FCM | Notification | FCM HTTP if `FIREBASE_SERVER_KEY` | Skip unless key set |
| EMAIL | Notification | Tenant SMTP (nodemailer) | Record SENT, no SMTP |
| SMS | Notification | Fast2SMS quick SMS (same API key as WhatsApp connector) | Record SENT |
| WHATSAPP | Notification (outbound only) | Fast2SMS session text | Record SENT |
| TELEGRAM | Notification | Telegram Bot API | Record SENT |

Communication still owns two-way WhatsApp threads. Identity still owns OTP. Notification never opens conversations.

### Mode

Per-tenant `TenantIntegration` provider `NOTIFICATION`: `mode: DEMO | LIVE`. DEMO is the default so E2E and local send work without provider credentials. Secrets (SMTP password, Telegram bot token) use the existing AES-256-GCM `TenantIntegrationSecret` store.

### Delivery log

Every (recipient × channel) attempt writes `NotificationDelivery` (`QUEUED` → `SENT` | `SKIPPED` | `FAILED` | `DEAD`). Operators list and retry from Administration → Integrations → Notifications.

`POST /api/notifications/push` remains a compatibility wrapper for IN_APP + FCM.

## Consequences

- **Positive:** Domain services (`notifyPortalCustomer`, billing, future AR dunning) call one command. Dead-letter is visible. No new Docker service, database, or port.
- **Positive:** Matches ADR 0017 Communication ↔ Notification boundary.
- **Negative:** Gateway schema grows by `NotificationDelivery`. Acceptable; extractable later.
- **Limitation:** LIVE WhatsApp session messages require an open 24h window; utility templates for proactive outbound remain a follow-up. LIVE SMS uses Fast2SMS quick route; DLT-registered templates are a follow-up for India production SMS.

## Addendum (2026-08-14) — extraction lock

Do **not** create `apps/notification` in this phase. Do **not** add a backlog item whose only job is extraction.

Notification remains a **Gateway-hosted platform capability** with an explicit boundary and a stable contract (`@erp/notifications`, `POST /api/notifications/send`). Sales, Accounting, Delivery, and Procurement must not know whether adapters run inside Gateway or behind a later BFF rewrite.

**OTP stays permanently on Gateway:** `Login → Gateway → Fast2SMS`. Login must never require a Notification process.

In-app inbox and FCM tokens stay Gateway-owned (they attach to `User`).

Extract outbound Notification to **`:3012` behind the Gateway BFF** only when communication is a real operational workload: template library + DLT SMS + WhatsApp utility templates + AR dunning + queue/retry/history.

See [ADR 0020](0020-service-srp.md) and [SERVICE-SRP.md](../architecture/SERVICE-SRP.md).
