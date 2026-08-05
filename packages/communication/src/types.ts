import type { AssetRef } from "@erp/asset";
import type { ConversationContext, ConversationPolicy } from "./context";

// ── Conversation ──────────────────────────────────────────────

export type ConversationType = "DIRECT" | "GROUP" | "SUPPORT" | "BROADCAST";
export type CommunicationChannel = "IN_APP" | "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
export type ConversationStatus = "OPEN" | "ARCHIVED" | "LOCKED" | "DELETED";
export type ParticipantType = "USER" | "STAFF" | "CUSTOMER" | "SUPPLIER" | "PARTNER" | "TEAM" | "ROLE" | "SYSTEM" | "BOT";
export type ParticipantRole = "ADMIN" | "MEMBER";

export interface Conversation {
  id: string;
  tenantId: string;
  type: ConversationType;
  channel: CommunicationChannel;
  status: ConversationStatus;
  title: string | null;
  avatarUrl: string | null;
  description: string | null;
  contextModule: string;
  contextEntity: string;
  contextId: string | null;
  contextLabel: string | null;
  context?: ConversationContext;
  policy?: ConversationPolicy | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  participantType: ParticipantType;
  participantId: string;
  role: ParticipantRole;
  joinedAt: string;
  leftAt: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isFavorite: boolean;
}

// ── Message ────────────────────────────────────────────────────

export type MessageType =
  | "TEXT"
  | "VOICE"
  | "IMAGE"
  | "DOCUMENT"
  | "VIDEO"
  | "AUDIO"
  | "LOCATION"
  | "CONTACT"
  | "SYSTEM";

export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
export type SenderType = "USER" | "STAFF" | "CUSTOMER" | "SUPPLIER" | "PARTNER" | "SYSTEM" | "BOT";

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string;
  type: MessageType;
  text: string | null;
  contextModule: string | null;
  contextEntity: string | null;
  contextId: string | null;
  replyToId: string | null;
  forwardedFromId: string | null;
  isDeleted: boolean;
  deletedBy: string | null;
  deletedFor: string[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  assetRef: AssetRef;
  fileName: string;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
}

export interface MessageReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// ── Presence ───────────────────────────────────────────────────

export type PresenceStatus = "ONLINE" | "AWAY" | "OFFLINE";

export interface Presence {
  userId: string;
  tenantId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

// ── AI ─────────────────────────────────────────────────────────

export type SummaryType = "SUMMARY" | "DECISIONS";

export interface ConversationSummary {
  id: string;
  conversationId: string;
  tenantId: string;
  type: SummaryType;
  summary: string;
  decisions: string[];
  openQuestions: string[];
  actionItems: { assignee: string | null; task: string; dueDate: string | null }[];
  messageRange: { fromMessageId: string; toMessageId: string; fromCreatedAt: string; toCreatedAt: string };
  generatedBy: string;
  createdAt: string;
}

// ── API helpers ────────────────────────────────────────────────

export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number;
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}