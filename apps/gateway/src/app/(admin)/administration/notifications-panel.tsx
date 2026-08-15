"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, StatusChip } from "@erp/ui";
import { api } from "@/lib/admin-api";

type Channel = "IN_APP" | "FCM" | "EMAIL" | "SMS" | "WHATSAPP" | "TELEGRAM";

type ChannelConfig = {
  policy: {
    mode: "DEMO" | "LIVE";
    defaultChannels: Channel[];
    channels: Record<Channel, { enabled: boolean }>;
  };
  email: {
    from: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    hasPassword: boolean;
    passwordLastFour: string | null;
  };
  telegram: { hasBotToken: boolean; botTokenLastFour: string | null };
};

type Delivery = {
  id: string;
  channel: string;
  status: string;
  type: string;
  title: string;
  toAddress: string | null;
  provider: string | null;
  error: string | null;
  createdAt: string;
};

const CHANNELS: Channel[] = ["IN_APP", "FCM", "EMAIL", "SMS", "WHATSAPP", "TELEGRAM"];

function tone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "SENT") return "success";
  if (status === "FAILED" || status === "DEAD") return "danger";
  if (status === "SKIPPED") return "warning";
  return "neutral";
}

export function NotificationsPanel() {
  const [cfg, setCfg] = useState<ChannelConfig | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [mode, setMode] = useState<"DEMO" | "LIVE">("DEMO");
  const [enabled, setEnabled] = useState<Record<Channel, boolean>>({
    IN_APP: true,
    FCM: true,
    EMAIL: true,
    SMS: true,
    WHATSAPP: true,
    TELEGRAM: true,
  });
  const [from, setFrom] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");

  const [testChannel, setTestChannel] = useState<Channel>("EMAIL");
  const [testTo, setTestTo] = useState("");
  const [testTitle, setTestTitle] = useState("Sankalp test");
  const [testBody, setTestBody] = useState("Notification service is connected.");

  const applyConfig = useCallback((data: ChannelConfig) => {
    setCfg(data);
    setMode(data.policy.mode);
    setEnabled({
      IN_APP: data.policy.channels.IN_APP.enabled,
      FCM: data.policy.channels.FCM.enabled,
      EMAIL: data.policy.channels.EMAIL.enabled,
      SMS: data.policy.channels.SMS.enabled,
      WHATSAPP: data.policy.channels.WHATSAPP.enabled,
      TELEGRAM: data.policy.channels.TELEGRAM.enabled,
    });
    setFrom(data.email.from);
    setSmtpHost(data.email.smtpHost);
    setSmtpPort(String(data.email.smtpPort));
    setSmtpUser(data.email.smtpUser);
    setSmtpSecure(data.email.smtpSecure);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [channels, log] = await Promise.all([
        api<{ data: ChannelConfig }>("/api/notifications/channels"),
        api<{ data: Delivery[] }>("/api/notifications/deliveries?limit=15"),
      ]);
      applyConfig(channels.data);
      setDeliveries(log.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: ChannelConfig }>("/api/notifications/channels", {
        method: "PUT",
        body: JSON.stringify({
          mode,
          enabled,
          email: {
            from,
            smtpHost,
            smtpPort: Number(smtpPort) || 587,
            smtpUser,
            smtpSecure,
            smtpPassword: smtpPassword.trim() || undefined,
          },
          telegramBotToken: telegramBotToken.trim() || undefined,
        }),
      });
      applyConfig(res.data);
      setSmtpPassword("");
      setTelegramBotToken("");
      setMessage("Notification channels saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const recipient: Record<string, string> = {};
      if (testChannel === "EMAIL") recipient.email = testTo.trim();
      else if (testChannel === "SMS" || testChannel === "WHATSAPP") recipient.phone = testTo.trim();
      else if (testChannel === "TELEGRAM") recipient.telegramChatId = testTo.trim();
      else recipient.userId = testTo.trim();

      await api("/api/notifications/send", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          type: "ADMIN_TEST",
          title: testTitle,
          body: testBody,
          channels: [testChannel],
          recipients: [recipient],
        }),
      });
      setMessage(`Test sent on ${testChannel} (${mode})`);
      const log = await api<{ data: Delivery[] }>("/api/notifications/deliveries?limit=15");
      setDeliveries(log.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/notifications/deliveries/${id}/retry`, { method: "POST" });
      const log = await api<{ data: Delivery[] }>("/api/notifications/deliveries?limit=15");
      setDeliveries(log.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-soft)]">Loading notification channels…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink)]">Notifications</h2>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Outbound WhatsApp, Telegram, SMS, email, and in-app/push. DEMO records deliveries without
          calling providers. LIVE uses Fast2SMS (WhatsApp/SMS), SMTP, Telegram Bot API, and FCM.
          Two-way WhatsApp chat stays in Messages; OTP stays on the WhatsApp connector above.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
        <label className="block text-xs text-[var(--ink-soft)]">
          Mode
          <select
            className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value === "LIVE" ? "LIVE" : "DEMO")}
          >
            <option value="DEMO">DEMO (no provider calls)</option>
            <option value="LIVE">LIVE (SMTP / Fast2SMS / Telegram / FCM)</option>
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                checked={enabled[ch]}
                onChange={(e) => setEnabled((prev) => ({ ...prev, [ch]: e.target.checked }))}
              />
              {ch}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Email (SMTP)</h3>
        <Input label="From" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="noreply@example.com" />
        <Input label="SMTP host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
        <Input label="SMTP port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
        <Input label="SMTP user" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
        <Input
          label={cfg?.email.hasPassword ? `SMTP password (saved …${cfg.email.passwordLastFour})` : "SMTP password"}
          type="password"
          autoComplete="off"
          value={smtpPassword}
          onChange={(e) => setSmtpPassword(e.target.value)}
          placeholder={cfg?.email.hasPassword ? "Enter a new password to rotate" : "SMTP password"}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
          Implicit TLS (port 465)
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Telegram</h3>
        <Input
          label={cfg?.telegram.hasBotToken ? `Bot token (saved …${cfg.telegram.botTokenLastFour})` : "Bot token"}
          type="password"
          autoComplete="off"
          value={telegramBotToken}
          onChange={(e) => setTelegramBotToken(e.target.value)}
          placeholder={cfg?.telegram.hasBotToken ? "Enter a new token to rotate" : "123456:ABC…"}
        />
        <p className="text-xs text-[var(--ink-soft)]">
          Recipients need a Telegram chat id. SMS and WhatsApp reuse the Fast2SMS key on the WhatsApp
          panel.
        </p>
      </div>

      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save notification channels"}
      </Button>

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Send test</h3>
        <label className="block text-xs text-[var(--ink-soft)]">
          Channel
          <select
            className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value as Channel)}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={
            testChannel === "EMAIL"
              ? "To email"
              : testChannel === "TELEGRAM"
                ? "Chat id"
                : testChannel === "SMS" || testChannel === "WHATSAPP"
                  ? "Mobile"
                  : "User id"
          }
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
        />
        <Input label="Title" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} />
        <Input label="Body" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
        <Button disabled={busy || !testTo.trim()} onClick={() => void sendTest()}>
          {busy ? "Sending…" : "Send test"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Recent deliveries</h3>
        <ul className="space-y-2">
          {deliveries.map((d) => (
            <li key={d.id} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {d.channel} · {d.type}
                </span>
                <StatusChip tone={tone(d.status)}>{d.status}</StatusChip>
              </div>
              <p className="text-xs text-[var(--ink-soft)]">
                {d.toAddress || "—"} {d.provider ? `· ${d.provider}` : ""} {d.error ? `· ${d.error}` : ""}
              </p>
              {(d.status === "FAILED" || d.status === "QUEUED") && (
                <Button variant="secondary" disabled={busy} onClick={() => void retry(d.id)}>
                  Retry
                </Button>
              )}
            </li>
          ))}
          {deliveries.length === 0 && (
            <li className="text-xs text-[var(--ink-soft)]">No deliveries yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
