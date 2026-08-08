import type {
  ConversationType,
  ConversationStatus,
  MessageType,
  MessageStatus,
  ParticipantType,
  ParticipantRole,
  PresenceStatus,
  SenderType,
  SummaryType,
} from "./types";

export const CONVERSATION_TYPES: ConversationType[] = ["DIRECT", "GROUP", "SUPPORT", "BROADCAST"];
export const COMMUNICATION_CHANNELS = ["IN_APP", "EMAIL", "SMS", "PUSH", "WHATSAPP"] as const;
export const CONVERSATION_STATUSES: ConversationStatus[] = ["OPEN", "ARCHIVED", "LOCKED", "DELETED"];
export const PARTICIPANT_TYPES: ParticipantType[] = [
  "USER", "STAFF", "CUSTOMER", "SUPPLIER", "PARTNER", "TEAM", "ROLE", "SYSTEM", "BOT",
];
export const PARTICIPANT_ROLES: ParticipantRole[] = ["ADMIN", "MEMBER"];

export const MESSAGE_TYPES: MessageType[] = [
  "TEXT", "VOICE", "IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "LOCATION", "CONTACT", "SYSTEM",
];
export const MESSAGE_STATUSES: MessageStatus[] = ["SENT", "DELIVERED", "READ", "FAILED"];
export const SENDER_TYPES: SenderType[] = ["USER", "SYSTEM"];

export const PRESENCE_STATUSES: PresenceStatus[] = ["ONLINE", "AWAY", "OFFLINE"];
export const SUMMARY_TYPES: SummaryType[] = ["SUMMARY", "DECISIONS"];

/** Default message page size for cursor pagination */
export const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 200;

/** Typing indicator debounce (ms) */
export const TYPING_DEBOUNCE_MS = 3000;

/** SSE heartbeat interval (ms) */
export const SSE_HEARTBEAT_MS = 30000;

/** Edit window for messages (ms) — 15 minutes */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Delete-for-everyone window (ms) — 1 hour */
export const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 1000;

/** Default reaction emojis */
export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Away timeout — user is AWAY after 5 min of inactivity */
export const AWAY_TIMEOUT_MS = 5 * 60 * 1000;