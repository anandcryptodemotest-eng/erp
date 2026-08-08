"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select } from "@erp/ui";
import { api } from "@/lib/admin-api";

type WabaNumber = {
  waba_id?: string | number;
  phone_number_id?: string | number;
  number?: string;
  verified_name?: string;
  quality_rating?: string;
  connection_status?: string;
};

type WabaTemplate = {
  message_id?: string | number;
  template_name: string;
  category?: string;
  status?: string;
  language?: string;
  var_count?: number;
};

type MetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
};

type WhatsAppStatus = {
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  apiKeyLastFour: string | null;
  hasApiKey: boolean;
  config: {
    wabaId: string | null;
    phoneNumberId: string | null;
    displayPhone: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
    connectionStatus: string | null;
    authTemplateName: string | null;
    authTemplateLanguage: string | null;
    authMessageId: string | null;
    pendingAuthTemplateName: string | null;
    pendingAuthTemplateStatus: string | null;
    graphVersion: string;
    smsOtpId: string | null;
    smsSenderId: string | null;
    dltMessageId: string | null;
  };
  numbers: WabaNumber[];
  templates: WabaTemplate[];
  authTemplates: WabaTemplate[];
  metaTemplates: MetaTemplate[];
  health: { health_status?: { can_send_message?: string } } | null;
  wallet: { wallet?: number | string; sms_count?: number | string } | null;
  readyForOtp: boolean;
  otpChannel: "whatsapp_auth" | "whatsapp_simple" | "sms_otp" | null;
};

const CHANNEL_LABEL: Record<NonNullable<WhatsAppStatus["otpChannel"]>, string> = {
  whatsapp_auth: "WhatsApp Copy Code (AUTH)",
  whatsapp_simple: "WhatsApp simple template",
  sms_otp: "SMS OTP (Fast2SMS)",
};

export function WhatsAppIntegrationPanel() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [authTemplateName, setAuthTemplateName] = useState("");
  const [smsOtpId, setSmsOtpId] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMode, setTestMode] = useState<"otp" | "simple" | "session">("otp");
  const [sessionText, setSessionText] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [portalSlug, setPortalSlug] = useState("");
  const [copyCodeName, setCopyCodeName] = useState("erp_auth_copycode");
  const [requestId, setRequestId] = useState("");
  const [reportJson, setReportJson] = useState<string | null>(null);
  const [logsJson, setLogsJson] = useState<string | null>(null);

  const applyStatus = (data: WhatsAppStatus) => {
    setStatus(data);
    setPhoneNumberId(data.config.phoneNumberId ?? "");
    setAuthTemplateName(data.config.authTemplateName ?? "");
    setSmsOtpId(data.config.smsOtpId ?? "");
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: WhatsAppStatus }>("/api/integrations/whatsapp");
      applyStatus(res.data);
      try {
        const tenantId = typeof window !== "undefined" ? localStorage.getItem("admin_tenant_id") : "";
        if (tenantId) {
          const t = await api<{ data?: { slug?: string; settings?: Record<string, string> } }>(
            `/api/tenants/${tenantId}`
          );
          setPortalSlug(t.data?.slug || "");
        }
      } catch {
        /* slug only needed for otp-start */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load WhatsApp integration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveKey() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: WhatsAppStatus }>("/api/integrations/whatsapp", {
        method: "PUT",
        body: JSON.stringify({ apiKey, sync: true }),
      });
      applyStatus(res.data);
      setApiKey("");
      setMessage("API key saved and WABA details synced");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: WhatsAppStatus }>("/api/integrations/whatsapp/sync", {
        method: "POST",
      });
      applyStatus(res.data);
      setMessage("WABA numbers, templates, wallet, and profile synced");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDefaults() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selected = [...(status?.authTemplates ?? []), ...(status?.templates ?? [])].find(
        (t) => t.template_name === authTemplateName
      );
      const res = await api<{ data: WhatsAppStatus }>("/api/integrations/whatsapp/defaults", {
        method: "PUT",
        body: JSON.stringify({
          phoneNumberId: phoneNumberId || undefined,
          authTemplateName: authTemplateName || undefined,
          authTemplateLanguage: selected?.language,
          smsOtpId,
        }),
      });
      applyStatus(res.data);
      setMessage("OTP defaults saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save defaults");
    } finally {
      setBusy(false);
    }
  }

  async function createCopyCode() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: WhatsAppStatus }>("/api/integrations/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify({ kind: "copy_code", name: copyCodeName.trim() || "erp_auth_copycode" }),
      });
      applyStatus(res.data);
      setMessage(
        "Copy Code AUTH template submitted. Meta must approve it (often minutes to hours). Sync again after approval, or set SMS otp_id as fallback."
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `${e.message}. If Meta Graph is blocked on this WABA, create the Copy Code template in the Fast2SMS panel, then Sync.`
          : "Could not create Copy Code template"
      );
    } finally {
      setBusy(false);
    }
  }

  async function testSend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (testMode === "otp") {
        const res = await api<{ data: { message?: string; requestId?: string } }>(
          "/api/integrations/whatsapp/test",
          { method: "POST", body: JSON.stringify({ phone: testPhone }) }
        );
        setMessage(
          `${res.data.message ?? "Test OTP sent"}${res.data.requestId ? ` · request ${res.data.requestId}` : ""}`
        );
        if (res.data.requestId) setRequestId(res.data.requestId);
        return;
      }
      const res = await api<{ data: { requestId?: string | null; mode?: string } }>(
        "/api/integrations/whatsapp/send",
        {
          method: "POST",
          body: JSON.stringify({
            phone: testPhone,
            mode: testMode,
            text: sessionText || undefined,
          }),
        }
      );
      setMessage(
        `Sample ${res.data.mode ?? testMode} sent${res.data.requestId ? ` · request ${res.data.requestId}` : ""}`
      );
      if (res.data.requestId) setRequestId(res.data.requestId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  }

  async function lookupReport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: unknown }>(
        `/api/integrations/whatsapp/reports?requestId=${encodeURIComponent(requestId.trim())}`
      );
      setReportJson(JSON.stringify(res.data, null, 2));
      setMessage("Delivery report loaded");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Report lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadLogs() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: unknown; from?: string; to?: string }>(
        "/api/integrations/whatsapp/logs"
      );
      setLogsJson(JSON.stringify(res.data, null, 2));
      setMessage(`Logs loaded${res.from && res.to ? ` (${res.from} → ${res.to})` : ""}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Logs failed");
    } finally {
      setBusy(false);
    }
  }

  const numberOptions =
    status?.numbers.map((n) => ({
      value: String(n.phone_number_id ?? ""),
      label: `${n.verified_name || "Number"} · ${n.number || n.phone_number_id}${
        n.quality_rating ? ` (${n.quality_rating})` : ""
      }`,
    })) ?? [];

  const templateOptions = (() => {
    const seen = new Set<string>();
    const rows: { value: string; label: string }[] = [];
    for (const t of [...(status?.authTemplates ?? []), ...(status?.templates ?? [])]) {
      if (!t.template_name || seen.has(t.template_name)) continue;
      seen.add(t.template_name);
      rows.push({
        value: t.template_name,
        label: `${t.template_name} · ${t.category ?? "?"} · ${t.language ?? "en"} · ${t.status ?? "Approved"}`,
      });
    }
    return rows;
  })();

  const canSend = status?.health?.health_status?.can_send_message;
  const channelLabel = status?.otpChannel ? CHANNEL_LABEL[status.otpChannel] : "Not ready";

  if (loading && !status) {
    return <p className="text-sm text-[var(--ink-soft)]">Loading WhatsApp connector…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink)]">WhatsApp (Fast2SMS)</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Per-tenant Fast2SMS key. Preferred OTP path is a Meta{" "}
          <a
            className="underline"
            href="https://docs.fast2sms.com/reference/createcopycodetemplate"
            target="_blank"
            rel="noreferrer"
          >
            Copy Code AUTHENTICATION
          </a>{" "}
          template. If Graph is unavailable on this WABA, use a simple Fast2SMS message_id or SMS otp_id.
          The API key is stored encrypted and never shown again.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-[var(--danger)]">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-[var(--forest)]">{message}</div>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-sm sm:grid-cols-2">
        <StatusRow label="Status" value={status?.status ?? "DISCONNECTED"} />
        <StatusRow
          label="API key"
          value={status?.apiKeyLastFour ? `••••${status.apiKeyLastFour}` : "Not set"}
        />
        <StatusRow label="WABA ID" value={status?.config.wabaId ?? "—"} />
        <StatusRow label="Display number" value={status?.config.displayPhone ?? "—"} />
        <StatusRow label="Quality" value={status?.config.qualityRating ?? "—"} />
        <StatusRow label="Connection" value={status?.config.connectionStatus ?? "—"} />
        <StatusRow label="Can send" value={canSend ?? "—"} />
        <StatusRow
          label="Wallet"
          value={status?.wallet?.wallet != null ? String(status.wallet.wallet) : "—"}
        />
        <StatusRow label="OTP channel" value={channelLabel} />
        <StatusRow
          label="Pending template"
          value={
            status?.config.pendingAuthTemplateName
              ? `${status.config.pendingAuthTemplateName} · ${status.config.pendingAuthTemplateStatus ?? "?"}`
              : "—"
          }
        />
        <StatusRow label="message_id" value={status?.config.authMessageId ?? "—"} />
        <StatusRow
          label="Last sync"
          value={status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "Never"}
        />
      </div>
      {status?.lastError ? (
        <p className="text-xs text-[var(--danger)]">Last error: {status.lastError}</p>
      ) : null}

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">Fast2SMS API key</label>
        <Input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={status?.hasApiKey ? "Enter a new key to rotate" : "Paste API key from Fast2SMS Dev API"}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || apiKey.trim().length < 8} onClick={() => void saveKey()}>
            {busy ? "Saving…" : "Save key & sync"}
          </Button>
          <Button variant="secondary" disabled={busy || !status?.hasApiKey} onClick={() => void sync()}>
            Sync WABA
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold text-[var(--ink-soft)]">Create Copy Code AUTH template</p>
        <p className="text-xs text-[var(--ink-soft)]">
          Submits Body + Footer + OTP Copy Code button to Meta via Fast2SMS. After approval, sync and save
          defaults. Login OTP then uses AUTH → simple message_id → SMS otp_id.
        </p>
        <Input
          value={copyCodeName}
          onChange={(e) => setCopyCodeName(e.target.value)}
          placeholder="erp_auth_copycode"
        />
        <Button disabled={busy || !status?.config.wabaId} onClick={() => void createCopyCode()}>
          Create Copy Code template
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold text-[var(--ink-soft)]">OTP sender defaults</p>
        {numberOptions.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            No phone numbers yet. Save an API key and sync, or connect WhatsApp in the Fast2SMS panel.
          </p>
        ) : (
          <Select
            label="Phone number"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            options={numberOptions}
            placeholder="Select phone number ID"
          />
        )}
        {templateOptions.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            No templates yet. Create Copy Code above (or in Fast2SMS), wait for Meta approval, then sync.
          </p>
        ) : (
          <Select
            label="OTP template"
            value={authTemplateName}
            onChange={(e) => setAuthTemplateName(e.target.value)}
            options={templateOptions}
            placeholder="Select template"
          />
        )}
        <Input
          label="SMS otp_id fallback (optional)"
          value={smsOtpId}
          onChange={(e) => setSmsOtpId(e.target.value)}
          placeholder="Fast2SMS DLT OTP template id"
        />
        <Button disabled={busy || (!phoneNumberId && !smsOtpId)} onClick={() => void saveDefaults()}>
          Save defaults
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold text-[var(--ink-soft)]">Test send</p>
        <p className="text-xs text-[var(--ink-soft)]">
          OTP uses the live login channel (AUTH / simple / SMS). Session text only works inside a 24-hour
          customer window. Test OTP cannot be used to sign in.
        </p>
        <Select
          label="Mode"
          value={testMode}
          onChange={(e) => setTestMode(e.target.value as typeof testMode)}
          options={[
            { value: "otp", label: "OTP (AUTH → simple → SMS)" },
            { value: "simple", label: "Simple template (message_id)" },
            { value: "session", label: "Session text (24h window)" },
          ]}
        />
        <Input
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="9198XXXXXXXX"
        />
        {testMode === "session" ? (
          <Input
            value={sessionText}
            onChange={(e) => setSessionText(e.target.value)}
            placeholder="Session message text"
          />
        ) : null}
        <Button
          variant="secondary"
          disabled={
            busy ||
            testPhone.trim().length < 10 ||
            (testMode === "otp" && !status?.readyForOtp) ||
            (testMode === "simple" && !status?.config.authMessageId)
          }
          onClick={() => void testSend()}
        >
          Send test
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold text-[var(--ink-soft)]">Delivery reports & logs</p>
        <Input
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="Fast2SMS request_id"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || requestId.trim().length < 4}
            onClick={() => void lookupReport()}
          >
            Fetch DLR
          </Button>
          <Button variant="outline" disabled={busy || !status?.hasApiKey} onClick={() => void loadLogs()}>
            Last 7 days logs
          </Button>
        </div>
        {reportJson ? (
          <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--paper-2,rgba(0,0,0,0.03))] p-3 text-xs">
            {reportJson}
          </pre>
        ) : null}
        {logsJson ? (
          <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--paper-2,rgba(0,0,0,0.03))] p-3 text-xs">
            {logsJson}
          </pre>
        ) : null}
      </div>

      {status?.metaTemplates?.length ? (
        <div className="rounded-xl border border-[var(--line)] p-4 text-sm">
          <p className="text-xs font-semibold text-[var(--ink-soft)]">Meta templates (Graph)</p>
          <ul className="mt-2 space-y-1">
            {status.metaTemplates.map((t) => (
              <li key={`${t.id ?? t.name}-${t.language ?? ""}`}>
                {(t.name ?? "unnamed")} · {t.category ?? "?"} · {t.status ?? "?"} · {t.language ?? ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold text-[var(--ink-soft)]">Link my staff WhatsApp</p>
        <p className="text-xs text-[var(--ink-soft)]">
          Required before you can sign in to Admin with WhatsApp. Uses the same OTP channel.
        </p>
        <Input
          value={linkPhone}
          onChange={(e) => {
            setLinkPhone(e.target.value);
            setLinkSent(false);
          }}
          placeholder="9198XXXXXXXX"
        />
        {linkSent ? (
          <Input
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value)}
            placeholder="6-digit code"
          />
        ) : null}
        <Button
          variant="outline"
          disabled={busy || !status?.readyForOtp || linkPhone.trim().length < 10 || !portalSlug}
          onClick={() => void (linkSent ? linkStaffPhone() : startStaffLink())}
        >
          {linkSent ? "Verify & link" : "Send link code"}
        </Button>
      </div>
    </div>
  );

  async function startStaffLink() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/auth?action=otp-start", {
        method: "POST",
        body: JSON.stringify({
          phone: linkPhone,
          tenantSlug: portalSlug,
          purpose: "VERIFY_LINK",
          portal: "ADMIN",
        }),
      });
      setLinkSent(true);
      setMessage("Code sent. Check WhatsApp or SMS.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send link code");
    } finally {
      setBusy(false);
    }
  }

  async function linkStaffPhone() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/auth?action=otp-link", {
        method: "POST",
        body: JSON.stringify({ phone: linkPhone, code: linkCode }),
      });
      setMessage("WhatsApp linked to your staff account. You can sign in with OTP next time.");
      setLinkCode("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not link WhatsApp");
    } finally {
      setBusy(false);
    }
  }
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{label}</p>
      <p className="mt-0.5 font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}
