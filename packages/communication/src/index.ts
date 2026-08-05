// Types
export type {
  ConversationType,
  CommunicationChannel,
  ConversationStatus,
  ParticipantType,
  ParticipantRole,
  Conversation,
  ConversationParticipant,
  MessageType,
  MessageStatus,
  SenderType,
  Message,
  MessageAttachment,
  MessageReaction,
  MessageReadReceipt,
  PresenceStatus,
  Presence,
  SummaryType,
  ConversationSummary,
  CursorPaginationParams,
  CursorPaginationResult,
} from "./types";

// Constants
export {
  CONVERSATION_TYPES,
  COMMUNICATION_CHANNELS,
  CONVERSATION_STATUSES,
  PARTICIPANT_TYPES,
  PARTICIPANT_ROLES,
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  SENDER_TYPES,
  PRESENCE_STATUSES,
  SUMMARY_TYPES,
  DEFAULT_MESSAGE_LIMIT,
  MAX_MESSAGE_LIMIT,
  TYPING_DEBOUNCE_MS,
  SSE_HEARTBEAT_MS,
  EDIT_WINDOW_MS,
  DELETE_FOR_EVERYONE_WINDOW_MS,
  DEFAULT_REACTIONS,
  AWAY_TIMEOUT_MS,
} from "./constants";

// Events
export type { CommunicationEvent, SSEEventType, SSEEvent } from "./events";

// Context
export type { ConversationContext, ConversationPolicy } from "./context";
export {
  GENERAL_CONTEXT,
  workflowTaskContext,
  salesOrderContext,
  purchaseOrderContext,
  invoiceContext,
  customerContext,
  vendorContext,
  employeeContext,
  productContext,
  conversationContext,
  formatContext,
} from "./context";

// SSE Client
export {
  CommunicationSSEClient,
  getSSEClient,
  disconnectSSEClient,
} from "./sse-client";

// Message utilities
export {
  formatMessageText,
  extractMentions,
  extractUrls,
  normalizeLimit,
  buildPaginationResult,
  parseCursor,
  formatFileSize,
  formatDuration,
} from "./message-utils";