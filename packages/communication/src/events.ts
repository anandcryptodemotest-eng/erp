import type { PresenceStatus } from "./types";

/**
 * Namespaced platform events published by Communication.
 * Other capabilities (Notification, Search, future Collaboration) subscribe.
 */
export type CommunicationEvent =
  | {
      type: "Communication.MessageCreated";
      payload: {
        conversationId: string;
        messageId: string;
        senderId: string;
        senderType: string;
        recipientIds: string[];
        contextModule: string;
        contextEntity: string;
        contextId: string | null;
        messageType: string;
        text: string | null;
        createdAt: string;
      };
    }
  | {
      type: "Communication.MessageUpdated";
      payload: { conversationId: string; messageId: string; senderId: string };
    }
  | {
      type: "Communication.MessageDeleted";
      payload: { conversationId: string; messageId: string; deletedBy: string };
    }
  | {
      type: "Communication.ReactionAdded";
      payload: { messageId: string; userId: string; emoji: string };
    }
  | {
      type: "Communication.ReactionRemoved";
      payload: { messageId: string; userId: string; emoji: string };
    }
  | {
      type: "Communication.PresenceChanged";
      payload: { userId: string; status: PresenceStatus; lastSeenAt: string | null };
    }
  | {
      type: "Communication.TypingStarted";
      payload: { conversationId: string; userId: string };
    }
  | {
      type: "Communication.TypingStopped";
      payload: { conversationId: string; userId: string };
    }
  | {
      type: "Communication.SearchIndexed";
      payload: {
        messageId: string;
        conversationId: string;
        text: string;
        senderId: string;
        createdAt: string;
      };
    };

/** SSE event types pushed to connected clients */
export type SSEEventType =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "message.read"
  | "reaction.added"
  | "reaction.removed"
  | "presence.changed"
  | "typing.started"
  | "typing.stopped"
  | "conversation.updated"
  | "participant.joined"
  | "participant.left";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
}