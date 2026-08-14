"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container, SectionHeader, Skeleton } from "@erp/ui";
import { api } from "@/lib/api-client";

type Conversation = {
  id: string;
  title?: string | null;
  description?: string | null;
  status: string;
  contextLabel?: string | null;
  updatedAt: string;
  participants?: { participantType: string; participantId: string; displayName?: string }[];
  messages?: { text?: string | null; createdAt: string; senderId: string }[];
};

type ConversationResponse = { data: Conversation };
type ConversationListResponse = { data: Conversation[] };

function conversationTitle(conversation: Conversation): string {
  return conversation.title?.trim() || conversation.contextLabel?.trim() || "Support conversation";
}

export default function InboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<ConversationListResponse>("gateway", "/api/communication/conversations?status=OPEN").then((result) => {
      if (result.error) setError(result.error);
      else setConversations(result.data?.data ?? []);
      setLoading(false);
    });
  }, []);

  async function createConversation() {
    if (creating) return;
    setCreating(true);
    setError("");
    const result = await api<ConversationResponse>("gateway", "/api/communication/conversations", {
      method: "POST",
      body: JSON.stringify({
        type: "DIRECT",
        title: title.trim() || "Customer support",
        participantIds: [],
      }),
    });
    if (result.error) {
      setError(result.error);
      setCreating(false);
      return;
    }
    if (result.data?.data.id) router.push(`/inbox/${result.data.data.id}`);
    setCreating(false);
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Support</p>
      <SectionHeader title="Messages" className="mb-2" />
      <p className="mb-6 -mt-2 max-w-lg text-sm text-[var(--ink-soft)]">
        Keep questions, order updates, and support replies together.
      </p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && conversations.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-6 py-12 text-center shadow-[var(--shadow-1)]">
          <p className="font-display text-xl text-[var(--ink)]">No messages yet</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Support conversations and order updates will appear here.
          </p>
          {!showComposer ? (
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="mt-5 min-h-[var(--touch-min)] rounded-[var(--radius-md)] bg-[var(--forest)] px-4 text-sm font-semibold text-white"
            >
              Start a conversation
            </button>
          ) : (
            <div className="mx-auto mt-5 max-w-md text-left">
              <label htmlFor="conversation-title" className="text-xs font-semibold text-[var(--ink)]">
                What can we help with?
              </label>
              <input
                id="conversation-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Order question, product help..."
                maxLength={120}
                autoFocus
                className="mt-2 min-h-[var(--touch-min)] w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--forest-mid)]"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="min-h-[var(--touch-min)] rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--ink-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createConversation}
                  disabled={creating}
                  className="min-h-[var(--touch-min)] rounded-[var(--radius-md)] bg-[var(--forest)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Starting..." : "Continue"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!loading && !error && conversations.length > 0 ? (
        <div className="space-y-3">
          {conversations.map((conversation) => {
            const lastMessage = conversation.messages?.[0];
            return (
              <Link
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="block rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] transition hover:border-[var(--forest-mid)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[var(--ink)]">
                      {conversationTitle(conversation)}
                    </h2>
                    <p className="mt-1 truncate text-sm text-[var(--ink-soft)]">
                      {lastMessage?.text?.trim() || conversation.description || "No messages yet"}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-[var(--ink-soft)]" dateTime={conversation.updatedAt}>
                    {new Date(conversation.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </time>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </Container>
  );
}