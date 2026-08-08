"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { api, getToken, getAdminUser } from "@/lib/admin-api";

type Conversation = {
  id: string;
  type: string;
  status: string;
  title: string | null;
  contextModule: string;
  contextEntity: string;
  contextId: string | null;
  participants: { id: string; participantId: string; participantType: string; displayName?: string }[];
  messages?: { id: string; text: string | null; senderId: string; createdAt: string }[];
  updatedAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string;
  type: string;
  text: string | null;
  createdAt: string;
  attachments?: MessageAttachment[];
  reactions?: { id: string; userId: string; emoji: string }[];
  readReceipts?: { id: string; userId: string; readAt: string }[];
  replyTo?: { id: string; text: string | null; senderId: string } | null;
};

type MessageAttachment = {
  id: string;
  assetRef: { type: string; id: string; version: number; url?: string };
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailUrl: string | null;
};

type PendingAttachment = MessageAttachment & { url: string };

type Contact = {
  id: string;
  kind: "STAFF" | "CUSTOMER";
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  customerGroup: string | null;
};

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const user = getAdminUser();

  const loadConversations = useCallback(async () => {
    try {
      const res = await api("/api/communication/conversations");
      setConversations(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!showNewChat || contactQuery.trim().length < 2) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await api(`/api/communication/contacts/search?q=${encodeURIComponent(contactQuery.trim())}`);
        if (!cancelled) setContacts(res.data || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to search contacts");
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [contactQuery, showNewChat]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await api(`/api/communication/conversations/${convId}/messages?limit=50`);
      setMessages(res.data || []);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
  }, []);

  const selectConversation = useCallback((conv: Conversation) => {
    setActiveConversation(conv);
    loadMessages(conv.id);
  }, [loadMessages]);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || !activeConversation) return;
    setLoading(true);
    try {
      const res = await api(`/api/communication/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          type: pendingAttachments.some((attachment) => attachment.mimeType.startsWith("audio/"))
            ? "AUDIO"
            : pendingAttachments.some((attachment) => attachment.mimeType.startsWith("image/"))
              ? "IMAGE"
              : "DOCUMENT",
          text: input.trim() || null,
          attachments: pendingAttachments.map(({ url: _url, ...attachment }) => attachment),
        }),
      });
      setMessages((prev) => [...prev, res.data]);
      setInput("");
      setPendingAttachments([]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      // Refresh conversation list to update last message
      loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  }, [input, pendingAttachments, activeConversation, loadConversations]);

  const uploadFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => {
        const form = new FormData();
        form.set("file", file);
        const result = await api("/api/uploads/attachment", { method: "POST", body: form });
        const assetType = file.type.startsWith("audio/")
          ? "VOICE"
          : file.type.startsWith("image/")
            ? "IMAGE"
            : file.type === "application/pdf"
              ? "DOCUMENT"
              : "FILE";
        return {
          id: result.data.id,
          assetRef: { type: assetType, id: result.data.id, version: 1, url: result.data.url },
          fileName: result.data.name,
          mimeType: result.data.mimeType,
          fileSize: result.data.size,
          thumbnailUrl: file.type.startsWith("image/") ? result.data.url : null,
          url: result.data.url,
        } as PendingAttachment;
      }));
      setPendingAttachments((current) => [...current, ...uploaded].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const extension = mimeType === "audio/ogg" ? "ogg" : "webm";
        void uploadFiles([new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mimeType })]);
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone permission is required to record a voice note");
    }
  }, [uploadFiles]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!activeConversation) return;
    try {
      const res = await api(`/api/communication/conversations/${activeConversation.id}/messages/${messageId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, reactions: [...(message.reactions || []).filter((reaction) => !(reaction.userId === user?.id && reaction.emoji === emoji)), res.data] }
        : message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add reaction");
    }
  }, [activeConversation, user?.id]);

  const markRead = useCallback(async (messageId: string) => {
    if (!activeConversation || !user?.id) return;
    try {
      const res = await api(`/api/communication/conversations/${activeConversation.id}/messages/${messageId}/read-receipts`, {
        method: "POST",
      });
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, readReceipts: [...(message.readReceipts || []).filter((receipt) => receipt.userId !== user.id), res.data] }
        : message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark message as read");
    }
  }, [activeConversation, user?.id]);

  const createConversation = useCallback(async () => {
    if (!selectedContact) {
      setError("Select a contact first");
      return;
    }
    try {
      const res = await api("/api/communication/conversations", {
        method: "POST",
        body: JSON.stringify({
          type: "DIRECT",
          title: newChatTitle || null,
          participantIds: selectedContact.kind === "STAFF" ? [selectedContact.id] : [user?.id].filter(Boolean),
          customerIds: selectedContact.kind === "CUSTOMER" ? [selectedContact.id] : [],
        }),
      });
      setShowNewChat(false);
      setContactQuery("");
      setContacts([]);
      setSelectedContact(null);
      setNewChatTitle("");
      await loadConversations();
      selectConversation(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create conversation");
    }
  }, [newChatTitle, selectedContact, loadConversations, selectConversation, user?.id]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-gray-50">
      {/* Conversation List */}
      <div
        className={`w-full md:w-80 border-r border-gray-200 bg-white flex-col ${
          activeConversation ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
            title="New chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No conversations yet. Click + to start a chat.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full p-3 border-b border-gray-100 text-left hover:bg-gray-50 transition ${
                  activeConversation?.id === conv.id ? "bg-emerald-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {conv.title || `Chat with ${conv.participants.find(p => p.participantId !== user?.id)?.displayName || "..."}`}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {conv.messages?.[0]?.text || "No messages yet"}
                    </div>
                    {conv.contextId && (
                      <div className="text-xs text-emerald-600 mt-1">
                        {conv.contextModule} / {conv.contextEntity} / {conv.contextId}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 ml-2">
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className={`min-w-0 flex-1 flex-col ${activeConversation ? "flex" : "hidden md:flex"}`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-2 justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
                  onClick={() => setActiveConversation(null)}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">
                  {activeConversation.title || `Chat with ${activeConversation.participants.find(p => p.participantId !== user?.id)?.displayName || "..."}`}
                </h2>
                <div className="text-xs text-gray-500">
                  {activeConversation.participants.length} participant(s)
                  {activeConversation.status !== "OPEN" && (
                    <span className="ml-2 px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                      {activeConversation.status}
                    </span>
                  )}
                </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-2 ${
                          isMine
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-gray-900 border border-gray-200"
                        }`}
                      >
                        {msg.replyTo && (
                          <div className={`text-xs mb-1 p-1 rounded ${
                            isMine ? "bg-emerald-700" : "bg-gray-100"
                          }`}>
                            {msg.replyTo.text || "[attachment]"}
                          </div>
                        )}
                        {msg.attachments?.map((attachment) => (
                          attachment.mimeType.startsWith("audio/") ? (
                            <audio key={attachment.id} controls className="mb-2 max-w-full" src={attachment.assetRef.url} />
                          ) : attachment.mimeType.startsWith("image/") ? (
                            <a key={attachment.id} href={attachment.thumbnailUrl || attachment.assetRef.url || "#"} target="_blank" rel="noreferrer">
                              <img src={attachment.thumbnailUrl || attachment.assetRef.url || ""} alt={attachment.fileName} className="mb-2 max-h-64 max-w-full rounded object-contain" />
                            </a>
                          ) : (
                            <a
                              key={attachment.id}
                              href={attachment.assetRef.url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`mb-2 block rounded px-3 py-2 text-sm underline ${isMine ? "bg-emerald-700" : "bg-gray-100"}`}
                            >
                              {attachment.fileName}
                            </a>
                          )
                        ))}
                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                        {(msg.reactions?.length || msg.readReceipts?.length) ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {Object.entries((msg.reactions || []).reduce<Record<string, number>>((counts, reaction) => {
                              counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
                              return counts;
                            }, {})).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => addReaction(msg.id, emoji)}
                                className={`rounded-full px-2 py-0.5 text-xs ${isMine ? "bg-emerald-700" : "bg-gray-100 text-gray-700"}`}
                                title="Add reaction"
                              >
                                {emoji} {count}
                              </button>
                            ))}
                            {isMine && msg.readReceipts?.length ? <span className="text-xs text-emerald-200">Seen</span> : null}
                          </div>
                        ) : null}
                        <div className="mt-1 flex gap-1">
                          {["👍", "❤️", "😂"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => addReaction(msg.id, emoji)}
                              className={`rounded px-1 text-xs opacity-60 hover:opacity-100 ${isMine ? "hover:bg-emerald-700" : "hover:bg-gray-100"}`}
                              title={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          {!isMine && (
                            <button
                              type="button"
                              onClick={() => markRead(msg.id)}
                              className="rounded px-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Mark as read"
                            >
                              Seen
                            </button>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${isMine ? "text-emerald-200" : "text-gray-400"}`}>
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white p-3 md:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,audio/webm,audio/ogg,audio/mpeg"
                multiple
                className="hidden"
                onChange={(event) => {
                  void uploadFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  void uploadFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading || activeConversation.status === "LOCKED"}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                title="Attach file or image"
              >
                {uploading ? "Uploading..." : "Attach"}
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={loading || uploading || activeConversation.status === "LOCKED"}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                title="Take a photo"
              >
                Camera
              </button>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || uploading || activeConversation.status === "LOCKED"}
                className={`rounded-full border px-3 py-2 text-sm ${recording ? "border-red-300 bg-red-50 text-red-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"} disabled:opacity-50`}
                title={recording ? "Stop recording" : "Record voice note"}
              >
                {recording ? "Stop" : "Voice"}
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {pendingAttachments.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto">
                    {pendingAttachments.map((attachment, index) => (
                      <button
                        key={`${attachment.id}-${index}`}
                        type="button"
                        onClick={() => setPendingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="max-w-40 truncate rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                        title="Remove attachment"
                      >
                        {attachment.fileName}
                      </button>
                    ))}
                  </div>
                )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={loading || activeConversation.status === "LOCKED"}
              />
              </div>
              <button
                onClick={sendMessage}
                disabled={loading || uploading || (!input.trim() && pendingAttachments.length === 0) || activeConversation.status === "LOCKED"}
                className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-4">New Conversation</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact
                </label>
                <input
                  type="text"
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setSelectedContact(null);
                  }}
                  placeholder="Search name, email, or phone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {contacts.length > 0 && !selectedContact && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                    {contacts.map((contact) => (
                      <button
                        key={`${contact.kind}-${contact.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedContact(contact);
                          setContactQuery(contact.name);
                          setContacts([]);
                        }}
                        className="w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-emerald-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-gray-900">{contact.name}</span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                            {contact.kind}
                          </span>
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {[contact.phone, contact.email, contact.role].filter(Boolean).join(" · ") || "No contact details"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedContact && (
                  <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <span>
                      {selectedContact.name} <span className="text-xs uppercase">({selectedContact.kind})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContact(null);
                        setContactQuery("");
                      }}
                      className="text-xs underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  placeholder="Conversation title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setContactQuery("");
                  setContacts([]);
                  setSelectedContact(null);
                  setNewChatTitle("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createConversation}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}