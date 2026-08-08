"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Container, SectionHeader, Skeleton } from "@erp/ui";
import { api } from "@/lib/api-client";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  text?: string | null;
  type: string;
  senderType?: string;
  senderId: string;
  createdAt: string;
  isDeleted?: boolean;
  attachments?: Attachment[];
};

type Attachment = {
  id: string;
  assetRef?: { url?: string };
  fileName: string;
  mimeType: string;
  fileSize: number;
  duration?: number | null;
};

type MessageResponse = {
  data: Message[];
  nextCursor: string | null;
  hasMore: boolean;
};

type MessageResult = { data: Message };
type UploadResult = { data: { id: string; url: string; name: string; mimeType: string; size: number } };

type PendingAttachment = Attachment & {
  assetRef: { type: "VOICE"; id: string; version: number; url: string };
  url: string;
};

export default function InboxThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [voiceAttachment, setVoiceAttachment] = useState<PendingAttachment | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!id) return;
    api<MessageResponse>("gateway", `/api/communication/conversations/${id}/messages?limit=50`).then((result) => {
      if (result.error) setError(result.error);
      else setMessages(result.data?.data ?? []);
      setLoading(false);
    });
  }, [id]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    const result = await api<MessageResult>("gateway", `/api/communication/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ type: "TEXT", text: trimmed }),
    });
    if (result.error) setError(result.error);
    else if (result.data?.data) {
      const sentMessage = result.data.data;
      setMessages((current) => [...current, sentMessage]);
      setText("");
    }
    setSending(false);
  }

  const uploadVoice = useCallback(async (blob: Blob, mimeType: string) => {
    setUploadingVoice(true);
    setError("");
    try {
      const extension = mimeType === "audio/ogg" ? "ogg" : "webm";
      const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
      const form = new FormData();
      form.set("file", file);
      const result = await api<UploadResult>("gateway", "/api/uploads/attachment", {
        method: "POST",
        body: form,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const uploadResponse = result.data;
      if (!uploadResponse) {
        setError("Voice note upload returned no result");
        return;
      }
      const upload = uploadResponse.data;
      setVoiceAttachment({
        id: upload.id,
        assetRef: { type: "VOICE", id: upload.id, version: 1, url: upload.url },
        fileName: upload.name,
        mimeType: upload.mimeType,
        fileSize: upload.size,
        url: upload.url,
      });
    } finally {
      setUploadingVoice(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
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
        void uploadVoice(new Blob(recordedChunksRef.current, { type: mimeType }), mimeType);
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone permission is required to record a voice note");
    }
  }, [uploadVoice]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  async function sendVoiceMessage() {
    if (!voiceAttachment || sending) return;
    setSending(true);
    setError("");
    const result = await api<MessageResult>("gateway", `/api/communication/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        type: "VOICE",
        text: null,
        attachments: [{ ...voiceAttachment, url: undefined }],
      }),
    });
    if (result.error) setError(result.error);
    else if (result.data?.data) {
      setMessages((current) => [...current, result.data.data]);
      setVoiceAttachment(null);
    }
    setSending(false);
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/inbox" className="text-xs font-semibold text-[var(--forest)]">← Messages</Link>
      <SectionHeader title="Conversation" className="mb-5 mt-2" />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="ml-auto h-16 w-3/4" />
        </div>
      ) : null}

      {!loading && error && messages.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((message) => {
            const fromCustomer = message.senderType === "CUSTOMER";
            const audio = message.attachments?.find((attachment) => attachment.mimeType.startsWith("audio/"));
            return (
            <div key={message.id} className={`flex ${fromCustomer ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-[var(--radius)] border px-4 py-3 shadow-[var(--shadow-sm)] ${fromCustomer ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)]"}`}>
                {audio?.assetRef?.url ? (
                  <audio controls src={audio.assetRef.url} className="max-w-full" aria-label="Voice message" />
                ) : (
                  <p className={`whitespace-pre-wrap text-sm ${fromCustomer ? "text-white" : "text-[var(--ink)]"}`}>{message.text || "Attachment"}</p>
                )}
                <time className={`mt-2 block text-[10px] ${fromCustomer ? "text-white/70" : "text-[var(--ink-soft)]"}`} dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
            </div>
            );
          })}
        </div>
      ) : null}

      <form onSubmit={sendMessage} className="sticky bottom-20 mt-6 flex gap-2 border-t border-[var(--line)] bg-[var(--paper)] py-3">
        {voiceAttachment ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]">
            <audio controls src={voiceAttachment.url} className="min-w-0 flex-1" aria-label="Voice note preview" />
            <button type="button" onClick={() => setVoiceAttachment(null)} className="text-xs font-semibold text-[var(--danger)]">
              Remove
            </button>
          </div>
        ) : (
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
          className="min-h-[var(--touch-min)] min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--forest-mid)]"
          maxLength={4000}
        />
        )}
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={sending || uploadingVoice || Boolean(voiceAttachment)}
          aria-label={recording ? "Stop recording" : "Record voice message"}
          className={`min-h-[var(--touch-min)] rounded-[var(--radius)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${recording ? "bg-[var(--danger)]" : "bg-[var(--ink)]"}`}
        >
          {recording ? "Stop" : uploadingVoice ? "Uploading" : "Mic"}
        </button>
        <button
          type="submit"
          disabled={sending || uploadingVoice || (!text.trim() && !voiceAttachment)}
          onClick={voiceAttachment ? (event) => { event.preventDefault(); void sendVoiceMessage(); } : undefined}
          className="min-h-[var(--touch-min)] rounded-[var(--radius)] bg-[var(--forest)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending" : "Send"}
        </button>
      </form>
    </Container>
  );
}