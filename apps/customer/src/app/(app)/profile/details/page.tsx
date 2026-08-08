"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Container, SectionHeader } from "@erp/ui";
import { api } from "@/lib/api-client";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";
import { resolveTenantSlug } from "@/lib/tenant";

type PhoneStatus = {
  data?: {
    phoneNormalized: string | null;
    phoneVerifiedAt: string | null;
    verified: boolean;
  };
};

export default function ProfileDetailsPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waCode, setWaCode] = useState("");
  const [waSent, setWaSent] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState("");
  const [waError, setWaError] = useState("");
  const [waStatus, setWaStatus] = useState<PhoneStatus["data"] | null>(null);

  useEffect(() => {
    void ensureCustomerProfile().then((r) => {
      if (r.customer) {
        setName(String(r.customer.name ?? ""));
        setPhone(String(r.customer.phone ?? ""));
        setEmail(String(r.customer.email ?? ""));
        if (r.customer.phone) setWaPhone(String(r.customer.phone));
      }
    });
    void api<PhoneStatus>("gateway", "/api/auth/phone").then((r) => {
      if (!r.error && r.data && "data" in r.data) {
        setWaStatus(r.data.data ?? null);
      }
    });
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    const res = await api("sales", "/api/customers/me", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      }),
    });
    setSaving(false);
    if (res.error) setError(res.error);
    else setMsg("Saved");
  }

  const fieldCls =
    "mt-0.5 w-full rounded-md border border-[#e8e8e8] px-3 py-2.5 text-sm outline-none focus:border-[var(--forest-mid)]";

  async function sendWhatsAppCode() {
    setWaBusy(true);
    setWaError("");
    setWaMsg("");
    const tenantSlug = resolveTenantSlug();
    const res = await api<{ data?: { phone?: string } }>("gateway", "/api/auth?action=otp-start", {
      method: "POST",
      body: JSON.stringify({
        phone: waPhone,
        tenantSlug,
        purpose: "VERIFY_LINK",
        portal: "CUSTOMER",
      }),
    });
    setWaBusy(false);
    if (res.error) {
      setWaError(res.error);
      return;
    }
    setWaSent(true);
    setWaMsg("Code sent. Check WhatsApp.");
  }

  async function verifyWhatsApp() {
    setWaBusy(true);
    setWaError("");
    setWaMsg("");
    const res = await api<{ data?: { phoneNormalized?: string; phoneVerifiedAt?: string } }>(
      "gateway",
      "/api/auth?action=otp-link",
      {
        method: "POST",
        body: JSON.stringify({ phone: waPhone, code: waCode }),
      }
    );
    setWaBusy(false);
    if (res.error) {
      setWaError(res.error);
      return;
    }
    setWaStatus({
      phoneNormalized: res.data?.data?.phoneNormalized ?? waPhone,
      phoneVerifiedAt: res.data?.data?.phoneVerifiedAt ?? new Date().toISOString(),
      verified: true,
    });
    setWaMsg("WhatsApp verified");
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Profile
      </Link>
      <SectionHeader title="Personal details" className="mt-2" />
      <form onSubmit={onSave} className="mt-4 max-w-md space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4">
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {msg ? <p className="text-sm font-semibold text-[var(--forest)]">{msg}</p> : null}
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          Name *
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          Phone
          <input className={fieldCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-[var(--ink-soft)]">
          Email
          <input
            type="email"
            className={fieldCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <Button type="submit" variant="primary" className="!rounded-md" loading={saving} disabled={saving}>
          Save
        </Button>
      </form>

      <SectionHeader title="WhatsApp verification" className="mt-8" />
      <div className="mt-3 max-w-md space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4">
        {waStatus?.verified ? (
          <p className="text-sm text-[var(--forest)]">
            Verified WhatsApp · {waStatus.phoneNormalized}
          </p>
        ) : (
          <>
            <p className="text-xs text-[var(--ink-soft)]">
              Link WhatsApp to sign in with a one-time code. The organization must have Fast2SMS
              configured.
            </p>
            {waError ? <p className="text-sm text-[var(--danger)]">{waError}</p> : null}
            {waMsg ? <p className="text-sm font-semibold text-[var(--forest)]">{waMsg}</p> : null}
            <label className="block text-xs font-semibold text-[var(--ink-soft)]">
              WhatsApp number
              <input
                className={fieldCls}
                value={waPhone}
                onChange={(e) => {
                  setWaPhone(e.target.value);
                  setWaSent(false);
                }}
              />
            </label>
            {waSent ? (
              <label className="block text-xs font-semibold text-[var(--ink-soft)]">
                6-digit code
                <input
                  className={fieldCls}
                  value={waCode}
                  onChange={(e) => setWaCode(e.target.value)}
                />
              </label>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="!rounded-md"
              loading={waBusy}
              disabled={waBusy || waPhone.trim().length < 10}
              onClick={() => void (waSent ? verifyWhatsApp() : sendWhatsAppCode())}
            >
              {waSent ? "Verify code" : "Send WhatsApp code"}
            </Button>
          </>
        )}
      </div>
    </Container>
  );
}
