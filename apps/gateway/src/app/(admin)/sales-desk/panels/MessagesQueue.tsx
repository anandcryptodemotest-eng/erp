"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { api, getAdminUser } from "@/lib/admin-api";

type Conversation = {
  id: string;
  title: string | null;
  contextModule: string;
  contextEntity: string;
  contextId: string | null;
  participants: { participantId: string; displayName?: string }[];
  messages?: { text: string | null; createdAt: string }[];
  updatedAt: string;
};

/**
 * WhatsApp-style conversation list for Order Desk left queue (Gateway Communication).
 */
export function MessagesQueue({
  selectedId,
  onSelect,
  onOpenFull,
  onCountChange,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenFull: () => void;
  onCountChange?: (n: number) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getAdminUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/api/communication/conversations");
      const rows = (res.data || []) as Conversation[];
      setConversations(rows);
      onCountChange?.(rows.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full min-h-[24rem] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Communication
          </p>
          <p className="truncate text-sm font-semibold text-[var(--ink)]">Messages</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onOpenFull}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--mist)]"
            title="Open full Messages"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Open full Messages</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-3 text-sm text-[var(--danger)]">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-[var(--ink-soft)]">Loading chats…</p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <MessageCircle className="h-8 w-8 text-[var(--brand)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--ink)]">No conversations yet</p>
            <p className="text-xs text-[var(--ink-soft)]">
              Start a chat in Messages — threads stay linked to orders when you set SalesOrder context.
            </p>
            <button
              type="button"
              onClick={onOpenFull}
              className="mt-2 text-sm font-semibold text-[var(--brand)] hover:underline"
            >
              Open Messages →
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const other =
              conv.participants.find((p) => p.participantId !== user?.id)?.displayName || "…";
            const active = selectedId === conv.id;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`w-full border-b border-[var(--line)] p-3 text-left transition hover:bg-[var(--mist)] ${
                  active ? "bg-[color-mix(in_srgb,var(--brand)_8%,white)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                      {conv.title || `Chat with ${other}`}
                    </p>
                    <p className="truncate text-xs text-[var(--ink-soft)]">
                      {conv.messages?.[0]?.text || "No messages yet"}
                    </p>
                    {conv.contextId ? (
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--brand)]">
                        {conv.contextEntity} · {conv.contextId}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--ink-soft)]">
                    {formatDate(conv.updatedAt)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
