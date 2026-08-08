import { SSE_HEARTBEAT_MS } from "./constants";
import type { SSEEvent } from "./events";

/**
 * Client-side SSE helper for real-time communication updates.
 * Auto-reconnects on disconnect; dispatches typed events to listeners.
 */
export class CommunicationSSEClient {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): void {
    if (this.eventSource) this.disconnect();

    // EventSource doesn't support custom headers, so pass token as query param
    const url = `${this.url}?token=${encodeURIComponent(this.token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectDelay = 1000;
      this.startHeartbeat();
    };

    this.eventSource.onerror = () => {
      this.disconnect();
      this.scheduleReconnect();
    };

    this.eventSource.addEventListener("message", (e: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        this.dispatch(event.type, event.data);
      } catch {
        // ignore malformed events
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.disconnect();
        this.scheduleReconnect();
      }
    }, SSE_HEARTBEAT_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  on(eventType: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType: string, handler: (data: unknown) => void): void {
    this.listeners.get(eventType)?.delete(handler);
  }

  private dispatch(eventType: string, data: unknown): void {
    this.listeners.get(eventType)?.forEach((handler) => {
      try {
        handler(data);
      } catch {
        // listener errors should not break other listeners
      }
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/** Create a singleton SSE client for the current session */
let sseClient: CommunicationSSEClient | null = null;

export function getSSEClient(url: string, token: string): CommunicationSSEClient {
  if (!sseClient || sseClient["url"] !== url) {
    sseClient = new CommunicationSSEClient(url, token);
  }
  return sseClient;
}

export function disconnectSSEClient(): void {
  sseClient?.disconnect();
  sseClient = null;
}