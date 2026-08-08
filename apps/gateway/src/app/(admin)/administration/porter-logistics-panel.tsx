"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@erp/ui";
import { api, getTenantId } from "@/lib/admin-api";

const DEFAULT_BOOK_URL = "https://porter.in/";

export function PorterLogisticsPanel() {
  const tenantId = typeof window !== "undefined" ? getTenantId() : "";
  const [enabled, setEnabled] = useState(true);
  const [bookUrl, setBookUrl] = useState(DEFAULT_BOOK_URL);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const r = await api(`/api/tenants/${tenantId}/settings`);
      const settings = (r.data ?? {}) as Record<string, string>;
      setEnabled(settings["logistics.porter.enabled"] !== "false");
      setBookUrl(settings["logistics.porter.bookUrl"]?.trim() || DEFAULT_BOOK_URL);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Porter settings");
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          "logistics.porter.enabled": enabled ? "true" : "false",
          "logistics.porter.bookUrl": bookUrl.trim() || DEFAULT_BOOK_URL,
        }),
      });
      setMessage("Porter settings saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink)]">Porter (logistics)</h2>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Phase 0: dispatch can open Porter in a new tab. Tracking ID is optional. This does not embed
          porter.in and does not book via API yet.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Show Porter as a dispatch fulfillment option
      </label>
      <Input
        label="Book URL"
        value={bookUrl}
        onChange={(e) => setBookUrl(e.target.value)}
        placeholder={DEFAULT_BOOK_URL}
      />
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save Porter"}
      </Button>
    </div>
  );
}
